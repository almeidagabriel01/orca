import { constants } from 'node:fs'
import { access, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { runProcess } from '@orca/process-host'
import type {
  HeavyJobMoveBlocker,
  HeavyJobMoveSource,
  HeavyJobTargetCheck,
  HeavyJobTargetRequest
} from '../../shared/diagnostics/heavy-job-move-types'
import type { HeavyCommandQueue } from '../../shared/diagnostics/process-stats-types'
import {
  getRepoExecutionHostId,
  LOCAL_EXECUTION_HOST_ID
} from '../../shared/execution-host/execution-host'
import {
  deriveGitRemoteIdentity,
  type GitRemoteIdentity
} from '../../shared/git/remotes/git-remote-identity'
import { getProjectIdentityKey } from '../../shared/project/host-setup/project-host-setup-projection'
import type { Repo } from '../../shared/repository/repo-types'
import { DiagnosticsHeavyJobTargetParams } from '../../shared/rpc-contract/diagnostics-params'
import { resolveLoginShellEnvironment } from '../startup/shell-environment/login-shell-environment'
import { findCommandBlockers, type CommandCheckEnv } from './heavy-command-executable-check'
import { sampleHeavyCommandQueue } from './host-heavy-command-queue'

const GIT_TIMEOUT_MS = 10_000
const FETCH_TIMEOUT_MS = 60_000
const DOCKER_TIMEOUT_MS = 5_000
// Same cadence the structured agents use: a newly installed CLI shows up without a restart.
const SHELL_ENV_REFRESH_MS = 10_000

export type HeavyJobGitResult = { code: number | null; stdout: string }

export type HeavyJobMoveDeps = {
  readQueue: () => Promise<HeavyCommandQueue | null>
  git: (args: string[], cwd: string, timeoutMs?: number) => Promise<HeavyJobGitResult>
  /** This host's local repos, from its inventory. */
  listRepos: () => Pick<Repo, 'path' | 'gitRemoteIdentity'>[]
  isDirectory: (dir: string) => Promise<boolean>
  commandEnv: (cwd: string, checkoutRoot: string) => Promise<CommandCheckEnv>
}

async function loginShellEnv(): Promise<NodeJS.ProcessEnv> {
  return resolveLoginShellEnvironment({ refreshAfterMs: SHELL_ENV_REFRESH_MS })
}

async function runGit(args: string[], cwd: string, timeoutMs = GIT_TIMEOUT_MS) {
  const env = { ...(await loginShellEnv()), GIT_TERMINAL_PROMPT: '0' }
  const result = await runProcess({
    program: 'git',
    args,
    cwd,
    env,
    timeoutMs,
    maxOutputBytes: 1024 * 1024
  }).catch(() => null)
  return result && !result.timedOut
    ? { code: result.code, stdout: result.stdout }
    : { code: null, stdout: '' }
}

/** node_modules/.bin from cwd up to the checkout root, then the login shell's PATH. */
export function commandPathDirs(cwd: string, checkoutRoot: string, pathEnv: string): string[] {
  const dirs: string[] = []
  for (let dir = cwd; ; dir = path.dirname(dir)) {
    dirs.push(path.join(dir, 'node_modules', '.bin'))
    if (dir === checkoutRoot || path.dirname(dir) === dir) {
      break
    }
  }
  return [...dirs, ...pathEnv.split(path.delimiter).filter((dir) => path.isAbsolute(dir))]
}

async function defaultCommandEnv(cwd: string, checkoutRoot: string): Promise<CommandCheckEnv> {
  const env = await loginShellEnv()
  return {
    cwd,
    pathDirs: commandPathDirs(cwd, checkoutRoot, env.PATH ?? ''),
    isExecutable: async (file) => {
      try {
        await access(file, constants.X_OK)
        return (await stat(file)).isFile()
      } catch {
        return false
      }
    },
    readText: (file) => readFile(file, 'utf8').catch(() => null),
    dockerAvailable: async () => {
      const result = await runProcess({
        program: 'docker',
        args: ['info'],
        env,
        timeoutMs: DOCKER_TIMEOUT_MS,
        maxOutputBytes: 64 * 1024
      }).catch(() => null)
      return result?.code === 0 && !result.timedOut
    }
  }
}

export function createHeavyJobMoveDeps(
  listRepos: () => Pick<Repo, 'path' | 'gitRemoteIdentity'>[]
): HeavyJobMoveDeps {
  return {
    readQueue: () => sampleHeavyCommandQueue(),
    git: runGit,
    listRepos,
    isDirectory: async (dir) => (await stat(dir).catch(() => null))?.isDirectory() === true,
    commandEnv: defaultCommandEnv
  }
}

/** Local repos of a store, the inventory checkHeavyJobTarget searches. */
export function localRepos(repos: Repo[]): Repo[] {
  return repos.filter((repo) => getRepoExecutionHostId(repo) === LOCAL_EXECUTION_HOST_ID)
}

/** The key Orca merges a project on across hosts, from the remote alone so both hosts derive it alike. */
function projectKey(identity: GitRemoteIdentity | null | undefined): string | null {
  return identity ? getProjectIdentityKey({ id: '', gitRemoteIdentity: identity }) : null
}

async function remoteKey(deps: HeavyJobMoveDeps, cwd: string): Promise<string | null> {
  const remotes = await deps.git(['remote', '-v'], cwd)
  return remotes.code === 0 ? projectKey(deriveGitRemoteIdentity(remotes.stdout)) : null
}

/** What this host knows of one of its heavy jobs, and why it could not run elsewhere. */
export async function describeHeavyJobForMove(
  pid: number,
  deps: HeavyJobMoveDeps
): Promise<HeavyJobMoveSource> {
  const source: HeavyJobMoveSource = {
    pid,
    argv: null,
    group: null,
    remoteUrl: null,
    branch: null,
    commit: null,
    relativeDir: null,
    blockers: []
  }
  const queue = await deps.readQueue()
  if (!queue) {
    return { ...source, blockers: [{ code: 'queue_unavailable' }] }
  }
  const job = queue.jobs.find((candidate) => candidate.pid === pid)
  if (!job) {
    return { ...source, blockers: [{ code: 'job_gone' }] }
  }
  const blockers: HeavyJobMoveBlocker[] = []
  source.argv = job.argv ?? null
  source.group = job.group ?? null
  if (job.status === 'moved' || job.movedFrom) {
    blockers.push({
      code: 'already_moved',
      detail: job.movedTo?.peer ?? job.movedFrom ?? undefined
    })
  }
  if (!job.argv) {
    blockers.push({ code: 'no_argv' })
  }
  const toplevel = await deps.git(['rev-parse', '--show-toplevel'], job.cwd)
  const root = toplevel.stdout.trim()
  const relativeDir = root ? path.relative(root, job.cwd) : ''
  if (
    toplevel.code !== 0 ||
    !root ||
    relativeDir.startsWith('..') ||
    path.isAbsolute(relativeDir)
  ) {
    return { ...source, blockers: [...blockers, { code: 'not_git', detail: job.cwd }] }
  }
  source.relativeDir = relativeDir.split(path.sep).join('/')
  const [key, branch, head, status, remoteBranches] = await Promise.all([
    remoteKey(deps, root),
    deps.git(['symbolic-ref', '--short', '-q', 'HEAD'], root),
    deps.git(['rev-parse', 'HEAD'], root),
    deps.git(['status', '--porcelain'], root),
    deps.git(['branch', '-r', '--contains', 'HEAD'], root)
  ])
  source.remoteUrl = key
  source.branch = branch.code === 0 && branch.stdout.trim() ? branch.stdout.trim() : null
  source.commit =
    head.code === 0 && /^[0-9a-f]{40}$/.test(head.stdout.trim()) ? head.stdout.trim() : null
  if (!key) {
    blockers.push({ code: 'no_remote' })
  }
  if (!source.branch) {
    blockers.push({ code: 'detached_head' })
  }
  if (status.code !== 0 || status.stdout.trim()) {
    blockers.push({ code: 'uncommitted_changes', detail: source.branch ?? undefined })
  }
  if (remoteBranches.code !== 0 || !remoteBranches.stdout.trim()) {
    blockers.push({ code: 'unpushed_commits', detail: source.branch ?? undefined })
  }
  return { ...source, blockers }
}

/** Worktree paths checked out on refs/heads/<branch>, from `git worktree list --porcelain`. */
export function worktreesOnBranch(porcelain: string, branch: string): string[] {
  const ref = `refs/heads/${branch}`
  return porcelain.split(/\n\s*\n/).flatMap((block) => {
    const lines = block.split('\n')
    const worktree = lines.find((line) => line.startsWith('worktree '))?.slice(9)
    return worktree && lines.includes(`branch ${ref}`) ? [worktree] : []
  })
}

async function findCheckout(
  request: HeavyJobTargetRequest,
  deps: HeavyJobMoveDeps
): Promise<{ checkout: string } | { blocker: HeavyJobMoveBlocker }> {
  const repos = deps.listRepos()
  const keys = await Promise.all(
    repos.map(async (repo) =>
      // undefined: the inventory has not probed it yet; null: it has no remote.
      repo.gitRemoteIdentity === undefined
        ? remoteKey(deps, repo.path)
        : projectKey(repo.gitRemoteIdentity)
    )
  )
  const matching = repos.filter((_, index) => keys[index] === request.remoteUrl)
  if (matching.length === 0) {
    return { blocker: { code: 'project_missing', detail: request.remoteUrl } }
  }
  for (const repo of matching) {
    const list = await deps.git(['worktree', 'list', '--porcelain'], repo.path)
    const checkout = list.code === 0 ? worktreesOnBranch(list.stdout, request.branch)[0] : undefined
    if (checkout) {
      return { checkout }
    }
  }
  return { blocker: { code: 'no_checkout_on_branch', detail: request.branch } }
}

/** Fast-forwards a clean checkout that is behind when `prepare`; anything else is a blocker. */
async function alignCheckout(
  checkout: string,
  request: HeavyJobTargetRequest,
  deps: HeavyJobMoveDeps
): Promise<HeavyJobMoveBlocker | null> {
  const hasCommit = async (): Promise<boolean> =>
    (await deps.git(['cat-file', '-e', `${request.commit}^{commit}`], checkout)).code === 0
  if (!(await hasCommit())) {
    await deps.git(['fetch', '--quiet'], checkout, FETCH_TIMEOUT_MS)
    if (!(await hasCommit())) {
      return { code: 'commit_unreachable', detail: request.commit.slice(0, 12) }
    }
  }
  const head = (await deps.git(['rev-parse', 'HEAD'], checkout)).stdout.trim()
  if (head === request.commit) {
    return null
  }
  const behind =
    (await deps.git(['merge-base', '--is-ancestor', 'HEAD', request.commit], checkout)).code === 0
  if (!behind) {
    return { code: 'checkout_diverged', detail: request.branch }
  }
  const status = await deps.git(['status', '--porcelain'], checkout)
  if (status.code !== 0 || status.stdout.trim()) {
    return { code: 'checkout_dirty', detail: checkout }
  }
  if (request.prepare) {
    const merged = await deps.git(['merge', '--ff-only', '--quiet', request.commit], checkout)
    if (merged.code !== 0) {
      return { code: 'checkout_diverged', detail: request.branch }
    }
  }
  return null
}

/** Whether this host can run the job at the given commit; rejects requests that fail validation. */
export async function checkHeavyJobTarget(
  untrusted: HeavyJobTargetRequest,
  deps: HeavyJobMoveDeps
): Promise<HeavyJobTargetCheck> {
  const request = DiagnosticsHeavyJobTargetParams.parse(untrusted)
  const queue = await deps.readQueue()
  const hostname = queue?.hostname ?? null
  const blocked = (blocker: HeavyJobMoveBlocker): HeavyJobTargetCheck => ({
    cwd: null,
    hostname,
    blockers: [blocker]
  })
  if (!queue?.canMoveHost) {
    return blocked({ code: 'queue_unavailable' })
  }
  // Validated before git sees it as a ref anywhere.
  const refCheck = await deps.git(['check-ref-format', '--branch', request.branch], '/')
  if (refCheck.code !== 0 || refCheck.stdout.trim() !== request.branch) {
    throw new Error('invalid_branch')
  }
  const found = await findCheckout(request, deps)
  if ('blocker' in found) {
    return blocked(found.blocker)
  }
  const misaligned = await alignCheckout(found.checkout, request, deps)
  if (misaligned) {
    return blocked(misaligned)
  }
  const cwd = request.relativeDir ? path.join(found.checkout, request.relativeDir) : found.checkout
  if (!(await deps.isDirectory(cwd))) {
    return blocked({ code: 'directory_missing', detail: request.relativeDir })
  }
  const blockers = await findCommandBlockers(
    request.argv,
    await deps.commandEnv(cwd, found.checkout)
  )
  return { cwd: blockers.length === 0 ? cwd : null, hostname, blockers }
}
