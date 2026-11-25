// Decides, from real checks only (PATH, package.json, Makefile, files), whether a heavy command can run on
// a host. No list of commands, platforms or projects: a missing tool is rejected because it is missing.
import { join, resolve } from 'node:path'
import type { HeavyJobMoveBlocker } from '../../shared/diagnostics/heavy-job-move-types'

export type CommandCheckEnv = {
  cwd: string
  pathDirs: string[]
  isExecutable(path: string): Promise<boolean>
  readText(path: string): Promise<string | null>
  dockerAvailable(): Promise<boolean>
}

const MAX_DEPTH = 4
const MAX_COMMANDS = 50
const ENV_ASSIGN = /^[A-Za-z_][A-Za-z0-9_]*=/
// Shell grammar, not tools: they never exist as executables.
const SHELL_BUILTINS = new Set([
  'cd',
  'export',
  'set',
  'unset',
  'exit',
  'true',
  'false',
  ':',
  'source',
  '.',
  'eval',
  'wait',
  'exec'
])
// pnpm/yarn subcommands that are not package.json scripts (`pnpm <word>` is a script otherwise).
const PKG_MANAGER_OWN = new Set([
  'install',
  'i',
  'add',
  'remove',
  'rm',
  'update',
  'up',
  'upgrade',
  'list',
  'ls',
  'why',
  'outdated',
  'audit',
  'publish',
  'pack',
  'init',
  'rebuild',
  'prune',
  'dedupe',
  'link',
  'unlink',
  'fetch',
  'patch',
  'store',
  'config',
  'env',
  'create',
  'setup',
  'import',
  'root',
  'bin',
  'cache',
  'info',
  'version',
  'help',
  'dlx',
  'exec',
  'run',
  'x'
])
const FLAGS_WITH_VALUE = new Set([
  '-C',
  '--dir',
  '--cwd',
  '-F',
  '--filter',
  '--group',
  '-u',
  '--unset'
])

/** Splits a shell string into commands (on && || ; | & newline), honoring quotes and backslashes. */
export function splitCommands(input: string): string[][] {
  const commands: string[][] = []
  let words: string[] = []
  let word = ''
  let has = false
  let quote: '"' | "'" | null = null
  const endWord = (): void => {
    if (has) {
      words.push(word)
    }
    word = ''
    has = false
  }
  const endCommand = (): void => {
    endWord()
    if (words.length) {
      commands.push(words)
    }
    words = []
  }
  for (let i = 0; i < input.length; i++) {
    const c = input[i]
    if (quote) {
      if (c === quote) {
        quote = null
      } else if (c === '\\' && quote === '"' && i + 1 < input.length) {
        word += input[++i]
      } else {
        word += c
      }
    } else if (c === '"' || c === "'") {
      quote = c
      has = true
    } else if (c === '\\' && i + 1 < input.length) {
      word += input[++i]
      has = true
    } else if (
      c === ';' ||
      c === '|' ||
      c === '\n' ||
      (c === '&' && !/[<>]/.test(input[i - 1] ?? ''))
    ) {
      endCommand()
    } else if (/\s/.test(c)) {
      endWord()
    } else {
      word += c
      has = true
    }
  }
  endCommand()
  return commands
}

export async function findCommandBlockers(
  argv: string[],
  env: CommandCheckEnv
): Promise<HeavyJobMoveBlocker[]> {
  const blockers: HeavyJobMoveBlocker[] = []
  let count = 0
  const add = (b: HeavyJobMoveBlocker): void => {
    if (!blockers.some((x) => x.code === b.code && x.detail === b.detail)) {
      blockers.push(b)
    }
  }

  async function resolveExec(name: string, local: boolean): Promise<boolean> {
    if (name.includes('/')) {
      return env.isExecutable(resolve(env.cwd, name))
    }
    const dirs = local ? [join(env.cwd, 'node_modules', '.bin'), ...env.pathDirs] : env.pathDirs
    for (const dir of dirs) {
      if (await env.isExecutable(join(dir, name))) {
        return true
      }
    }
    return false
  }

  async function need(name: string, local: boolean): Promise<boolean> {
    if (await resolveExec(name, local)) {
      return true
    }
    add({ code: 'executable_missing', detail: name })
    return false
  }

  async function runScript(script: string, depth: number): Promise<void> {
    let body: unknown
    try {
      const pkg = JSON.parse((await env.readText(join(env.cwd, 'package.json'))) ?? 'null')
      body = pkg?.scripts?.[script]
    } catch {
      body = undefined
    }
    if (typeof body !== 'string') {
      add({ code: 'script_missing', detail: script })
      return
    }
    await checkShell(body, depth + 1, true)
  }

  async function checkShell(source: string, depth: number, local: boolean): Promise<void> {
    for (const cmd of splitCommands(source)) {
      await check(cmd, depth, local)
    }
  }

  async function check(argv0: string[], depth: number, local: boolean): Promise<void> {
    const a = [...argv0]
    while (a.length && ENV_ASSIGN.test(a[0])) {
      a.shift()
    }
    if (!a.length || depth > MAX_DEPTH || count >= MAX_COMMANDS) {
      return
    }
    count++
    const name = a[0]
    const rest = a.slice(1)
    // Skips leading flags (and the value of the ones known to take one).
    const skipFlags = (args: string[]): string[] => {
      let i = 0
      while (i < args.length && args[i].startsWith('-') && args[i] !== '--') {
        i += FLAGS_WITH_VALUE.has(args[i]) ? 2 : 1
      }
      return args[i] === '--' ? args.slice(i + 1) : args.slice(i)
    }
    if (SHELL_BUILTINS.has(name)) {
      return
    }
    if (name === 'heavy' || name === 'vps-heavy' || name === 'env') {
      return check(skipFlags(rest), depth + 1, local)
    }
    if (!(await need(name, local))) {
      return
    }
    switch (name) {
      case 'docker':
      case 'docker-compose':
        if (!(await env.dockerAvailable())) {
          add({ code: 'docker_unavailable' })
        }
        return
      case 'make': {
        const text =
          (await env.readText(join(env.cwd, 'Makefile'))) ??
          (await env.readText(join(env.cwd, 'makefile'))) ??
          (await env.readText(join(env.cwd, 'GNUmakefile')))
        for (const t of skipFlags(rest).filter((w) => !w.includes('='))) {
          const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          if (text === null || !new RegExp(`^${esc}\\s*:(?!=)`, 'm').test(text)) {
            add({ code: 'script_missing', detail: `make ${t}` })
          }
        }
        return
      }
      case 'bash':
      case 'sh':
      case 'zsh': {
        const args = rest
        const cIdx = args.findIndex((w) => /^-[a-z]*c$/.test(w))
        if (cIdx !== -1) {
          if (args[cIdx + 1] !== undefined) {
            await checkShell(args[cIdx + 1], depth + 1, local)
          }
          return
        }
        const file = args.find((w) => !w.startsWith('-'))
        if (file && (await env.readText(resolve(env.cwd, file))) === null) {
          add({ code: 'script_missing', detail: file })
        }
        return
      }
      case 'pnpm':
      case 'npm':
      case 'yarn':
      case 'bun': {
        const args = skipFlags(rest)
        const sub = args[0]
        if (!sub) {
          return
        }
        if ((name === 'pnpm' || name === 'yarn') && sub === 'exec') {
          return check(args.slice(1), depth + 1, true)
        }
        if (sub === 'run' || sub === 'run-script') {
          if (args[1]) {
            await runScript(args[1], depth)
          }
          return
        }
        const direct =
          name === 'npm'
            ? ['test', 'start', 'stop', 'restart'].includes(sub)
            : name === 'pnpm' || name === 'yarn'
              ? !PKG_MANAGER_OWN.has(sub)
              : false
        if (direct) {
          await runScript(sub, depth)
          // other commands (npx included): only the resolved executable is required
        }
      }
    }
  }

  await check(argv, 0, false)
  return blockers
}
