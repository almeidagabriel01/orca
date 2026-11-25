import { describe, expect, it } from 'vitest'
import { findCommandBlockers, type CommandCheckEnv } from './heavy-command-executable-check'

function fakeEnv(opts: {
  bins: string[]
  files?: Record<string, string>
  docker?: boolean
}): CommandCheckEnv {
  const files = opts.files ?? {}
  return {
    cwd: '/repo',
    pathDirs: ['/usr/bin', '/bin'],
    isExecutable: async (p) => opts.bins.includes(p),
    readText: async (p) => files[p] ?? null,
    dockerAvailable: async () => opts.docker ?? false
  }
}
const linux = [
  '/usr/bin/pnpm',
  '/usr/bin/npm',
  '/usr/bin/npx',
  '/usr/bin/bash',
  '/usr/bin/make',
  '/usr/bin/vitest',
  '/usr/bin/cat',
  '/usr/bin/echo'
]
const pkg = (scripts: Record<string, string>) => ({
  '/repo/package.json': JSON.stringify({ scripts })
})

describe('findCommandBlockers', () => {
  it('rejects xcodebuild by its absence and accepts it where present', async () => {
    expect(await findCommandBlockers(['xcodebuild', 'build'], fakeEnv({ bins: linux }))).toEqual([
      { code: 'executable_missing', detail: 'xcodebuild' }
    ])
    expect(
      await findCommandBlockers(['xcodebuild'], fakeEnv({ bins: ['/usr/bin/xcodebuild'] }))
    ).toEqual([])
  })

  it('checks pnpm scripts and their binaries', async () => {
    const env = fakeEnv({ bins: linux, files: pkg({ test: 'vitest run', ios: 'xcodebuild x' }) })
    expect(await findCommandBlockers(['pnpm', 'test'], env)).toEqual([])
    expect(await findCommandBlockers(['pnpm', 'nope'], env)).toEqual([
      { code: 'script_missing', detail: 'nope' }
    ])
    expect(await findCommandBlockers(['pnpm', 'install'], env)).toEqual([])
  })

  it('follows nested npm run scripts to the missing binary', async () => {
    const env = fakeEnv({
      bins: linux,
      files: pkg({ ci: 'npm run build && echo ok', build: 'tsc -b' })
    })
    expect(await findCommandBlockers(['npm', 'run', 'ci'], env)).toEqual([
      { code: 'executable_missing', detail: 'tsc' }
    ])
  })

  it('finds script binaries in node_modules/.bin', async () => {
    const env = fakeEnv({
      bins: [...linux, '/repo/node_modules/.bin/tsc'],
      files: pkg({ build: 'tsc -b' })
    })
    expect(await findCommandBlockers(['npm', 'run', 'build'], env)).toEqual([])
    expect(await findCommandBlockers(['pnpm', 'exec', 'tsc'], env)).toEqual([])
    expect(await findCommandBlockers(['npx', '-y', 'whatever'], env)).toEqual([])
  })

  it('checks every command in bash -c', async () => {
    const env = fakeEnv({ bins: linux })
    expect(
      await findCommandBlockers(['bash', '-c', 'cd x && vitest run; "xcodebuild" -v | cat'], env)
    ).toEqual([{ code: 'executable_missing', detail: 'xcodebuild' }])
  })

  it('checks make targets', async () => {
    const env = fakeEnv({
      bins: linux,
      files: { '/repo/Makefile': 'all:\n\ttrue\nbuild: all\n\ttrue\n' }
    })
    expect(await findCommandBlockers(['make', 'build'], env)).toEqual([])
    expect(await findCommandBlockers(['make', 'deploy'], env)).toEqual([
      { code: 'script_missing', detail: 'make deploy' }
    ])
  })

  it('requires docker only when resolved command is docker', async () => {
    const bins = [...linux, '/usr/bin/docker']
    expect(await findCommandBlockers(['docker', 'compose', 'up'], fakeEnv({ bins }))).toEqual([
      { code: 'docker_unavailable' }
    ])
    expect(
      await findCommandBlockers(['docker', 'compose', 'up'], fakeEnv({ bins, docker: true }))
    ).toEqual([])
  })

  it('strips env assignments and unwraps heavy --group', async () => {
    const env = fakeEnv({ bins: linux })
    expect(await findCommandBlockers(['CI=1', 'FOO=bar', 'vitest', 'run'], env)).toEqual([])
    expect(
      await findCommandBlockers(
        ['vps-heavy', '--group', 'x', '--', 'env', 'A=1', 'xcodebuild'],
        env
      )
    ).toEqual([{ code: 'executable_missing', detail: 'xcodebuild' }])
  })
})
