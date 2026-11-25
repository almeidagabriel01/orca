import { buildExecutionHostRegistry } from './execution-host-registry'
import type { ExecutionHostRegistryEntry } from './execution-host-registry-entry'
import { parseExecutionHostId } from './execution-host'

type RegistryArgs = Parameters<typeof buildExecutionHostRegistry>[0]

/**
 * Hosts that run the heavy queue: this computer and paired Orca servers, one row per server.
 * SSH targets (every ~/.ssh/config alias) have no queue RPC, so a "Run on" there would never route.
 */
export function buildHeavyRunHostRegistry(args: RegistryArgs): ExecutionHostRegistryEntry[] {
  const hosts = buildExecutionHostRegistry({ ...args, hostSource: 'configured-only' })
  const byServer = new Map<string, ExecutionHostRegistryEntry>()
  const result: ExecutionHostRegistryEntry[] = []
  for (const host of hosts) {
    if (host.kind === 'local') {
      result.push(host)
      continue
    }
    const parsed = parseExecutionHostId(host.id)
    if (parsed?.kind !== 'runtime') {
      continue
    }
    // Why runtimeId: the same server paired by alias and by IP is two environments, one machine.
    const runtimeId = args.runtimeStatusByEnvironmentId?.get(parsed.environmentId)?.status
      ?.runtimeId
    if (!runtimeId) {
      result.push(host)
      continue
    }
    const kept = byServer.get(runtimeId)
    if (!kept) {
      byServer.set(runtimeId, host)
      result.push(host)
    } else if (kept.health !== 'available' && host.health === 'available') {
      byServer.set(runtimeId, host)
      result[result.indexOf(kept)] = host
    }
  }
  return result
}
