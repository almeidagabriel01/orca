/** Keep-awake for agents on paired Orca servers (SSH/VPS/network) this desktop is connected to. */
import type { AgentAwakeService } from '../../power/agent-awake-service'
import { WslHostAgentAwake } from '../../power/wsl-host-agent-awake'
import { runWslHostAgentAwakeWhileAuto } from '../../power/wsl-host-agent-awake-mode-gate'
import { createQuietWslHostStreamOpener } from '../wsl/wsl-host-agent-awake-wiring'
import { getRuntimeEnvironmentRegistryRoot } from './catalog/runtime-environment-registry-root'
import { getRuntimeEnvironmentStatusSnapshots } from './connections/runtime-environment-request-connections'
import { onRuntimeEnvironmentStatusPublished } from './status/runtime-environment-status-owner'
import { isRuntimeEnvironmentManuallyDisconnected } from './connectivity/runtime-environment-manual-disconnect'
import { resolveEnvironment } from '../../../shared/remote-runtime/host-store/runtime-environment-store'
import { getPreferredPairedRuntimeConnection } from '../../../shared/remote-runtime/host-catalog/runtime-environments'
import { classifyRuntimeEnvironmentHost } from '../../../shared/remote-runtime/host-catalog/runtime-environment-host-kind'
import { subscribeRemoteRuntimeTransport } from '../../../shared/remote-runtime/requests/remote-runtime-subscription-transport'
import type { RuntimeHostStatusSnapshot } from '../../../shared/remote-runtime/host-status/runtime-host-status'

/** Why only live connections: a host's agents keep this machine awake only while it is that host's
 *  client (the user drives and watches them here); a disconnected or sleeping host never dials. */
function isConnectedPairedHost(snapshot: RuntimeHostStatusSnapshot): boolean {
  return (
    snapshot.retired !== true &&
    snapshot.verification === 'verified' &&
    snapshot.transport === 'ready'
  )
}

export function startPairedHostAgentAwake(service: AgentAwakeService): () => void {
  const openStream = createQuietWslHostStreamOpener({
    resolve: async (environmentId) => {
      const environment = await resolveEnvironment(
        getRuntimeEnvironmentRegistryRoot(),
        environmentId
      )
      // WSL hosts have their own watcher, which also covers stopped distros.
      return classifyRuntimeEnvironmentHost(environment).kind === 'wsl'
        ? null
        : getPreferredPairedRuntimeConnection(environment)
    },
    subscribe: subscribeRemoteRuntimeTransport,
    isManuallyDisconnected: isRuntimeEnvironmentManuallyDisconnected
  })
  return runWslHostAgentAwakeWhileAuto(
    service,
    () =>
      new WslHostAgentAwake({
        listHosts: () =>
          getRuntimeEnvironmentStatusSnapshots().map((snapshot) => ({
            environmentId: snapshot.environmentId,
            state: isConnectedPairedHost(snapshot) ? 'ready' : 'offline'
          })),
        onHostsChanged: (listener) => onRuntimeEnvironmentStatusPublished(() => listener()),
        openStream,
        // Own key space: a stop here reports empty and must not clear the WSL watcher's counts.
        report: (environmentId, statuses) =>
          service.setWslHostStatuses(`paired:${environmentId}`, statuses),
        now: Date.now
      })
  )
}
