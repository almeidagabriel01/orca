// Two "hosts" on one machine: this client's own host and an isolated `orca serve` paired as "vps".
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Page } from '@stablyai/playwright-test'

/** Never reach the live Orca that may host this shell: its runtime, terminal handle, CLI shim or agent env. */
export function scrubHostOrcaEnv(): void {
  for (const key of Object.keys(process.env)) {
    const keep = key === 'ORCA_BACKGROUND_LAUNCH' || key.startsWith('ORCA_E2E_')
    if (!keep && /^(ORCA_|CLAUDE|ANTHROPIC_|CODEX_)/.test(key)) {
      delete process.env[key]
    }
  }
}

// Project identity needs a network remote, ranked `upstream` first; `origin` stays the reachable bare repo
// the hand-off fetches. The reserved .invalid TLD makes any upstream fetch fail fast.
export const FIXTURE_REMOTE_URL = 'https://proops.e2e.invalid/orca-e2e/proops-app.git'
export const MAC_BRANCH = 'feat/mobile-app'
export const VPS_BRANCH = 'develop'

export type CrossHostFixture = {
  root: string
  macCheckout: string
  vpsCheckout: string
  macStub: ClaudeStub
  vpsStub: ClaudeStub
}

export type ClaudeStub = { dir: string; launchLog: string }

function git(cwd: string, ...args: string[]): string {
  return execFileSync(
    'git',
    ['-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', ...args],
    { cwd, encoding: 'utf8', stdio: 'pipe' }
  )
}

function cloneOn(root: string, origin: string, host: string, branch: string): string {
  const checkout = path.join(root, host, 'Personal-ProOps-app')
  mkdirSync(path.dirname(checkout), { recursive: true })
  git(root, 'clone', '--branch', branch, origin, checkout)
  git(checkout, 'config', 'user.email', 'e2e@test.local')
  git(checkout, 'config', 'user.name', 'E2E Test')
  git(checkout, 'remote', 'add', 'upstream', FIXTURE_REMOTE_URL)
  return checkout
}

/** A `claude` wrapper around the repo's stream-json stub; every launch is logged so no real CLI runs unseen. */
function writeClaudeStub(dir: string): ClaudeStub {
  mkdirSync(dir, { recursive: true })
  const script = path.join(process.cwd(), 'tests', 'e2e', 'fixtures', 'structured-claude-stub.cjs')
  const launchLog = path.join(dir, 'launches.jsonl')
  const quote = (value: string): string => `'${value.replaceAll("'", `'\\''`)}'`
  const command = path.join(dir, 'claude')
  writeFileSync(
    command,
    `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(script)} ${quote(launchLog)} "$@"\n`
  )
  chmodSync(command, 0o755)
  return { dir, launchLog }
}

export function stubPath(stub: ClaudeStub): string {
  return [stub.dir, process.env.PATH ?? ''].join(path.delimiter)
}

export function readStubLaunches(stub: ClaudeStub): string[] {
  return existsSync(stub.launchLog)
    ? readFileSync(stub.launchLog, 'utf8').split('\n').filter(Boolean)
    : []
}

/** One origin, cloned once per host and clean: the hand-off gate sees nothing unpushed. */
export function createCrossHostFixture(): CrossHostFixture {
  const root = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'orca-e2e-cross-host-')))
  const origin = path.join(root, 'origin.git')
  const seed = path.join(root, 'seed')
  git(root, 'init', '--bare', '--initial-branch=main', origin)
  git(root, 'clone', origin, seed)
  git(seed, 'config', 'user.email', 'e2e@test.local')
  git(seed, 'config', 'user.name', 'E2E Test')
  git(seed, 'checkout', '-b', 'main')
  writeFileSync(path.join(seed, 'README.md'), '# Personal ProOps app (E2E fixture)\n')
  git(seed, 'add', '-A')
  git(seed, 'commit', '-m', 'Initial commit')
  git(seed, 'branch', VPS_BRANCH)
  git(seed, 'branch', MAC_BRANCH)
  git(seed, 'push', 'origin', 'main', VPS_BRANCH, MAC_BRANCH)
  return {
    root,
    macCheckout: cloneOn(root, origin, 'mac', MAC_BRANCH),
    vpsCheckout: cloneOn(root, origin, 'vps', VPS_BRANCH),
    macStub: writeClaudeStub(path.join(root, 'stub-mac')),
    vpsStub: writeClaudeStub(path.join(root, 'stub-vps'))
  }
}

/** Claude Code's project folder name for a cwd. */
function claudeProjectDirName(cwd: string): string {
  return cwd.replace(/[^a-zA-Z0-9]/g, '-')
}

export type SeededSession = { sessionId: string; prompt: string; reply: string }

/** A Claude transcript under `home`, recorded in `cwd` on `branch`, as the session scanner reads it. */
export function writeClaudeTranscript(args: {
  home: string
  cwd: string
  branch: string
  session: SeededSession
}): string {
  const dir = path.join(args.home, '.claude', 'projects', claudeProjectDirName(args.cwd))
  mkdirSync(dir, { recursive: true })
  const userAt = new Date(Date.now() - 60_000)
  const common = {
    sessionId: args.session.sessionId,
    cwd: args.cwd,
    gitBranch: args.branch,
    version: '2.1.280',
    userType: 'external',
    isSidechain: false
  }
  const userId = randomUUID()
  const lines = [
    {
      ...common,
      type: 'user',
      uuid: userId,
      parentUuid: null,
      timestamp: userAt.toISOString(),
      message: { role: 'user', content: args.session.prompt }
    },
    {
      ...common,
      type: 'assistant',
      uuid: randomUUID(),
      parentUuid: userId,
      timestamp: new Date(userAt.getTime() + 2_000).toISOString(),
      message: {
        id: `msg_${randomUUID()}`,
        role: 'assistant',
        model: 'claude-opus-4',
        type: 'message',
        content: [{ type: 'text', text: args.session.reply }]
      }
    }
  ]
  const file = path.join(dir, `${args.session.sessionId}.jsonl`)
  writeFileSync(file, `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`)
  return file
}

/** The client's map for transcripts synced from the vps: they keep the vps cwd, which lives at `local` here. */
export function writeSessionPathMap(userDataDir: string, local: string, foreign: string): void {
  writeFileSync(
    path.join(userDataDir, 'session-path-map.json'),
    `${JSON.stringify({ version: 1, aliases: [{ local, foreign: [foreign] }] }, null, 2)}\n`
  )
}

export function shotDir(fallback: string): string {
  const dir = process.env.ORCA_E2E_SHOT_DIR || fallback
  mkdirSync(dir, { recursive: true })
  return dir
}

export async function screenshotStep(page: Page, dir: string, step: number, name: string) {
  const file = path.join(dir, `e2e-${String(step).padStart(2, '0')}-${name}.png`)
  await page.screenshot({ path: file })
  return file
}

/** Ends whatever still runs from a disposable profile, e.g. the terminal daemon `orca serve` leaves behind. */
export function killProcessesUsing(profileDir: string): void {
  if (process.platform === 'win32' || !profileDir.includes('orca-e2e-cross-host-')) {
    return
  }
  try {
    execFileSync('pkill', ['-f', profileDir], { stdio: 'ignore' })
  } catch {
    // pkill exits 1 when nothing matched.
  }
}

/** Merges `settings` into a profile's stored settings, so a host starts with them. */
export function patchProfileSettings(userDataDir: string, settings: Record<string, unknown>): void {
  const file = path.join(userDataDir, 'orca-data.json')
  const data = JSON.parse(readFileSync(file, 'utf8')) as { settings?: Record<string, unknown> }
  data.settings = { ...data.settings, ...settings }
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`)
}
