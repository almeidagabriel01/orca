import { describe, expect, it } from 'vitest'
import {
  groupOutsideQueueRows,
  listOutsideQueueRows,
  scriptLabelOf,
  type ProcessDetail
} from './host-outside-queue-processes'
import { buildProcessIndex, type ProcRow } from './process-index'

const GB = 1024 ** 3
const row = (
  pid: number,
  ppid: number,
  cpu: number,
  memory: number,
  command?: string
): ProcRow => ({
  pid,
  ppid,
  cpu,
  memory,
  command
})

describe('listOutsideQueueRows', () => {
  it('keeps terminal sessions and strangers, drops the app, queue jobs and the serve unit', () => {
    const rows = [
      row(100, 1, 300, GB, '/Applications/Orca.app/Contents/MacOS/Orca'),
      row(101, 100, 300, GB, '/Applications/Orca.app/Helper'),
      row(200, 100, 0, 1, '/usr/bin/daemon'),
      row(210, 200, 0, 1, '/bin/zsh'),
      row(211, 210, 90, 1, '/usr/local/bin/node'),
      row(300, 1, 0, 1, '/usr/bin/vps-heavy'),
      row(301, 300, 400, GB, '/usr/bin/cc'),
      row(400, 1, 80, 1, '/usr/bin/xcodebuild')
    ]
    const index = buildProcessIndex(rows, null, 'rss')
    const pids = listOutsideQueueRows({
      index,
      orcaRootPids: [100, null],
      sessionRootPids: [210],
      queuePids: [300],
      platform: 'darwin'
    }).map((r) => r.pid)
    expect(pids.sort((a, b) => a - b)).toEqual([210, 211, 400])
  })

  it('treats a linux orca-serve.service cgroup row as the app', () => {
    const rows = [
      row(10, 1, 200, GB, '0::/system.slice/orca-serve.service node'),
      row(11, 1, 200, GB, '0::/system.slice/cron.service node')
    ]
    const index = buildProcessIndex(rows, null, 'rss')
    const out = listOutsideQueueRows({
      index,
      orcaRootPids: [],
      sessionRootPids: [],
      queuePids: [],
      platform: 'linux'
    })
    expect(out.map((r) => r.pid)).toEqual([11])
  })
})

describe('groupOutsideQueueRows on an overloaded Mac', () => {
  it('folds simulators and Chrome, drops light rows, orders by weight and attributes workspaces', () => {
    const sim = (n: number): ProcRow[] => [
      row(400 + n, 1, 0, 1, '/Library/Developer/CoreSimulator/Profiles/Runtimes/launchd_sim'),
      row(
        410 + n,
        400 + n,
        40,
        200 * 1024 ** 2,
        '/x/CoreSimulator/Devices/A/x.simruntime/SpringBoard'
      )
    ]
    const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    const rows = [
      ...sim(0),
      ...sim(1),
      ...sim(2),
      row(500, 1, 1, 1, '/usr/local/bin/node'),
      row(510, 500, 30, GB, chrome),
      row(511, 510, 30, 2 * GB, `${chrome} Helper`),
      row(600, 1, 1, 1024, '/usr/bin/git'),
      row(699, 1, 0, 1, '/bin/zsh'),
      row(700, 699, 400, GB, '/usr/local/bin/node')
    ]
    const details = new Map<number, ProcessDetail>([
      [
        500,
        {
          command: 'node /usr/local/lib/node_modules/lighthouse/cli/index.js https://x.com',
          cwd: '/'
        }
      ],
      [510, { command: chrome, cwd: '/' }],
      [511, { command: chrome, cwd: '/' }],
      [699, { command: '-zsh', cwd: '/repo/wt' }],
      [700, { command: 'node /r/node_modules/vitest/vitest.mjs run', cwd: null }]
    ])
    const ws = { worktreeId: 'w1', worktreeName: 'wt', repoName: 'repo' }
    const groups = groupOutsideQueueRows(rows, details, {
      index: buildProcessIndex(rows, null, 'rss'),
      platform: 'darwin',
      containerNames: null,
      workspaceOf: (cwd) => (cwd === '/repo/wt' ? ws : null),
      home: '/Users/me'
    })
    expect(groups.map((g) => [g.name, g.kind, g.count, g.launcher])).toEqual([
      ['node vitest', 'command', 1, undefined],
      ['Google Chrome', 'app', 2, 'lighthouse'],
      ['iOS Simulator', 'app', 3, undefined]
    ])
    expect(groups[0].workspace).toEqual(ws)
  })
})

describe('scriptLabelOf', () => {
  it.each([
    ['node /repo/node_modules/vitest/vitest.mjs run', 'vitest'],
    ['node /x/node_modules/.bin/vitest', 'vitest'],
    ['node /usr/local/lib/node_modules/lighthouse/cli/index.js https://x.com', 'lighthouse'],
    ['node /r/node_modules/next/dist/bin/next dev', 'next'],
    ['node --require ./setup.js server.js', 'server'],
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
