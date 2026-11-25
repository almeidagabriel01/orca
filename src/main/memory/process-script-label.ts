import { executableBasename } from './process-index'

const MAX_LABEL_CHARS = 40
const INTERPRETER =
  /^(?:node|nodejs|bun|bunx|deno|npx|pnpx|tsx|ts-node|python\d*(?:\.\d+)?|pypy\d*|ruby)$/
const SUBCOMMANDS = new Set(['run', 'x', 'exec'])
const EVAL_FLAGS = new Set(['-e', '--eval', '-p', '--print', '-c'])
const VALUE_FLAGS = new Set(['-r', '--require', '--import', '--loader', '--experimental-loader'])
const SCRIPT_EXTENSION = /\.(?:[cm]?[jt]sx?|py|rb)$/
const LABEL_CHARS = /^[A-Za-z0-9@._/-]+$/
const GENERIC_ENTRY = new Set(['index', 'main', 'cli'])

/** Interpreters and package runners whose script names the process better than the binary. */
export function isInterpreter(name: string): boolean {
  return INTERPRETER.test(name)
}

function packageOf(modulePath: string): string | null {
  const [first, second] = modulePath.split('/')
  if (first === '.bin') {
    return second ?? null
  }
  return first.startsWith('@') && second ? `${first}/${second}` : first || null
}

function labelOfToken(token: string, isModule: boolean): string | null {
  if (token.includes('://')) {
    return null
  }
  let label: string | null
  if (isModule) {
    label = token
  } else if (token.includes('node_modules/')) {
    label = packageOf(token.slice(token.lastIndexOf('node_modules/') + 'node_modules/'.length))
  } else if (token.includes('/')) {
    const parts = token.split('/').filter(Boolean)
    const base = (parts.pop() ?? '').replace(SCRIPT_EXTENSION, '')
    label = GENERIC_ENTRY.has(base) && parts.length > 0 ? (parts.pop() ?? base) : base
  } else if (token.startsWith('@')) {
    // A scoped package name, as npx takes it; drop a version.
    label = token.replace(/^(@[^/@]+\/[^/@]+)@.*$/, '$1')
  } else {
    label = token.replace(SCRIPT_EXTENSION, '').replace(/@.*$/, '')
  }
  return label && LABEL_CHARS.test(label) ? label.slice(0, MAX_LABEL_CHARS) : null
}

/** Script or tool an interpreter argv runs (e.g. "vitest"); null for any other argv. */
export function scriptLabelOf(argv: string): string | null {
  const [program, ...args] = argv.trim().split(/\s+/)
  const interpreter = executableBasename(program)
  if (!interpreter || !INTERPRETER.test(interpreter)) {
    return null
  }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (EVAL_FLAGS.has(arg)) {
      return null
    }
    if (arg === '-m') {
      return args[i + 1] ? labelOfToken(args[i + 1], true) : null
    }
    if (VALUE_FLAGS.has(arg)) {
      i++
      continue
    }
    if (arg.startsWith('-')) {
      continue
    }
    if (i === 0 && SUBCOMMANDS.has(arg) && /^(?:bun|deno)$/.test(interpreter)) {
      continue
    }
    return labelOfToken(arg, false)
  }
  return null
}
