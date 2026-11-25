import { describe, expect, it } from 'vitest'
import type { HeavyCommandQueue } from '../../shared/diagnostics/process-stats-types'
import type { HeavyJobTargetRequest } from '../../shared/diagnostics/heavy-job-move-types'
import {
  checkHeavyJobTarget,
  describeHeavyJobForMove,
  type HeavyJobGitResult,
  type HeavyJobMoveDeps
} from './host-heavy-job-move'

const COMMIT = 'a'.repeat(40)
const OLD = 'b'.repeat(40)
const REMOTE = 'github:acme/app'
const REMOTE_V =
  'origin\tgit@github.com:acme/app.git (fetch)\norigin\tgit@github.com:acme/app.git (push)\n'

function queue(jobs: Partial<HeavyCommandQueue['jobs'][number]>[]): HeavyCommandQueue {
  return {
    readAt: 0,
    slots: 1,
    controls: true,
    hostname: 'target-host',
    canMoveHost: true,
    peers: [],
    jobs: jobs.map((job) => ({
      pid: 10,
      status: 'waiting',
      slot: null,
      position: 1,
      ordered: true,
      direct: false,
      extra: false,
      queuedAt: 0,
      startedAt: null,
      cwd: '/src/app/pkg',
      command: 'pnpm test',
      argv: ['pnpm', 'test'],
      group: 'itest',
      movedFrom: null,
      ...job
    }))
  }
}

type GitAnswers = Record<string, string | number | HeavyJobGitResult>

/** Answers `git <args>` keyed by "cwd: args"; a string is stdout with code 0, a number a bare exit code. */
function fakeDeps(answers: GitAnswers, overrides: Partial<HeavyJobMoveDeps> = {}) {
  const calls: string[] = []
  const deps: HeavyJobMoveDeps = {
    readQueue: async () => queue([{}]),
    git: async (args, cwd) => {
      const key = `${cwd}: ${args.join(' ')}`
      calls.push(key)
      const answer = answers[key]
      if (answer === undefined) {
        return { code: 1, stdout: '' }
      }
      return typeof answer === 'string'
        ? { code: 0, stdout: answer }
        : typeof answer === 'number'
          ? { code: answer, stdout: '' }
          : answer
    },
    listRepos: () => [{ path: '/repos/app', gitRemoteIdentity: undefined }],
    isDirectory: async () => true,
    commandEnv: async (cwd) => ({
      cwd,
      pathDirs: ['/bin'],
      isExecutable: async (file) => file.startsWith('/bin/'),
      readText: async () => JSON.stringify({ scripts: { test: 'vitest run' } }),
      dockerAvailable: async () => true
    }),
    ...overrides
  }
  return { deps, calls }
}

const cleanSource: GitAnswers = {
  '/src/app/pkg: rev-parse --show-toplevel': '/src/app\n',
  '/src/app: remote -v': REMOTE_V,
  '/src/app: symbolic-ref --short -q HEAD': 'feature/x\n',
  '/src/app: rev-parse HEAD': `${COMMIT}\n`,
  '/src/app: status --porcelain': '',
  '/src/app: branch -r --contains HEAD': '  origin/feature/x\n'
}

describe('describeHeavyJobForMove', () => {
  it('describes a clean, pushed job with no blockers', async () => {
    const { deps } = fakeDeps(cleanSource)
    expect(await describeHeavyJobForMove(10, deps)).toEqual({
      pid: 10,
      argv: ['pnpm', 'test'],
      group: 'itest',
      remoteUrl: REMOTE,
      branch: 'feature/x',
      commit: COMMIT,
      relativeDir: 'pkg',
      blockers: []
    })
  })

  it('blocks dirty, unpushed, detached and argv-less jobs', async () => {
    const { deps } = fakeDeps(
      {
        ...cleanSource,
        '/src/app: symbolic-ref --short -q HEAD': 1,
        '/src/app: status --porcelain': ' M a.ts\n',
        '/src/app: branch -r --contains HEAD': ''
      },
      { readQueue: async () => queue([{ argv: undefined }]) }
    )
    const codes = (await describeHeavyJobForMove(10, deps)).blockers.map((b) => b.code)
    expect(codes.sort()).toEqual(
      ['detached_head', 'no_argv', 'uncommitted_changes', 'unpushed_commits'].sort()
    )
  })

  it('blocks moved jobs and reports gone ones', async () => {
    const { deps } = fakeDeps(cleanSource, {
      readQueue: async () => queue([{ movedFrom: 'mac' }])
    })
    expect((await describeHeavyJobForMove(10, deps)).blockers).toEqual([
      { code: 'already_moved', detail: 'mac' }
    ])
    expect((await describeHeavyJobForMove(99, deps)).blockers).toEqual([{ code: 'job_gone' }])
  })
})

const request: HeavyJobTargetRequest = {
  remoteUrl: REMOTE,
  branch: 'feature/x',
  commit: COMMIT,
  relativeDir: 'pkg',
  argv: ['pnpm', 'test'],
  prepare: false
}

const target: GitAnswers = {
  '/: check-ref-format --branch feature/x': 'feature/x\n',
  '/repos/app: remote -v': REMOTE_V,
  '/repos/app: worktree list --porcelain':
    'worktree /repos/app\nHEAD 1\nbranch refs/heads/main\n\nworktree /wt/x\nHEAD 2\nbranch refs/heads/feature/x\n',
  [`/wt/x: cat-file -e ${COMMIT}^{commit}`]: 0,
  '/wt/x: rev-parse HEAD': `${OLD}\n`,
  [`/wt/x: merge-base --is-ancestor HEAD ${COMMIT}`]: 0,
  '/wt/x: status --porcelain': ''
}

describe('checkHeavyJobTarget', () => {
  it('accepts a clean checkout that is behind, fast-forwarding only on prepare', async () => {
    const check = fakeDeps(target)
    expect(await checkHeavyJobTarget(request, check.deps)).toEqual({
      cwd: '/wt/x/pkg',
      hostname: 'target-host',
      blockers: []
    })
    expect(check.calls.some((call) => call.includes('merge --ff-only'))).toBe(false)
    const prepare = fakeDeps({ ...target, [`/wt/x: merge --ff-only --quiet ${COMMIT}`]: 0 })
    await checkHeavyJobTarget({ ...request, prepare: true }, prepare.deps)
    expect(prepare.calls).toContain(`/wt/x: merge --ff-only --quiet ${COMMIT}`)
  })

  it('reports project_missing when no repo here has the remote', async () => {
    const { deps } = fakeDeps({ ...target, '/repos/app: remote -v': '' })
    expect((await checkHeavyJobTarget(request, deps)).blockers).toEqual([
      { code: 'project_missing', detail: REMOTE }
    ])
  })

  it('reports a branch with no checkout, a dirty one behind and a diverged one', async () => {
    const noBranch = fakeDeps({
      ...target,
      '/repos/app: worktree list --porcelain': 'worktree /repos/app\nbranch refs/heads/main\n'
    })
    expect((await checkHeavyJobTarget(request, noBranch.deps)).blockers[0]?.code).toBe(
      'no_checkout_on_branch'
    )
    const dirty = fakeDeps({ ...target, '/wt/x: status --porcelain': '?? tmp\n' })
    expect((await checkHeavyJobTarget(request, dirty.deps)).blockers[0]?.code).toBe(
      'checkout_dirty'
    )
    const diverged = fakeDeps({ ...target, [`/wt/x: merge-base --is-ancestor HEAD ${COMMIT}`]: 1 })
    expect((await checkHeavyJobTarget(request, diverged.deps)).blockers[0]?.code).toBe(
      'checkout_diverged'
    )
  })

  it('rejects unsafe input before any git or filesystem access', async () => {
    for (const bad of [
      { relativeDir: '../etc' },
      { relativeDir: '/etc' },
      { commit: 'HEAD' },
      { branch: '--upload-pack=x' },
      { argv: [] }
    ]) {
      const { deps, calls } = fakeDeps(target)
      await expect(checkHeavyJobTarget({ ...request, ...bad }, deps)).rejects.toThrow()
      expect(calls).toEqual([])
    }
    const { deps } = fakeDeps({ ...target, '/: check-ref-format --branch a..b': 1 })
    await expect(checkHeavyJobTarget({ ...request, branch: 'a..b' }, deps)).rejects.toThrow(
      'invalid_branch'
    )
  })
})
