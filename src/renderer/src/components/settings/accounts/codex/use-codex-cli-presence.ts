import { providerSignInState } from '../../../../lib/provider-accounts/provider-cli-presence'
import type { RuntimeClientTarget } from '../../../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import { useAgentCliPresence, type AgentCliPresence } from '../provider-not-installed'

type CodexAuthWarning = 'missing-sign-in' | 'stale-sign-in' | null

/** The shown host's CLI inventory, with Codex sign-in errors gated on the Codex CLI being there. */
export function useCodexCliPresence(
  owner: RuntimeClientTarget,
  accountRuntime: { runtime: 'host' | 'wsl' },
  authWarning: CodexAuthWarning,
  hasLogin: boolean
): {
  cliPresence: AgentCliPresence
  /** The host has no Codex CLI and no Codex login Orca can see. */
  codexCliMissing: boolean
  /** The warning to show: none where the CLI is absent. */
  activeCodexAuthWarning: CodexAuthWarning
  systemCodexMissingSignIn: boolean
} {
  const cliPresence = useAgentCliPresence(owner, accountRuntime.runtime)
  const installed = cliPresence.installed('codex')
  const state = providerSignInState(installed, Boolean(authWarning))
  const shown = state === 'needs-sign-in' ? authWarning : null
  return {
    cliPresence,
    codexCliMissing: providerSignInState(installed, !hasLogin) === 'not-installed',
    activeCodexAuthWarning: shown,
    systemCodexMissingSignIn: shown === 'missing-sign-in'
  }
}
