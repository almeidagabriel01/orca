import { realpath } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import type {
  AiVaultListResult,
  AiVaultSession
} from '../../../shared/ai-vault/contracts/ai-vault-types'
import { normalizeRuntimePathForComparison } from '../../../shared/file-access/cross-platform-path'
import { sessionFileExecutionNamespace } from '../../../shared/ai-vault/scanning/ai-vault-scope-cwd-match'
import { parseWslUncPath } from '../../../shared/file-access/wsl-paths'
import {
  hostPathsForRecordedCwd,
  readSessionHostPathMap,
  recordedSpellingsForHostPath,
  type AiVaultScopeLink
} from './session-host-path-map'

export type AiVaultScopeRealPaths = {
  /** Admit both registered spellings and resolved paths. */
  scanScopePaths: readonly string[]
  links: readonly AiVaultScopeLink[]
}

/** Resolve on the execution host so links refer to the filesystem that recorded each cwd. */
export async function resolveAiVaultScopeRealPaths(
  scopePaths: readonly string[],
  hostPathMap?: readonly AiVaultScopeLink[]
): Promise<AiVaultScopeRealPaths> {
  const links: AiVaultScopeLink[] = []
  const mapped = hostPathMap ?? (await readSessionHostPathMap())
  for (const scopePath of scopePaths) {
    // Windows cannot resolve Linux symlinks through a WSL UNC share.
    if (!isAbsolute(scopePath) || parseWslUncPath(scopePath)) {
      continue
    }
    const realPath = await realpath(scopePath).catch(() => null)
    if (realPath && !sameComparisonPath(realPath, scopePath)) {
      links.push({ scopePath, realPath })
    }
  }
  const scanScopePaths = [...scopePaths]
  const recordedSpellings = [
    ...links.map(({ realPath }) => realPath),
    ...scopePaths.flatMap((scopePath) => recordedSpellingsForHostPath(scopePath, mapped))
  ]
  for (const spelling of recordedSpellings) {
    if (!scanScopePaths.some((path) => sameComparisonPath(path, spelling))) {
      scanScopePaths.push(spelling)
    }
  }
  // Host-wide, so project grouping places synced transcripts without a scope too.
  return { scanScopePaths, links: [...links, ...mapped] }
}

/** Add matching-only aliases without resolving arbitrary cwds on network mounts or protected folders. */
export function attachAiVaultScopeCwdAliases(
  result: AiVaultListResult,
  scope: AiVaultScopeRealPaths
): AiVaultListResult {
  if (scope.links.length === 0) {
    return result
  }
  const hostLinks = scope.links.filter((link) => !link.otherMachine)
  const aliasesByCwd = new Map<string, { aliases: string[]; otherMachine: boolean }>()
  let changed = false
  const sessions: AiVaultSession[] = []
  for (const session of result.sessions) {
    const cwd = session.cwd
    // Windows cannot resolve the Linux cwds carried by WSL rows.
    if (!cwd || !isAbsolute(cwd) || sessionFileExecutionNamespace(session.filePath) !== 'native') {
      sessions.push(session)
      continue
    }
    let match = aliasesByCwd.get(cwd)
    if (!match) {
      const aliases = hostPathsForRecordedCwd(cwd, scope.links)
      // Only the path map places it here: the transcript was synced from the machine that recorded it.
      const otherMachine =
        aliases.length > 0 && hostPathsForRecordedCwd(cwd, hostLinks).length === 0
      match = { aliases, otherMachine }
      aliasesByCwd.set(cwd, match)
    }
    if (match.aliases.length === 0) {
      sessions.push(session)
      continue
    }
    changed = true
    sessions.push({
      ...session,
      cwdAliases: match.aliases,
      ...(match.otherMachine ? { recordedOnOtherMachine: true as const } : {})
    })
  }
  return changed ? { ...result, sessions } : result
}

function sameComparisonPath(left: string, right: string): boolean {
  return normalizeRuntimePathForComparison(left) === normalizeRuntimePathForComparison(right)
}
