import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Repo } from '../../shared/repository/repo-types'
import {
  findHeavyQueueScript,
  scriptSupportsStop,
  attributeHeavyQueueWorkspaces,
  parseHeavyQueueListing,
  readHeavyCommandQueue
} from './host-heavy-command-queue'
import type { MemorySnapshotStore } from './memory-snapshot-buckets'

let home: string

beforeEach(async () => {
  home = await mkdtemp(path.join(os.tmpdir(), 'heavy-queue-'))
})

afterEach(async () => {
  await rm(home, { recursive: true, force: true })
})

async function writeJob(name: string, body: string): Promise<void> {
  const dir = path.join(home, '.cache', 'vps-heavy', 'jobs')
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, name), body)
}

describe('readHeavyCommandQueue', () => {
  it('reports no queue on a host with neither the script nor its jobs', async () => {
    await expect(
      readHeavyCommandQueue({ home, pathEnv: '', platform: 'linux' })
    ).resolves.toBeNull()
  })

  it('drops dead and malformed job files and reads the slot count', async () => {
    await writeJob(
      '11.json',
      '{"pid": 11, "status": "running", "slot": 2, "queuedAt": 100, "startedAt": 130, "cwd": "/w/a", "command": "pnpm build"}'
    )
    await writeJob(
      '12.json',
      '{"pid": 12, "status": "waiting", "slot": 0, "queuedAt": 120, "startedAt": null, "cwd": "/w/b", "command": "pnpm test"}'
    )
    await writeJob('13.json', '{"pid": 13, "status": "running"')
    await writeJob(
      '14.json.tmp',
      '{"pid": 14, "status": "waiting", "queuedAt": 1, "cwd": "/", "command": "x"}'
    )
    await mkdir(path.join(home, '.config', 'vps-heavy'), { recursive: true })
    await writeFile(path.join(home, '.config', 'vps-heavy', 'slots'), '2\n')

    const queue = await readHeavyCommandQueue({
      home,
      pathEnv: '',
      platform: 'darwin',
      isAlive: (pid) => pid === 11
    })

    expect(queue?.slots).toBe(2)
    expect(queue?.controls).toBe(false)
    expect(queue?.jobs).toEqual([
      {
        pid: 11,
        status: 'running',
        slot: 2,
        position: null,
        ordered: false,
        direct: false,
        extra: false,
        queuedAt: 100_000,
        startedAt: 130_000,
        cwd: '/w/a',
        command: 'pnpm build'
      }
    ])
  })

  it.skipIf(process.platform === 'win32')(
    "parses the script's listing, including direct flock holders",
    async () => {
      const bin = path.join(home, 'bin')
      await mkdir(bin)
      const listing = JSON.stringify([
        {
          pid: 21,
          status: 'running',
          slot: 1,
          queuedAt: 50,
          startedAt: null,
          cwd: '/w',
          command: 'tsc'
        },
        {
          pid: 22,
          status: 'waiting',
          slot: 0,
          queuedAt: 60,
          startedAt: null,
          cwd: '/w',
          command: 'vitest run'
        },
        { pid: 'x', status: 'waiting', queuedAt: 70, cwd: '/w', command: 'bad' }
      ])
      await writeFile(path.join(bin, 'heavy'), `#!/bin/sh\necho '${listing}'\n`)
      await chmod(path.join(bin, 'heavy'), 0o755)

      // macOS runs the script's own listing too.
      const queue = await readHeavyCommandQueue({ home, pathEnv: bin, platform: 'darwin' })

      expect(queue?.slots).toBe(1)
      expect(
        queue?.jobs.map(({ pid, status, slot, queuedAt, startedAt }) => ({
          pid,
          status,
          slot,
          queuedAt,
          startedAt
        }))
      ).toEqual([
        { pid: 21, status: 'running', slot: 1, queuedAt: 50_000, startedAt: null },
        { pid: 22, status: 'waiting', slot: null, queuedAt: 60_000, startedAt: null }
      ])
    }
  )
})

describe('findHeavyQueueScript', () => {
  it.skipIf(process.platform === 'win32')(
    'prefers `heavy` over `vps-heavy` and finds ~/.local/bin outside PATH',
    async () => {
      const bin = path.join(home, '.local', 'bin')
      await mkdir(bin, { recursive: true })
      for (const name of ['vps-heavy', 'heavy']) {
        await writeFile(path.join(bin, name), '#!/bin/sh\n')
        await chmod(path.join(bin, name), 0o755)
      }
      await expect(findHeavyQueueScript(home, '/usr/bin')).resolves.toBe(path.join(bin, 'heavy'))
    }
  )
})

describe('scriptSupportsStop', () => {
  it('reads it from the script, so an older vps-heavy keeps Stop off', async () => {
    const script = path.join(home, 'vps-heavy')
    await writeFile(script, '#!/bin/sh\n# vps-heavy cancel <pid>\n')
    await expect(scriptSupportsStop(script)).resolves.toBe(false)
    await writeFile(script, '#!/bin/sh\n# vps-heavy stop <pid>   para um job\n')
    await expect(scriptSupportsStop(script)).resolves.toBe(true)
    await writeFile(script, '#!/bin/sh\n# heavy stop <pid>\n')
    await expect(scriptSupportsStop(script)).resolves.toBe(true)
    await expect(scriptSupportsStop(path.join(home, 'missing'))).resolves.toBe(false)
  })
})

describe('parseHeavyQueueListing', () => {
  it('reads version 2 listings with slots, order and controls, and version 1 lists without', () => {
    const v2 = parseHeavyQueueListing({
      version: 2,
      slots: 3,
      jobs: [
        {
          pid: 5,
          status: 'running',
          slot: null,
          extra: true,
          queuedAt: 1,
          startedAt: 2,
          cwd: '/',
          command: 'a'
        },
        {
          pid: 6,
          status: 'waiting',
          slot: 0,
          position: 1,
          ordered: true,
          direct: false,
          queuedAt: 3,
          startedAt: null,
          cwd: '/',
          command: 'b'
        },
        {
          pid: 7,
          status: 'waiting',
          slot: null,
          position: null,
          direct: true,
          queuedAt: 4,
          startedAt: null,
          cwd: '/',
          command: 'c'
        }
      ]
    })
    expect(v2?.controls).toBe(true)
    expect(v2?.slots).toBe(3)
    expect(
      v2?.jobs.map(({ pid, slot, position, ordered, direct, extra }) => ({
        pid,
        slot,
        position,
        ordered,
        direct,
        extra
      }))
    ).toEqual([
      { pid: 5, slot: null, position: null, ordered: false, direct: false, extra: true },
      { pid: 6, slot: null, position: 1, ordered: true, direct: false, extra: false },
      { pid: 7, slot: null, position: null, ordered: false, direct: true, extra: false }
    ])
    expect(parseHeavyQueueListing([])).toEqual({ jobs: [], slots: null, controls: false })
    expect(parseHeavyQueueListing({ version: 1, jobs: [] })).toBeNull()
  })
})

describe('attributeHeavyQueueWorkspaces', () => {
  it("names the deepest local workspace holding a job's cwd", () => {
    const repo = (id: string, repoPath: string, extra: Partial<Repo> = {}): Repo => ({
      id,
      path: repoPath,
      displayName: id,
      badgeColor: '#fff',
      addedAt: 1,
      ...extra
    })
    const repos = [repo('app', '/w/app'), repo('far', '/w/far', { executionHostId: 'runtime:vps' })]
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: attribution reads only the store members stubbed here.
    const store = {
      getRepos: () => repos,
      getRepo: (id: string) => repos.find((r) => r.id === id),
      getWorktreeMeta: (id: string) =>
        id === 'app::/w/app/trees/fix' ? { displayName: 'fix' } : undefined,
      getAllWorktreeMetaForHost: () => ({ 'app::/w/app/trees/fix': { displayName: 'fix' } }),
      getFolderWorkspaces: () => []
    } as unknown as MemorySnapshotStore
    const job = (cwd: string) => ({
      pid: 1,
      status: 'waiting' as const,
      slot: null,
      position: 1,
      ordered: true,
      direct: false,
      extra: false,
      queuedAt: 0,
      startedAt: null,
      cwd,
      command: 'x'
    })

    const { jobs } = attributeHeavyQueueWorkspaces(
      {
        readAt: 0,
        slots: 1,
        controls: false,
        jobs: [job('/w/app/trees/fix/src'), job('/w/app'), job('/w/far'), job('/w/apple')]
      },
      store
    )

    expect(jobs.map((j) => j.workspace ?? null)).toEqual([
      { worktreeId: 'app::/w/app/trees/fix', worktreeName: 'fix', repoName: 'app' },
      { worktreeId: 'app::/w/app', worktreeName: 'app', repoName: 'app' },
      null,
      null
    ])
  })
})
