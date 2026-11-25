import { useSyncExternalStore } from 'react'
import type { HeavyJobMoveBlocker } from '../../../../../../shared/diagnostics/heavy-job-move-types'
import type { HeavyCommandJob } from '../../../../../../shared/diagnostics/process-stats-types'
import type {
  HeavyJobMoveCheckResult,
  HeavyJobMovePlan,
  HeavyMoveHost
} from './resource-heavy-job-move'

export type HeavyJobRoute = {
  key: string
  source: HeavyMoveHost
  target: HeavyMoveHost
  job: HeavyCommandJob
}

/** Why a routed job stayed where it started; the row says it. */
export type HeavyJobRouteNote = { targetLabel: string; blockers: HeavyJobMoveBlocker[] }

// Why queuedAt too: a pid can come back for another job.
export function heavyJobRouteKey(hostId: string, job: HeavyCommandJob): string {
  return `${hostId}\n${job.pid}\n${job.queuedAt}`
}

/**
 * Waiting jobs the run-host preference sends elsewhere, each at most once ever (tried).
 * preferredHostId answers a host card id, or null when no preference applies to the job.
 */
export function pickHeavyJobRoutes(
  hosts: readonly HeavyMoveHost[],
  tried: ReadonlySet<string>,
  preferredHostId: (host: HeavyMoveHost, job: HeavyCommandJob) => string | null
): HeavyJobRoute[] {
  const routes: HeavyJobRoute[] = []
  for (const source of hosts) {
    for (const job of source.queue.jobs) {
      const key = heavyJobRouteKey(source.id, job)
      if (job.status !== 'waiting' || job.movedFrom || tried.has(key)) {
        continue
      }
      const targetId = preferredHostId(source, job)
      // Why wait for the target's sample: deciding before it arrives would record a wrong reason forever.
      const target = targetId === source.id ? undefined : hosts.find((host) => host.id === targetId)
      if (target) {
        routes.push({ key, source, target, job })
      }
    }
  }
  return routes
}

/** Checks, then moves; any refusal or failure becomes the row's note. Never runs twice for a job. */
export async function runHeavyJobRoute(
  route: HeavyJobRoute,
  tried: Set<string>,
  io: {
    check: (
      source: HeavyMoveHost,
      target: HeavyMoveHost,
      job: HeavyCommandJob
    ) => Promise<HeavyJobMoveCheckResult>
    execute: (
      source: HeavyMoveHost,
      target: HeavyMoveHost,
      pid: number,
      plan: HeavyJobMovePlan
    ) => Promise<HeavyJobMoveBlocker[]>
    note: (key: string, note: HeavyJobRouteNote) => void
    errorText: (error: unknown) => string
  }
): Promise<void> {
  const { key, source, target, job } = route
  if (tried.has(key)) {
    return
  }
  tried.add(key)
  let blockers: HeavyJobMoveBlocker[]
  try {
    const check = await io.check(source, target, job)
    blockers = check.ok ? await io.execute(source, target, job.pid, check.plan) : check.blockers
  } catch (error) {
    const detail = io.errorText(error)
    blockers = [detail ? { code: 'host_unreachable', detail } : { code: 'host_unreachable' }]
  }
  if (blockers.length > 0) {
    io.note(key, { targetLabel: target.label, blockers })
  }
}

// Why app-lifetime: a job is tried once per run of Orca; a few strings per job ever seen.
export const triedHeavyJobRoutes = new Set<string>()
const notes = new Map<string, HeavyJobRouteNote>()
const listeners = new Set<() => void>()

export function setHeavyJobRouteNote(key: string, note: HeavyJobRouteNote): void {
  notes.set(key, note)
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useHeavyJobRouteNote(
  hostId: string,
  job: HeavyCommandJob
): HeavyJobRouteNote | undefined {
  const key = heavyJobRouteKey(hostId, job)
  return useSyncExternalStore(subscribe, () => notes.get(key))
}
