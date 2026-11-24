import type { UnifiedProjectGroup } from '../workspace-attribution/resource-usage-merge-types'

/**
 * Projects and workspaces whose names, or whose terminals' and chats' names, contain the query.
 * A matching project keeps all its workspaces; otherwise only matching workspaces stay.
 */
export function filterProjectGroups(
  groups: readonly UnifiedProjectGroup[],
  query: string,
  workspaceLabel: (worktreeId: string) => string | undefined = () => undefined
): UnifiedProjectGroup[] {
  const needle = query.trim().toLocaleLowerCase()
  if (needle === '') {
    return [...groups]
  }
  const has = (text: string | null | undefined): boolean =>
    Boolean(text?.toLocaleLowerCase().includes(needle))
  const result: UnifiedProjectGroup[] = []
  for (const group of groups) {
    if (has(group.repoName)) {
      result.push(group)
      continue
    }
    const worktrees = group.worktrees.filter(
      (worktree) =>
        has(worktree.worktreeName) ||
        has(workspaceLabel(worktree.worktreeId)) ||
        has(worktree.hostLabel) ||
        worktree.sessions.some((session) => has(session.label)) ||
        (worktree.chats ?? []).some((chat) => has(chat.name) || has(chat.agent))
    )
    if (worktrees.length > 0) {
      result.push({ ...group, worktrees })
    }
  }
  return result
}
