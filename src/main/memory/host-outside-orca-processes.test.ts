import { describe, expect, it } from 'vitest'
import { buildProcessIndex, type ProcRow } from './process-index'
import { parseHeavyQueueJob } from './host-heavy-command-queue'
import {
  groupOutsideRows,
  heavyQueueRoots,
  listOutsideRows,
  parseDockerContainerNames,
  type ProcessDetail
} from './host-outside-orca-processes'
import { scriptLabelOf } from './process-script-label'

const GB = 1024 ** 3
const HARVEY = '07f7800b2084296c851928de35f3c2e16e4ba8934191d13201e8795546d5e670'
const row = (pid: number, ppid: number, cpu: number, memory: number, command: string): ProcRow => ({
  pid,
  ppid,
  cpu,
  memory,
  command
})
const ctx = (rows: ProcRow[], platform: NodeJS.Platform) => ({
  index: buildProcessIndex(rows, null, 'rss'),
  platform,
  containerNames: parseDockerContainerNames(`${HARVEY} harvey-harvey-1\n`),
  workspaceOf: (cwd: string) =>
    cwd === '/repo/wt' ? { worktreeId: 'w1', worktreeName: 'wt', repoName: 'repo' } : null,
  home: '/Users/me',
  rootOwned: new Set([1, 700])
})

describe('one outside list per host', () => {
  it('counts every process outside Orca once and marks heavy work the queue did not start', () => {
    const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    const rows = [
      row(1, 0, 0, 1, '/sbin/launchd'),
      row(100, 1, 300, GB, '/Applications/Orca.app/Contents/MacOS/Orca'),
      row(101, 100, 300, GB, '/Applications/Orca.app/Contents/Frameworks/Orca Helper.app/x'),
      row(200, 100, 0, 1, '/bin/zsh'),
      row(201, 200, 400, GB, '/usr/local/bin/node'),
      row(202, 200, 1, 1, '/usr/bin/git'),
      row(300, 1, 0, 1, '/usr/bin/vps-heavy'),
      row(301, 300, 400, 2 * GB, '/usr/bin/cc'),
      row(400, 1, 30, GB, chrome),
      row(401, 400, 30, GB, `${chrome} Helper.app/Contents/MacOS/Helper`),
      row(500, 1, 0, 1, '/Library/Developer/CoreSimulator/Profiles/launchd_sim'),
      row(501, 500, 40, 200, '/x/CoreSimulator/Devices/A/x.simruntime/SpringBoard')
    ]
    const index = buildProcessIndex(rows, null, 'rss')
    const outside = listOutsideRows(
      index,
      {
        appRootPids: [100, null],
        sessionRootPids: [200],
        queue: new Map([[300, { slot: 1, command: 'make' }]])
      },
      'darwin'
    )
    const details = new Map<number, ProcessDetail>([[400, { command: chrome, cwd: '/repo/wt' }]])
    const groups = groupOutsideRows(outside ?? [], details, ctx(rows, 'darwin'))
    const byName = Object.fromEntries(groups.map((g) => [g.name, g]))

    // Orca's app, terminals and agents stay out; everything else is listed exactly once.
    expect(outside?.map((r) => r.pid).sort((a, b) => a - b)).toEqual([
      1, 300, 301, 400, 401, 500, 501
    ])
    expect(groups.reduce((sum, g) => sum + g.processCount, 0)).toBe(outside!.length)
    expect(groups.reduce((sum, g) => sum + g.cpu, 0)).toBe(0 + 0 + 400 + 60 + 40)
    expect(byName['node vitest']).toBeUndefined()
    expect(byName.cc).not.toHaveProperty('heavy')
    expect(byName.cc.queue).toEqual({ slot: 1, command: 'make' })
    expect(byName['Google Chrome']).toMatchObject({
      heavy: true,
      processCount: 2,
      cpu: 60,
      workspace: { worktreeName: 'wt' }
    })
    expect(byName['iOS Simulator']).toMatchObject({ heavy: true, processCount: 2, devices: 1 })
    expect(byName.Orca).toBeUndefined()
  })

  it('leaves out Linux PTY scopes and every other Orca unit', () => {
    const pad = ' '.repeat(40)
    const rows = [
      row(2, 0, 0, 0, `-${pad}kthreadd`),
      row(40, 2, 90, 0, `-${pad}kworker/0:1`),
      row(200, 1, 2, GB, `0::/system.slice/docker-${HARVEY}.scope${pad}python`),
      row(400, 1, 0, 1, `0::/user.slice/orca_pty_orca_daemon_x_2.scope${pad}bash`),
      row(401, 400, 99, 1, `0::/user.slice/app.slice/app-Chrome-401.scope${pad}chrome`),
      row(450, 1, 99, GB, `0::/user.slice/app.slice/orca-serve.service${pad}node`),
      row(460, 1, 99, GB, `0::/user.slice/app.slice/app-orca-460.scope${pad}orca-ide`)
    ]
    const index = buildProcessIndex(rows, null, 'rss')
    const outside = listOutsideRows(
      index,
      { appRootPids: [], sessionRootPids: [], queue: new Map() },
      'linux'
    )
    expect(outside?.map((r) => r.pid)).toEqual([2, 40, 200])
    const groups = groupOutsideRows(outside ?? [], new Map(), ctx(rows, 'linux'))
    expect(groups.map((g) => [g.name, g.kind, g.heavy])).toEqual([
      ['kernel', 'kernel', undefined],
      ['harvey-harvey-1', 'container', true]
    ])
  })

  it('never marks the OS or a runner job holding a slot', () => {
    const pad = ' '.repeat(40)
    const runner = '0::/system.slice/actions.runner.x.service'
    const rows = [
      row(1, 0, 0, 1, `0::/init.scope${pad}systemd`),
      row(700, 1, 99, GB, `0::/system.slice/docker.service${pad}dockerd`),
      row(710, 1, 1, 1, `${runner}${pad}Runner.Worker`),
      row(711, 710, 120, 1, `${runner}${pad}npm ci`),
      row(720, 1, 80, 1, `0::/system.slice/postgresql.service${pad}postgres`),
      row(800, 1, 0, 1, `0::/user.slice/session-1.scope${pad}python3`)
    ]
    const hold = parseHeavyQueueJob({
      pid: 800,
      status: 'running',
      slot: 2,
      queuedAt: 1_795_612_620,
      cwd: '/w',
      command: 'GitHub Actions · repo · ci/build',
      hold: true,
      watch: 710
    })
    const outside = listOutsideRows(
      buildProcessIndex(rows, null, 'rss'),
      { appRootPids: [], sessionRootPids: [], queue: heavyQueueRoots(hold ? [hold] : []) },
      'linux'
    )
    const groups = groupOutsideRows(outside ?? [], new Map(), ctx(rows, 'linux'))
    expect(groups.filter((g) => g.heavy).map((g) => g.name)).toEqual(['postgres'])
    expect(groups.find((g) => g.name === 'npm ci')?.queue).toEqual({
      slot: 2,
      command: 'GitHub Actions · repo · ci/build'
    })

    const mac = [
      row(1, 0, 90, GB, '/System/Library/PrivateFrameworks/SkyLight.framework/WindowServer'),
      row(2, 1, 50, 1, '(pairedsyncd)'),
      row(3, 1, 50, 1, '/opt/homebrew/bin/node')
    ]
    const macRows = listOutsideRows(
      buildProcessIndex(mac, null, 'rss'),
      { appRootPids: [], sessionRootPids: [], queue: new Map() },
      'darwin'
    )
    const macGroups = groupOutsideRows(macRows ?? [], new Map(), ctx(mac, 'darwin'))
    expect(macGroups.filter((g) => g.heavy).map((g) => g.name)).toEqual(['node'])
  })

  it('reports nothing when the sweep had no command columns', () => {
    const index = buildProcessIndex([{ pid: 1, ppid: 0, cpu: 0, memory: 1 }], null, 'rss')
    expect(
      listOutsideRows(index, { appRootPids: [], sessionRootPids: [], queue: new Map() }, 'linux')
    ).toBeNull()
  })
})

describe('scriptLabelOf', () => {
  it.each([
    ['node /repo/node_modules/vitest/vitest.mjs run', 'vitest'],
    ['node /usr/local/lib/node_modules/lighthouse/cli/index.js https://x.com', 'lighthouse'],
    ['python3 -m http.server 8000', 'http.server'],
    ['/usr/bin/git status', null]
  ])('%s -> %s', (argv, label) => {
    expect(scriptLabelOf(argv)).toBe(label)
  })

  it('never leaks a URL or exceeds 40 safe characters', () => {
    const label = scriptLabelOf(`node https://user:secret@x.com/${'a'.repeat(80)}`)
    expect(label ?? '').toMatch(/^[A-Za-z0-9@._/-]{0,40}$/)
  })
})
