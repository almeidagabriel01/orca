import { readFile, stat } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { z } from 'zod'
import { getAppEnvironment, hasAppEnvironment } from '../../../shared/app-lifecycle/app-environment'
import { relativePathInsideRoot } from '../../../shared/file-access/cross-platform-path'
import { lazyZodSchema } from '../../../shared/schema/lazy-zod-schema'

/** A folder recorded by another machine (realPath) that this host holds as scopePath. */
export type AiVaultScopeLink = {
  scopePath: string
  realPath: string
  /** realPath is a parent whose every direct child (one worktree each) maps to scopePath. */
  anyChild?: boolean
  /** From session-path-map.json: realPath is another machine's folder, not a link on this host. */
  otherMachine?: true
}

const SESSION_HOST_PATH_MAP_FILE = 'session-path-map.json'

const sessionHostPathMapSchema = lazyZodSchema(() =>
  z.object({
    version: z.literal(1),
    aliases: z.array(z.object({ local: z.string(), foreign: z.array(z.string()) }))
  })
)

/** Transcripts synced from another machine keep its cwds; this host's own file says where they live here. */
export async function readSessionHostPathMap(filePath?: string): Promise<AiVaultScopeLink[]> {
  // A host without app paths (a bare worker) has no map; never fail the caller's listing or adoption.
  if (!filePath && !hasAppEnvironment()) {
    return []
  }
  const path = filePath ?? join(getAppEnvironment().getPath('userData'), SESSION_HOST_PATH_MAP_FILE)
  let raw: unknown
  try {
    raw = JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      return []
    }
  }
  const parsed = sessionHostPathMapSchema.safeParse(raw)
  if (!parsed.success) {
    console.warn(`[ai-vault] Ignoring invalid ${SESSION_HOST_PATH_MAP_FILE}`)
    return []
  }
  const links: AiVaultScopeLink[] = []
  for (const { local, foreign } of parsed.data.aliases) {
    if (!isAbsolute(local)) {
      continue
    }
    for (const spelling of foreign) {
      const anyChild = spelling.endsWith('/*')
      const realPath = anyChild ? spelling.slice(0, -2) : spelling
      // A spelling of the local folder itself names no other machine.
      if (
        isAbsolute(realPath) &&
        !realPath.includes('*') &&
        relativePathInsideRoot(local, realPath) !== ''
      ) {
        links.push({
          scopePath: local,
          realPath,
          otherMachine: true,
          ...(anyChild ? { anyChild } : {})
        })
      }
    }
  }
  return links
}

/** This host's spellings of a recorded cwd, one per link that holds it. */
export function hostPathsForRecordedCwd(cwd: string, links: readonly AiVaultScopeLink[]): string[] {
  const aliases: string[] = []
  for (const { scopePath, realPath, anyChild } of links) {
    let suffix = relativePathInsideRoot(realPath, cwd)
    if (suffix !== null && anyChild) {
      // The worktree folder itself stands for scopePath; only what is below it is kept.
      const segments = suffix.split('/').filter(Boolean)
      suffix = segments.length > 0 ? segments.slice(1).join('/') : null
    }
    if (suffix !== null) {
      aliases.push(suffix ? join(scopePath, suffix) : scopePath)
    }
  }
  return aliases
}

/** A conversation synced from another machine, whose cwd this host's path map places in the workspace.
 *  A sub-folder missing here resumes in the workspace: the agent finds the transcript by id. */
export async function mappedSourceFolder(
  workspaceCwd: string,
  recordedCwd: string
): Promise<string | null> {
  for (const hostPath of hostPathsForRecordedCwd(recordedCwd, await readSessionHostPathMap())) {
    const inside = relativePathInsideRoot(workspaceCwd.trim(), hostPath)
    if (inside === '') {
      return workspaceCwd
    }
    if (inside) {
      const folder = join(workspaceCwd, inside)
      const isFolder = await stat(folder).then(
        (info) => info.isDirectory(),
        () => false
      )
      return isFolder ? folder : workspaceCwd
    }
  }
  return null
}

/** The other machine's spellings of a scope, so its transcripts are scanned for it. */
export function recordedSpellingsForHostPath(
  hostPath: string,
  links: readonly AiVaultScopeLink[]
): string[] {
  const spellings: string[] = []
  for (const { scopePath, realPath, anyChild } of links) {
    const suffix = relativePathInsideRoot(scopePath, hostPath)
    if (suffix === '' || (suffix && !anyChild)) {
      spellings.push(suffix ? join(realPath, suffix) : realPath)
    }
  }
  return spellings
}
