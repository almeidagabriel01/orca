import { describe, expect, it } from 'vitest'
import { buildProcessIndex, type ProcRow } from './process-index'
import { parseHeavyQueueJob } from './host-heavy-command-queue'
import {
  groupOutsideRows,
  partitionHostRows,
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

const names = (groups: readonly { name: string }[]) => groups.map((g) => g.name).sort()
const none = { appRootPids: [], sessionRootPids: [], jobs: [] }

describe('outside lists per host', () => {
  it('puts every process in exactly one place', () => {
    const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    const rows = [
      row(1, 0, 0, 1, '/sbin/launchd'),
      row(100, 1, 300, GB, '/Applications/Orca.app/Contents/MacOS/Orca'),
      row(101, 100, 300, GB, '/Applications/Orca.app/Contents/Frameworks/Orca Helper.app/x'),
      row(200, 100, 0, 1, '/bin/zsh'),
      row(201, 200, 400, GB, '/usr/local/bin/node'),
      row(210, 200, 0, 1, '/usr/local/bin/vps-heavy'),
      row(211, 210, 300, GB, '/usr/bin/cc'),
      row(300, 1, 0, 1, '/usr/local/bin/vps-heavy'),
      row(301, 300, 400, 2 * GB, '/usr/bin/cc'),
      row(400, 1, 30, GB, chrome),
      row(401, 400, 30, GB, `${chrome} Helper.app/Contents/MacOS/Helper`),
      row(500, 1, 0, 1, '/Library/Developer/CoreSimulator/Profiles/launchd_sim'),
      row(501, 500, 40, 200, '/x/CoreSimulator/Devices/A/x.simruntime/SpringBoard'),
      row(600, 1, 90, 1, '/System/Library/PrivateFrameworks/SkyLight.framework/WindowServer'),
      row(601, 1, 2, 1, '/Applications/Notes.app/Contents/MacOS/Notes')
    ]
    const index = buildProcessIndex(rows, null, 'rss')
    const partition = partitionHostRows(
      index,
      { appRootPids: [100, null], sessionRootPids: [200], jobs: [{ pid: 300 }, { pid: 210 }] },
      'darwin'
    )
    const details = new Map<number, ProcessDetail>([[400, { command: chrome, cwd: '/repo/wt' }]])
    const { outsideQueue, outsideOrca } = groupOutsideRows(
      partition?.outside ?? [],
      details,
      ctx(rows, 'darwin')
    )

    // App 100-101 and session 200-201 drop out; queue jobs win over the terminal that started them.
    const places = [...(partition?.jobs.values() ?? []), ...outsideQueue, ...outsideOrca].reduce(
      (sum, g) => sum + g.processCount,
      0
    )
    expect(places).toBe(rows.length - 4)
    expect(partition?.jobs.get(300)).toEqual({ cpu: 400, memory: 2 * GB + 1, processCount: 2 })
    expect(partition?.jobs.get(210)).toEqual({ cpu: 300, memory: GB + 1, processCount: 2 })
    expect(names(outsideQueue)).toEqual(['Google Chrome', 'iOS Simulator'])
    expect(names(outsideOrca)).toEqual(['Notes', 'WindowServer', 'launchd'])
    expect(outsideQueue.find((g) => g.name === 'Google Chrome')).toMatchObject({
      processCount: 2,
      cpu: 60,
      workspace: { worktreeName: 'wt' }
    })
    expect(outsideQueue.find((g) => g.name === 'iOS Simulator')).toMatchObject({
      processCount: 2,
      devices: 1
    })
  })

  it('gives a held runner slot its watched tree, and keeps Linux system units and Orca out', () => {
    const pad = ' '.repeat(40)
    const runner = '0::/system.slice/actions.runner.x.service'
    const rows = [
      row(1, 0, 0, 1, `0::/init.scope${pad}systemd`),
      row(2, 0, 0, 0, `-${pad}kthreadd`),
      row(40, 2, 90, 0, `-${pad}kworker/0:1`),
      row(200, 1, 2, GB, `0::/system.slice/docker-${HARVEY}.scope${pad}python`),
      row(400, 1, 0, 1, `0::/user.slice/orca_pty_orca_daemon_x_2.scope${pad}bash`),
      row(401, 400, 99, 1, `0::/user.slice/app.slice/app-Chrome-401.scope${pad}chrome`),
      row(450, 1, 99, GB, `0::/user.slice/app.slice/orca-serve.service${pad}node`),
      row(460, 1, 99, GB, `0::/user.slice/app.slice/app-orca-460.scope${pad}orca-ide`),
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
    const partition = partitionHostRows(
      buildProcessIndex(rows, null, 'rss'),
      { ...none, jobs: hold ? [hold] : [] },
      'linux'
    )
    expect(partition?.jobs.get(800)).toEqual({ cpu: 121, memory: 3, processCount: 3 })
    const { outsideQueue, outsideOrca } = groupOutsideRows(
      partition?.outside ?? [],
      new Map(),
      ctx(rows, 'linux')
    )
    expect(names(outsideQueue)).toEqual(['harvey-harvey-1', 'postgres'])
    expect(names(outsideOrca)).toEqual(['dockerd', 'kernel', 'systemd'])
  })

  it('reports nothing when the sweep had no command columns', () => {
    const index = buildProcessIndex([{ pid: 1, ppid: 0, cpu: 0, memory: 1 }], null, 'rss')
    expect(partitionHostRows(index, none, 'linux')).toBeNull()
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
