import type { SessionProcess } from '../../../../../../shared/diagnostics/process-stats-types'

const MAX_TOKEN_CHARS = 60
const HOME_DIR = /^\/(?:home|Users)\/[^/]+(?=\/|$)/
const NODE_MODULES = 'node_modules/'

/** cpu and memory are the whole subtree's. */
export type ProcessNode = {
  process: SessionProcess
  children: ProcessNode[]
  cpu: number
  memory: number
}

export type ProcessSiblingGroup = {
  key: string
  label: string
  nodes: ProcessNode[]
  cpu: number
  memory: number
}

export function buildProcessForest(processes: readonly SessionProcess[]): ProcessNode[] {
  const nodes = new Map<number, ProcessNode>()
  for (const process of [...processes].sort((a, b) => a.pid - b.pid)) {
    nodes.set(process.pid, { process, children: [], cpu: 0, memory: 0 })
  }
  const roots: ProcessNode[] = []
  for (const node of nodes.values()) {
    const parent = nodes.get(node.process.ppid)
    ;(parent && parent !== node ? parent.children : roots).push(node)
  }
  const total = (node: ProcessNode): void => {
    node.cpu = node.process.cpu
    node.memory = node.process.memory
    for (const child of node.children) {
      total(child)
      node.cpu += child.cpu
      node.memory += child.memory
    }
  }
  roots.forEach(total)
  return roots
}

function shortenPath(path: string, base: string | null): string {
  const modules = path.lastIndexOf(NODE_MODULES)
  if (modules !== -1) {
    // Covers node_modules/.bin and the pnpm store's .pnpm/<pkg>@<version>/node_modules/<pkg>.
    return path.slice(modules + NODE_MODULES.length).replace(/^\.bin\//, '')
  }
  if (base && path.startsWith(`${base}/`)) {
    return path.slice(base.length + 1)
  }
  return path.replace(HOME_DIR, '~')
}

function truncateToken(token: string): string {
  return token.length > MAX_TOKEN_CHARS
    ? `${token.slice(0, MAX_TOKEN_CHARS / 2 - 1)}…${token.slice(-(MAX_TOKEN_CHARS / 2 - 1))}`
    : token
}

function shortenToken(token: string, base: string | null): string {
  const option = /^(-[^=]*=)(.*)$/.exec(token)
  return option ? option[1] + shortenPath(option[2], base) : shortenPath(token, base)
}

function shortenTokens(command: string, base: string | null): string[] {
  const [executable = '', ...args] = command.split(/\s+/).filter(Boolean)
  return [
    executable.slice(executable.lastIndexOf('/') + 1),
    ...args.map((arg) => shortenToken(arg, base))
  ]
}

function joinTruncated(tokens: readonly string[]): string {
  return tokens.map(truncateToken).join(' ')
}

/** The command with its executable's name, paths shortened; the full text stays on the process. */
export function shortenCommand(command: string, base: string | null): string {
  return joinTruncated(shortenTokens(command, base))
}

/** Siblings with the same shape fold together: files become `*.ext`, numbers `#`. */
function commandShape(tokens: readonly string[]): string[] {
  return tokens.map((token, index) => {
    if (index === 0) {
      return token
    }
    const name = token.slice(token.lastIndexOf('/') + 1)
    const dot = name.indexOf('.', 1)
    const file =
      !token.startsWith('-') && !/^[\d.]+$/.test(token) && (token.includes('/') || dot !== -1)
    // Digit runs differ between workers of one pool (ids, ports, "(vitest 3)").
    return file ? `*${dot === -1 ? '' : name.slice(dot)}` : token.replace(/\d+/g, '#')
  })
}

export function processLabel(process: SessionProcess, base: string | null): string | null {
  return process.command ? shortenCommand(process.command, base) : null
}

export function groupSiblings(
  nodes: readonly ProcessNode[],
  base: string | null
): ProcessSiblingGroup[] {
  const groups = new Map<string, ProcessSiblingGroup>()
  for (const node of nodes) {
    // Shaped before truncation, so long tokens that differ only in the middle still fold.
    const tokens = node.process.command ? shortenTokens(node.process.command, base) : null
    const shape = tokens ? commandShape(tokens) : null
    const label = tokens ? joinTruncated(tokens) : null
    const key = shape ? shape.join(' ') : `pid:${node.process.pid}`
    const group = groups.get(key)
    if (group) {
      group.nodes.push(node)
      group.cpu += node.cpu
      group.memory += node.memory
      // Identical commands keep their text; differing ones show the shape they share.
      group.label = group.label === label || !shape ? group.label : joinTruncated(shape)
    } else {
      groups.set(key, {
        key,
        label: label ?? key,
        nodes: [node],
        cpu: node.cpu,
        memory: node.memory
      })
    }
  }
  return [...groups.values()]
}

/** The folder relative to the workspace, '.' for the workspace itself, or ~-shortened elsewhere. */
export function relativeCwd(cwd: string | null, base: string | null): string | null {
  if (!cwd) {
    return null
  }
  if (base && cwd === base) {
    return '.'
  }
  return base && cwd.startsWith(`${base}/`)
    ? cwd.slice(base.length + 1)
    : cwd.replace(HOME_DIR, '~')
}

export function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  if (seconds < 60) {
    return `${seconds}s`
  }
  if (minutes < 60) {
    return `${minutes}m`
  }
  return hours < 24 ? `${hours}h ${minutes % 60}m` : `${Math.floor(hours / 24)}d ${hours % 24}h`
}
