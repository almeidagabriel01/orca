import { mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { durableWriteTempPath, writeFileDurable } from '../../../filesystem/durable-file-write'
import type { ClaudeProfileRouter } from './claude-profile-router'
import type { ClaudeAccountSelectionTarget } from '../../selection/runtime-selection'
import {
  getClaudeProfileRouter,
  withClaudeProfileTerminalEnv
} from './claude-profile-installed-router'

/** The host pointer, or the own pointer of a launch pinned to `accountChoice`, so the host's
 *  selection can't reroute it. */
export function choicePointerPath(hostPointerPath: string, accountChoice?: string): string {
  return accountChoice === undefined
    ? hostPointerPath
    : join(dirname(hostPointerPath), `chosen-${accountChoice}`)
}

/** Publish `accountChoice`'s routed home (empty for System default) for a pane's `claude`, which
 *  reads it on every run. Must precede any env naming that pointer. */
export async function publishChoicePointer(
  router: Pick<ClaudeProfileRouter, 'pointerPath' | 'routedHome'>,
  accountChoice: string | undefined
): Promise<void> {
  if (accountChoice === undefined) {
    return
  }
  const path = choicePointerPath(router.pointerPath, accountChoice)
  const home = router.routedHome('identity', accountChoice) ?? ''
  // Avoid rewriting the pointer on every launch.
  if ((await readFile(path, 'utf8').catch(() => undefined)) === home) {
    return
  }
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  await writeFileDurable(durableWriteTempPath(path), path, home, 0o600)
}

/** Publishes the project account's pointer before naming it; if that fails, the pane follows the host. */
export async function withClaudeProfileProjectTerminalEnv<
  Env extends Record<string, string> | undefined
>(
  env: Env,
  target: ClaudeAccountSelectionTarget,
  accountChoice: string | undefined
): Promise<Env | Record<string, string>> {
  const router = getClaudeProfileRouter()
  const published =
    accountChoice !== undefined &&
    target.runtime !== 'wsl' &&
    router !== undefined &&
    (await publishChoicePointer(router, accountChoice).then(
      () => true,
      () => false
    ))
  return withClaudeProfileTerminalEnv(env, target, published ? accountChoice : undefined)
}
