import type { HeavyCommandQueue } from '../../../../../shared/diagnostics/process-stats-types'
import {
  hasRunHostPreference,
  type ProjectRunHostSettings
} from '../../../../../shared/execution-host/project-run-host-preference'
import { parseHeavyCommandQueue } from '../host-connections/heavy-command-queue-parse'
import { hasErrorCode } from '../host-connections/runtime-host-resources'

/** Host card id ('local' or a paired environment id) with its latest queue. */
export type PolledHeavyQueue = { id: string; queue: HeavyCommandQueue }

/**
 * One read of every candidate host's queue; no host is asked without a preference or a second host.
 * A host lacking the method is remembered in unsupported and never asked again.
 */
export async function pollHeavyQueues(
  settings: ProjectRunHostSettings | null | undefined,
  hostIds: readonly string[],
  read: (hostId: string) => Promise<unknown>,
  unsupported: Set<string>
): Promise<PolledHeavyQueue[]> {
  const asked = hostIds.filter((id) => !unsupported.has(id))
  if (!hasRunHostPreference(settings) || asked.length < 2) {
    return []
  }
  const replies = await Promise.all(
    asked.map(async (id): Promise<PolledHeavyQueue[]> => {
      try {
        const queue = parseHeavyCommandQueue(await read(id))
        return queue ? [{ id, queue }] : []
      } catch (error) {
        if (hasErrorCode(error, 'method_not_found')) {
          unsupported.add(id)
        }
        return []
      }
    })
  )
  return replies.flat()
}
