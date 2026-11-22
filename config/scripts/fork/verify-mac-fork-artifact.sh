#!/usr/bin/env bash
# Fails unless every app inside the given DMGs and zips carries a valid signature for its whole bundle
# and the app and its helpers are signed by the given certificate. An invalid signature opens as
# "damaged" once downloaded; any other signer loses the app's macOS permission grants.
set -euo pipefail

authority="${1:?Usage: $0 <certificate name> <artifact.dmg|artifact.zip>...}"
shift
work="$(mktemp -d)"
mounts=()
cleanup() {
  for mount in "${mounts[@]+"${mounts[@]}"}"; do hdiutil detach -quiet "$mount" || true; done
  rm -rf "$work"
}
trap cleanup EXIT

check_authority() {
  local target="$1" label="$2"
  if ! codesign -dvv "$target" 2>&1 | grep -qxF "Authority=$authority"; then
    echo "::error::$label: $target is not signed by $authority." >&2
    return 1
  fi
}

verify_app() {
  local app="$1" label="$2" status=0
  if ! codesign --verify --deep --strict --verbose=2 "$app"; then
    echo "::error::$label: the app's signature is invalid; macOS would call the download damaged." >&2
    return 1
  fi
  check_authority "$app" "$label" || status=1
  for helper in "$app"/Contents/MacOS/* "$app"/Contents/Frameworks/*.app "$app"/Contents/Resources/*.app; do
    [[ -e "$helper" ]] && { check_authority "$helper" "$label" || status=1; }
  done
  [[ "$status" == 0 ]] && echo "$label: signed by $authority."
  return "$status"
}

status=0
for artifact in "$@"; do
  name="$(basename "$artifact")"
  case "$artifact" in
    *.dmg)
      mount="$work/mount-${#mounts[@]}"
      hdiutil attach -quiet -nobrowse -readonly -mountpoint "$mount" "$artifact"
      mounts+=("$mount")
      apps=("$mount"/*.app)
      ;;
    *.zip)
      dest="$work/zip-$name"
      mkdir -p "$dest"
      ditto -x -k "$artifact" "$dest"
      apps=("$dest"/*.app)
      ;;
    *) continue ;;
  esac
  if [[ ! -e "${apps[0]}" ]]; then
    echo "::error::$name contains no app." >&2
    status=1
    continue
  fi
  for app in "${apps[@]}"; do verify_app "$app" "$name" || status=1; done
done
exit "$status"
