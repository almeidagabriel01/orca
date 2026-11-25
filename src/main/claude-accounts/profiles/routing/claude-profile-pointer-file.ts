import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { writeFileAtomically } from '../../../filesystem/atomic-file-publication'

/** Publish `home` (empty for System default) for a pane's `claude`, which reads it on every run. A
 *  launch pinned to an account gets its own pointer, so the host's selection can't reroute it. */
export function writeClaudeProfilePointer(
  hostPointerPath: string,
  home: string,
  accountChoice?: string
): string {
  const path =
    accountChoice === undefined
      ? hostPointerPath
      : join(dirname(hostPointerPath), `chosen-${accountChoice}`)
  // Avoid rewriting the pointer on every launch.
  if (!existsSync(path) || readFileSync(path, 'utf8') !== home) {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
    writeFileAtomically(path, home, { mode: 0o600 })
  }
  return path
}

/** The host pointer, or `accountChoice`'s own pointer published with its routed home. */
export function claudeProfilePointerFor(
  hostPointerPath: string,
  accountChoice: string | undefined,
  routedHome: (accountChoice: string) => string | undefined
): string {
  return accountChoice === undefined
    ? hostPointerPath
    : writeClaudeProfilePointer(hostPointerPath, routedHome(accountChoice) ?? '', accountChoice)
}
