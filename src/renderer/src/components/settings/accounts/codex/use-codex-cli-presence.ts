import { useDetectedAgents } from '@/lib/agent-session/launch/inventory/useDetectedAgents'
import {
  agentCliInstalled,
  providerSignInState
} from '../../../../lib/provider-accounts/provider-cli-presence'

type CodexAuthWarning = 'missing-sign-in' | 'stale-sign-in' | null

/** Gate Codex sign-in errors on the CLI being on the shown host, read from Settings > Agents' inventory. */
export function useCodexCliPresence(
  environmentId: string | null,
  accountRuntime: { runtime: 'host' | 'wsl' },
  authWarning: CodexAuthWarning
): {
  codexCliMissing: boolean
  /** The warning to show: none where the CLI is absent. */
  activeCodexAuthWarning: CodexAuthWarning
  systemCodexMissingSignIn: boolean
  refreshCodexDetection: () => Promise<unknown>
} {
  const detection = useDetectedAgents(
    environmentId ? { kind: 'runtime', environmentId } : { kind: 'local' },
    'all'
  )
  // ponytail: the host inventory cannot speak for a WSL distro, so WSL keeps the sign-in check as is.
  const installed =
    accountRuntime.runtime === 'wsl'
      ? true
      : agentCliInstalled(detection.detectedIds, detection.detectionFailed, 'codex')
  const state = providerSignInState(installed, Boolean(authWarning))
  const shown = state === 'needs-sign-in' ? authWarning : null
  return {
    codexCliMissing: state === 'not-installed',
    activeCodexAuthWarning: shown,
    systemCodexMissingSignIn: shown === 'missing-sign-in',
    refreshCodexDetection: detection.refresh
  }
}
