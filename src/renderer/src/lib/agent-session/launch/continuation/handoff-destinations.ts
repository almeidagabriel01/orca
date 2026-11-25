import {
  normalizeExecutionHostId,
  toRuntimeExecutionHostId,
  type ExecutionHostId
} from '../../../../../../shared/execution-host/execution-host'
import type { ExecutionHostRegistryEntry } from '../../../../../../shared/execution-host/execution-host-registry-entry'
import type { Worktree } from '../../../../../../shared/worktree/types'
import { branchName } from '@/lib/source-control/branches/branch-name'
import type { ProjectHostSetupOption } from '@/lib/workspace/creation/project-host-setup-options'
import { selectWorktreesByRepo } from '@/store/workspaces/catalog/workspace-record-fields'

/** Why a destination cannot be picked; the dialog spells each one out next to its row. */
export type HandoffDestinationBlock =
  | { kind: 'host-unavailable'; detail: string }
  | { kind: 'project-missing'; detail: string }
  /** Creatable: the project is on that host, just not this branch; `repoId` is that host's repo. */
  | { kind: 'branch-missing'; repoId: string }
  | { kind: 'folder-source' }
  | { kind: 'detached-source' }

/** The chat's workspace (`current`), or the workspace holding the same branch on another host. */
export type HandoffDestination = {
  key: string
  hostId: ExecutionHostId
  hostLabel: string
  kind: 'current' | 'same-branch'
  /** Null only on blocked rows: there is no workspace to open there. */
  worktreeId: string | null
  worktreePath: string | null
  workspaceLabel: string
  branch: string | null
  block: HandoffDestinationBlock | null
}

export type HandoffDestinationInput = {
  source: Pick<Worktree, 'id' | 'path' | 'branch' | 'displayName'>
  sourceHostId: ExecutionHostId
  sourceIsFolder: boolean
  /** `buildProjectHostSetupOptions` for the source's project. */
  hostOptions: readonly ProjectHostSetupOption[]
  hosts: readonly Pick<ExecutionHostRegistryEntry, 'id' | 'kind' | 'health'>[]
  worktreesByRepo: Readonly<Record<string, readonly Worktree[] | undefined>>
  hostUnavailableDetail: (host: Pick<ExecutionHostRegistryEntry, 'health'>) => string | null
}

/** Rows in display order: the current workspace first, then one row per other local/paired host. */
export function buildHandoffDestinations(input: HandoffDestinationInput): HandoffDestination[] {
  const sourceBranch = input.source.branch ? branchName(input.source.branch) : null
  const hostById = new Map(input.hosts.map((host) => [host.id, host]))
  const rows: HandoffDestination[] = [
    {
      key: `current:${input.source.id}`,
      hostId: input.sourceHostId,
      hostLabel:
        input.hostOptions.find((option) => option.hostId === input.sourceHostId)?.label ??
        input.sourceHostId,
      kind: 'current',
      worktreeId: input.source.id,
      worktreePath: input.source.path,
      workspaceLabel: input.source.displayName,
      branch: sourceBranch,
      block: null
    }
  ]
  for (const option of input.hostOptions) {
    const host = hostById.get(option.hostId)
    // Only this Mac and paired servers; direct SSH hosts are out of scope.
    const isSourceHost =
      option.hostId === input.sourceHostId ||
      (option.kind === 'ready' &&
        option.aliasSetups?.some((alias) => alias.hostId === input.sourceHostId))
    if (isSourceHost || host?.kind === 'ssh') {
      continue
    }
    const base = {
      key: `host:${option.hostId}`,
      hostId: option.hostId,
      hostLabel: option.label,
      kind: 'same-branch' as const,
      branch: sourceBranch
    }
    if (option.kind === 'needs-setup') {
      rows.push({
        ...base,
        worktreeId: null,
        worktreePath: null,
        workspaceLabel: sourceBranch ?? input.source.displayName,
        block: { kind: 'project-missing', detail: option.detail }
      })
      continue
    }
    // A repo id can be shared across hosts; legacy rows without a host belong to the setup's.
    const target = sourceBranch
      ? (selectWorktreesByRepo(input)[option.repoId] ?? []).find(
          (worktree) =>
            !worktree.isArchived &&
            worktreeOwnerHostId(worktree, option.hostId) === option.hostId &&
            worktree.branch !== '' &&
            branchName(worktree.branch) === sourceBranch
        )
      : undefined
    const unavailable = host ? input.hostUnavailableDetail(host) : null
    const block: HandoffDestinationBlock | null = input.sourceIsFolder
      ? { kind: 'folder-source' }
      : !sourceBranch
        ? { kind: 'detached-source' }
        : unavailable
          ? { kind: 'host-unavailable', detail: unavailable }
          : target
            ? null
            : { kind: 'branch-missing', repoId: option.repoId }
    rows.push({
      ...base,
      worktreeId: target?.id ?? null,
      worktreePath: target?.path ?? null,
      workspaceLabel: target?.displayName ?? sourceBranch ?? input.source.displayName,
      block
    })
  }
  return rows
}

/** The row a hand-off starts at for `key`; a blocked or unknown key falls back to the current row. */
export function resolveHandoffDestination(
  destinations: readonly HandoffDestination[] | null | undefined,
  key: string | undefined
): HandoffDestination | undefined {
  return destinations?.find((row) => row.key === key && !row.block) ?? destinations?.[0]
}

// Same precedence as findWorktreeById: the paired runtime serving the row wins over the stamped host.
function worktreeOwnerHostId(
  worktree: Pick<Worktree, 'hostId' | 'runtimeOwnerEnvironmentId'>,
  fallback: ExecutionHostId
): ExecutionHostId {
  const runtimeOwner = worktree.runtimeOwnerEnvironmentId?.trim()
  return runtimeOwner
    ? toRuntimeExecutionHostId(runtimeOwner)
    : (normalizeExecutionHostId(worktree.hostId) ?? fallback)
}
