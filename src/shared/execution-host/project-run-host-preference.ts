import type { ExecutionHostId } from './execution-host'
import type { ProjectHostSetup } from '../project/project-types'

/** Project id -> host new workspaces default to. Client-owned: host ids are client-relative. */
export type ProjectRunHostIds = Partial<Record<string, ExecutionHostId>>

export type ProjectRunHostSettings = { projectRunHostIds?: ProjectRunHostIds }

/** Matches the project's setups on its saved "Run on" host; null when none is saved. */
export function runHostPreferenceFilter(
  projectRunHostIds: ProjectRunHostIds | null | undefined,
  projectId: string | null | undefined
): ((setup: ProjectHostSetup) => boolean) | null {
  const hostId = projectId ? projectRunHostIds?.[projectId] : undefined
  if (!hostId) {
    return null
  }
  return (setup) => setup.projectId === projectId && setup.hostId === hostId
}
