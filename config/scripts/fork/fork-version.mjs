#!/usr/bin/env node
// Fork versions read <upstream version>-fork.<n>: the base is the upstream release the fork is built
// on, n counts the fork's own releases. See docs/fork-releases.md.
//   node config/scripts/fork/fork-version.mjs                  1.4.271-fork.1 -> 1.4.271-fork.2
//   node config/scripts/fork/fork-version.mjs --base 1.4.272   -> 1.4.272-fork.1
//   node config/scripts/fork/fork-version.mjs --resolve-conflict   keep our version line in a merge
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const STABLE = /^\d+\.\d+\.\d+$/
const FORK = /^(\d+\.\d+\.\d+)-fork\.(\d+)$/

function compareCore(left, right) {
  const a = left.split('.').map(Number)
  const b = right.split('.').map(Number)
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
}

/** Next fork version; a plain X.Y.Z (upstream's own version) counts as its own base. */
export function nextForkVersion(current, base) {
  const forked = FORK.exec(current)
  const currentBase = forked?.[1] ?? (STABLE.test(current) ? current : null)
  if (currentBase === null) {
    throw new Error(`Cannot bump '${current}': expected X.Y.Z or X.Y.Z-fork.N.`)
  }
  const count = forked ? Number(forked[2]) : 0
  if (base === undefined) {
    return `${currentBase}-fork.${count + 1}`
  }
  if (!STABLE.test(base)) {
    throw new Error(`--base must be a stable X.Y.Z version, got '${base}'.`)
  }
  const order = compareCore(base, currentBase)
  if (order < 0) {
    throw new Error(`--base ${base} is older than the current base ${currentBase}.`)
  }
  return order === 0 ? `${currentBase}-fork.${count + 1}` : `${base}-fork.1`
}

/** Upstream bumping its version line conflicts with ours on every sync: keep ours, leave any other conflict. */
export function resolveVersionConflict(text) {
  return text.replace(
    /^<{7}[^\n]*\n( *"version": "[^"\n]*",\n)(?:\|{7}[^\n]*\n *"version": "[^"\n]*",\n)?={7}\n *"version": "[^"\n]*",\n>{7}[^\n]*\n/m,
    '$1'
  )
}

function main(argv) {
  const packagePath = resolve('package.json')
  const text = readFileSync(packagePath, 'utf8')
  if (argv[0] === '--resolve-conflict') {
    const resolved = resolveVersionConflict(text)
    if (/^(<{7}|={7}|>{7})/m.test(resolved)) {
      throw new Error('package.json has conflicts besides the version line.')
    }
    writeFileSync(packagePath, resolved)
    return
  }
  const baseIndex = argv.indexOf('--base')
  const base = baseIndex === -1 ? undefined : argv[baseIndex + 1]
  const current = JSON.parse(text).version
  const next = nextForkVersion(current, base)
  writeFileSync(packagePath, text.replace(`"version": "${current}"`, `"version": "${next}"`))
  console.log(next)
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  main(process.argv.slice(2))
}
