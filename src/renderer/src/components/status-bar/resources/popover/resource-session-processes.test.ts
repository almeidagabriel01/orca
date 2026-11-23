import { describe, expect, it } from 'vitest'
import type { SessionProcess } from '../../../../../../shared/diagnostics/process-stats-types'
import {
  buildProcessForest,
  groupSiblings,
  relativeCwd,
  shortenCommand
} from './resource-session-processes'

const WS = '/home/me/ws/app'
const proc = (pid: number, ppid: number, command: string | null, cpu = 1): SessionProcess => ({
  pid,
  ppid,
  cpu,
  memory: 10,
  command,
  cwd: WS,
  startedAt: null
})

describe('session process tree', () => {
  it('shortens package paths and folds siblings running the same command', () => {
    expect(
      shortenCommand(
        `/usr/bin/node ${WS}/node_modules/.pnpm/vitest@5.1.0_x/node_modules/vitest/vitest.mjs run`,
        WS
      )
    ).toBe('node vitest/vitest.mjs run')
    expect(
      shortenCommand(`/bin/sh ${WS}/node_modules/.bin/tsc --project=${WS}/tsconfig.json`, WS)
    ).toBe('sh tsc --project=tsconfig.json')
    expect(relativeCwd(`${WS}/packages/a`, WS)).toBe('packages/a')
    expect(relativeCwd('/home/me/other', WS)).toBe('~/other')

    const [root] = buildProcessForest([
      proc(10, 1, 'zsh'),
      proc(11, 10, `node ${WS}/node_modules/.bin/vitest`),
      ...[12, 13, 14].map((pid) => proc(pid, 11, `node ${WS}/src/f${pid}.test.ts`, 2))
    ])
    expect(root.cpu).toBe(1 + 1 + 6)
    const groups = groupSiblings(root.children[0].children, WS)
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ label: 'node *.test.ts', cpu: 6, memory: 30 })
    expect(groups[0].nodes).toHaveLength(3)
  })
})
