import { describe, expect, it } from 'vitest'
import { buildProcessIndex, parsePsOutput } from './process-index'
import {
  groupOutsideOrcaProcesses,
  listOutsideOrcaRows,
  parseDockerContainerNames
} from './host-outside-orca-processes'

const HARVEY = '07f7800b2084296c851928de35f3c2e16e4ba8934191d13201e8795546d5e670'
const SCRAPER = '9d8d1dceb7d7149b48e7d1c645f67b9a93ddf65431664b5ca9af65746312fc5a'

function index(ps: string) {
  return buildProcessIndex(parsePsOutput(ps, 'command'), null, 'rss')
}

const byName = (groups: ReturnType<typeof groupOutsideOrcaProcesses>) =>
  Object.fromEntries(groups.map((g) => [g.name, g]))

describe('processes outside Orca', () => {
  it('folds macOS helpers into the outermost app bundle and excludes Orca trees', () => {
    const ps = [
      '  1   0  0.0  1024 /sbin/launchd',
      ' 10   1 12.0  2048 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      ' 11  10 30.5  4096 /Applications/Google Chrome.app/Contents/Frameworks/Google Chrome Framework.framework/Versions/1/Helpers/Google Chrome Helper (Renderer).app/Contents/MacOS/Google Chrome Helper (Renderer)',
      ' 20   1  5.0  1024 /Applications/Orca.app/Contents/MacOS/Orca',
      ' 21  20  9.0  1024 /Applications/Orca.app/Contents/Frameworks/Orca Helper.app/Contents/MacOS/Orca Helper',
      ' 22  20  1.0   512 /bin/zsh',
      ' 23  22 50.0   512 node',
      ' 30   1  0.5   256 /Users/me/Secret Tools/postgres'
    ].join('\n')
    const rows = listOutsideOrcaRows(index(ps), [20, null])
    const groups = byName(groupOutsideOrcaProcesses(rows ?? [], 'darwin', null))
    expect(Object.keys(groups).sort()).toEqual(['Google Chrome', 'launchd', 'postgres'])
    expect(groups['Google Chrome']).toEqual({
      kind: 'app',
      name: 'Google Chrome',
      cpu: 42.5,
      memory: 6144 * 1024,
      processCount: 2
    })
    expect(groups.postgres.kind).toBe('command')
  })

  it('folds Linux container cgroups into named containers and skips Orca PTY scopes', () => {
    const pad = ' '.repeat(40)
    const ps = [
      `    1     0  0.1 10436 0::/init.scope${pad}systemd`,
      `    2     0  0.0     0 -${pad}kthreadd`,
      `   40     2  1.0     0 -${pad}kworker/0:1`,
      `  100     1  0.4 31460 0::/system.slice/containerd.service${pad}containerd`,
      `  200   100  2.0  1000 0::/system.slice/docker-${HARVEY}.scope${pad}python`,
      `  201   200  3.0  2000 0::/system.slice/docker-${HARVEY}.scope${pad}gunicorn`,
      `  300   100  1.0   500 12:pids:/docker/${SCRAPER},11:memory:/docker/${SCRAPER}${pad}chrome`,
      `  400     1  0.0   100 0::/user.slice/orca_pty_orca_daemon_x_2.scope${pad}claude`,
      `  500     1  7.0  3000 0::/user.slice/user@1000.service/app.slice${pad}orca-ide`,
      `  501   500  0.0   100 0::/user.slice/user@1000.service/app.slice${pad}ps`,
      `  600     1  4.0   700 0::/user.slice/session-1.scope${pad}Web Content`
    ].join('\n')
    const rows = listOutsideOrcaRows(index(ps), [500])
    const names = parseDockerContainerNames(`${HARVEY} harvey-harvey-1\nnot a row\n`)
    const groups = byName(groupOutsideOrcaProcesses(rows ?? [], 'linux', names))
    expect(Object.keys(groups).sort()).toEqual([
      SCRAPER.slice(0, 12),
      'Web Content',
      'containerd',
      'harvey-harvey-1',
      'kernel',
      'systemd'
    ])
    expect(groups['harvey-harvey-1']).toEqual({
      kind: 'container',
      name: 'harvey-harvey-1',
      cpu: 5,
      memory: 3000 * 1024,
      processCount: 2
    })
    expect(groups.kernel).toMatchObject({ kind: 'kernel', processCount: 2 })
  })

  it('reports nothing when the sweep had no command columns', () => {
    const rows = buildProcessIndex(parsePsOutput('  1  0  0.0  1024\n'), null, 'rss')
    expect(listOutsideOrcaRows(rows, [])).toBeNull()
  })
})
