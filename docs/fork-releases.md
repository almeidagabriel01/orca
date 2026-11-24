# Fork releases

This fork publishes its own macOS and Linux builds from `fork-main` and never touches upstream's
release pipeline. Installed fork builds learn about new versions from upstream (`stablyai/orca`)
but install only the fork's build of them, so an official build never replaces the fork's features.

## Version scheme

`<upstream version>-fork.<n>`, for example `1.4.271-fork.1`. The base is the upstream release the
fork is built on; `fork.n` counts the fork's own releases. Orca orders `1.4.271 < 1.4.271-fork.1 <
1.4.271-fork.2 < 1.4.272`, so a fork build counts as newer than the official build of its base and
keeps that build's data and settings (same app id and user data folder).

## Publish a version

1. Bump and commit on `fork-main`:

   ```sh
   node config/scripts/fork/fork-version.mjs                # 1.4.271-fork.1 -> 1.4.271-fork.2
   node config/scripts/fork/fork-version.mjs --base 1.4.272 # after merging upstream v1.4.272
   git commit -am "chore(release): 1.4.271-fork.2" && git push fork fork-main
   ```

2. Run `Fork release`: `gh workflow run fork-release.yml --ref fork-main -f publish=true`. It
   builds the macOS arm64 DMG and zip and the Linux x64 `.deb` and AppImage, then creates release
   `v<version>` with `latest-mac.yml` and `latest-linux.yml`. With `publish=false` it only
   attaches the files to the run; pushing to `fork-release-check` does the same. It refuses a version
   that is not `X.Y.Z-fork.N` or whose release exists. Release notes list the `feat`, `fix`/`perf`
   and `merge` commit subjects since the previous release.

## How updates reach the apps

The workflow bakes `ORCA_DESKTOP_UPDATE_REPOSITORY` (this repo) into the build. Every release
feed, download and build picker then reads this repo only.

On macOS the build is self-signed, and Squirrel.Mac installs only Developer ID builds. When the
fork has a newer release, the update button reads **Download fork build** and opens the release
page; download the DMG and drag Orca over the installed app. Nothing installs on its own.

When upstream has a newer stable release that the fork has not built yet, Settings → Updates and
the update card say "Orca X is out. The fork build is being made". If the open `upstream-sync` issue
names that version, or the latest `Fork upstream sync` or `Fork release` run failed, they say the
fork build failed and link to it instead. If `gh` is signed in, the app also dispatches the sync
workflow.

The Linux server package updates from this repo's `latest-linux.yml` like an official one.

## Upstream sync

`Fork upstream sync` (`.github/workflows/fork-sync.yml`) runs hourly and on demand. When
upstream's latest stable release is newer than the fork's base, it merges upstream `main` into
`fork-main`. A conflict on the `package.json` version line resolves to ours. The workflow then
typechecks (`pnpm tc`), runs the test files the fork adds or changes, bumps to
`<upstream>-fork.1`, pushes and starts `Fork release`.

On a conflict or a failing check nothing is pushed or released. An issue labelled `upstream-sync`,
titled `Sync com o Orca original falhou: vX`, lists the upstream version and commit, the
conflicting files or the failed step, and the run link. A second failure for the same version
comments on the open issue. A later run that pushes vX, or finds `fork-main` already on it, closes
the issue. Every `gh` call acts on this repo through `GH_REPO`: the merge adds an `upstream`
remote, which `gh` would otherwise pick.

Every run also disables any active workflow other than `fork-release.yml` and `fork-sync.yml`,
since workflows that arrive from upstream start out enabled.

Schedules run only on the default branch, so `fork-main` must be the default branch. As of
2026-11-23 the hourly schedule has never fired in this fork, although `fork-main` is the default
branch, Actions are on and the workflow reads `active`. Changing the `cron` line and disabling and
enabling the workflow did not help. GitHub turns schedules off by default in forks of public repos,
and the Actions tab may offer a switch the API does not show. Until a scheduled run appears in
`gh run list --workflow fork-sync.yml --event schedule`, syncs start when an installed app checks
for updates, or by hand.

Each sync first re-enables `fork-release.yml` if anything disabled it, and says so in the run summary.

Before merging, a sync checks that `release/fork-next` (where fork work may wait before it reaches
`fork-main`) is already in `fork-main`. If it is not, nothing is merged, pushed or released, and the
`upstream-sync` issue says so: merge `release/fork-next` into `fork-main`, then run the sync again.
On 2026-11-24 a sync released `1.4.273-fork.1` from a `fork-main` that lacked that branch's work.

## GitHub secrets

Add these under Settings → Secrets and variables → Actions, with `gh secret set NAME` or the web
UI. Never paste them into a chat or commit them.

| Secret                      | Value                                                                      |
| --------------------------- | -------------------------------------------------------------------------- |
| `FORK_MAC_SIGNING_P12`      | Base64 of a self-signed code signing .p12 (`base64 -i cert.p12 \| pbcopy`) |
| `FORK_MAC_SIGNING_PASSWORD` | Its .p12 password                                                          |
| `FORK_SYNC_TOKEN`           | Fine-grained token for this repo with Contents and Workflows write         |

`FORK_SYNC_TOKEN` is needed because `GITHUB_TOKEN` may not push merges that change
`.github/workflows`, and upstream changes them often. Without it those syncs fail at the push and
open an issue.

macOS ties permission grants (Screen Recording, Accessibility, Full Disk Access) to the signing
certificate, so every release must use the same one. A certificate needs no Apple account:
`openssl req -x509 -newkey rsa:3072 -nodes -days 9125` with `extendedKeyUsage=critical,codeSigning`,
then `openssl pkcs12 -export -legacy`. Keep the .p12 safe: secrets cannot be read back. A new
certificate costs one more round of permission prompts.
