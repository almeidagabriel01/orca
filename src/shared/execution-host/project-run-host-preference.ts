import type { ExecutionHostId } from './execution-host'
import type { ProjectHostSetup } from '../project/project-types'

/** Project id -> host its work defaults to; absent = the global default. Client-owned: host ids are client-relative. */
export type ProjectRunHostIds = Partial<Record<string, ExecutionHostId>>

export type ProjectRunHostSettings = {
  projectRunHostIds?: ProjectRunHostIds
  /** "Run heavy work on": null = automatic (no preference). */
  heavyRunHostDefault?: ExecutionHostId | null
}

/** What the preference readers need; null project map = none saved. */
type RunHostPreferenceInput = {
  projectRunHostIds?: ProjectRunHostIds | null
  heavyRunHostDefault?: ExecutionHostId | null
}

export type RunHostPreferenceSource = 'project' | 'global'

export type RunHostFallbackReason = 'project_missing' | 'host_unavailable'

export type EffectiveRunHost = {
  hostId: ExecutionHostId
  source: RunHostPreferenceSource
  fallbackFrom?: { hostId: ExecutionHostId; reason: RunHostFallbackReason }
}

/** The saved preference, ignoring availability: project value, else the global default. */
export function getPreferredRunHostId(
  settings: RunHostPreferenceInput | null | undefined,
  projectId: string | null | undefined
): { hostId: ExecutionHostId; source: RunHostPreferenceSource } | null {
  const projectHostId = projectId ? settings?.projectRunHostIds?.[projectId] : undefined
  if (projectHostId) {
    return { hostId: projectHostId, source: 'project' }
  }
  const globalHostId = settings?.heavyRunHostDefault
  return globalHostId ? { hostId: globalHostId, source: 'global' } : null
}

/**
 * Project value if available, else the global default if available, else null.
 * availableHostIds = hosts where this project is ready; reachableHostIds (optional) tells a
 * host the client can't reach apart from one the project isn't on.
 */
export function getEffectiveRunHostId(
  settings: RunHostPreferenceInput | null | undefined,
  projectId: string | null | undefined,
  availableHostIds: Iterable<ExecutionHostId>,
  reachableHostIds?: Iterable<ExecutionHostId>
): EffectiveRunHost | null {
  const available = new Set(availableHostIds)
  const reachable = reachableHostIds ? new Set(reachableHostIds) : null
  const projectHostId = projectId ? settings?.projectRunHostIds?.[projectId] : undefined
  const globalHostId = settings?.heavyRunHostDefault ?? undefined
  let fallbackFrom: EffectiveRunHost['fallbackFrom']
  for (const [hostId, source] of [
    [projectHostId, 'project'],
    [globalHostId, 'global']
  ] as const) {
    if (!hostId) {
      continue
    }
    if (available.has(hostId)) {
      return fallbackFrom ? { hostId, source, fallbackFrom } : { hostId, source }
    }
    fallbackFrom ??= {
      hostId,
      reason: reachable && !reachable.has(hostId) ? 'host_unavailable' : 'project_missing'
    }
  }
  return null
}

/** Matches the project's setups on its effective "Run on" host; null when none applies. */
export function effectiveRunHostSetupFilter(
  settings: RunHostPreferenceInput | null | undefined,
  projectId: string | null | undefined,
  setups: readonly ProjectHostSetup[]
): ((setup: ProjectHostSetup) => boolean) | null {
  const readyHostIds = setups
    .filter((setup) => setup.projectId === projectId && setup.setupState === 'ready')
    .map((setup) => setup.hostId)
  const hostId = projectId ? getEffectiveRunHostId(settings, projectId, readyHostIds)?.hostId : null
  return hostId ? (setup) => setup.projectId === projectId && setup.hostId === hostId : null
}

/** Whether any "Run on" preference is saved; a cleared project leaves an empty map behind. */
export function hasRunHostPreference(settings: RunHostPreferenceInput | null | undefined): boolean {
  return Boolean(
    settings?.heavyRunHostDefault || Object.values(settings?.projectRunHostIds ?? {}).some(Boolean)
  )
}
