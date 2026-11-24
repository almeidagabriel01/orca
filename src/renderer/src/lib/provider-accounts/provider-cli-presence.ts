import type { TuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent'

/**
 * Whether a host's agent inventory (the one Settings > Agents shows) lists this CLI.
 * Null while the inventory is loading; a failed probe counts as installed so real sign-in errors still show.
 */
export function agentCliInstalled(
  detected: readonly TuiAgent[] | null,
  detectionFailed: boolean,
  agent: TuiAgent
): boolean | null {
  if (detected) {
    return detected.includes(agent)
  }
  return detectionFailed ? true : null
}

export type ProviderSignInState = 'not-installed' | 'needs-sign-in' | 'ready'

/** A missing sign-in is only an error where the CLI exists; with no CLI and no login it is neutral. */
export function providerSignInState(
  installed: boolean | null,
  needsSignIn: boolean
): ProviderSignInState {
  if (!needsSignIn) {
    // Why: a working login (custom command, leftover home) stays usable even when no CLI is listed.
    return 'ready'
  }
  if (installed === false) {
    return 'not-installed'
  }
  // Why: while the inventory loads, stay quiet instead of flashing an error that may vanish.
  return installed === true ? 'needs-sign-in' : 'ready'
}
