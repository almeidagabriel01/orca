import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setAppEnvironment } from '../../../shared/app-lifecycle/app-environment'
import {
  assertAdoptedSourceIdentity,
  resolveAdoptedTranscriptFolder
} from '../../native-chat/agent-session-journal/history-import/adopted-transcript-source'
import { hostPathsForRecordedCwd, readSessionHostPathMap } from './session-host-path-map'
import { resolveAiVaultScopeRealPaths } from './session-scope-real-paths'

const OTHER_HOST_APP = '/Users/u/dev/app'
let dir: string
let workspace: string

beforeEach(async () => {
  dir = await realpath(await mkdtemp(join(tmpdir(), 'session-host-path-map-')))
  workspace = join(dir, 'projects', 'app')
  await mkdir(join(workspace, 'src'), { recursive: true })
  setAppEnvironment({
    getPath: () => dir,
    getAppPath: () => dir,
    getVersion: () => '0.0.0',
    isPackaged: () => false,
    onWillQuit: () => {},
    exit: () => {},
    getAppMetrics: () => []
  })
  await writeFile(
    join(dir, 'session-path-map.json'),
    JSON.stringify({
      version: 1,
      aliases: [
        { local: workspace, foreign: [OTHER_HOST_APP] },
        { local: '/Users/u/dev/web', foreign: ['/home/u/workspaces/web/*'] }
      ]
    })
  )
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('session host path map', () => {
  it('maps recorded cwds to this host by whole segments, worktree parents by child', async () => {
    const links = await readSessionHostPathMap()
    expect(hostPathsForRecordedCwd(`${OTHER_HOST_APP}/src`, links)).toEqual([
      join(workspace, 'src')
    ])
    expect(hostPathsForRecordedCwd(`${OTHER_HOST_APP}X`, links)).toEqual([])
    expect(hostPathsForRecordedCwd('/home/u/workspaces/web/wt/apps', links)).toEqual([
      '/Users/u/dev/web/apps'
    ])
    expect(hostPathsForRecordedCwd('/home/u/workspaces/web', links)).toEqual([])
    const scope = await resolveAiVaultScopeRealPaths([workspace])
    expect(scope.scanScopePaths).toEqual([workspace, OTHER_HOST_APP])
  })

  it('never adopts a transcript recorded on another machine, but keeps importing an adopted one', async () => {
    const id = '11111111-2222-4333-8444-555555555555'
    const transcript = (cwd: string) => {
      const filePath = join(dir, `${id}.jsonl`)
      return writeFile(filePath, `${JSON.stringify({ type: 'user', sessionId: id, cwd })}\n`).then(
        () => filePath
      )
    }
    const source = { providerSessionId: id, workspaceCwd: workspace }
    const adopt = async (cwd: string) =>
      resolveAdoptedTranscriptFolder({ agent: 'claude', filePath: await transcript(cwd), source })
    await expect(adopt(workspace)).resolves.toBe(workspace)
    await expect(adopt(OTHER_HOST_APP)).rejects.toMatchObject({
      refusal: { details: { otherFolder: true } }
    })
    await expect(adopt(`${OTHER_HOST_APP}/src`)).rejects.toMatchObject({
      refusal: { details: { otherFolder: true } }
    })
    await expect(
      assertAdoptedSourceIdentity(source, { sessionId: id, cwd: OTHER_HOST_APP })
    ).resolves.toBeUndefined()
  })
})
