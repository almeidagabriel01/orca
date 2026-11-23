import { describe, expect, it } from 'vitest'
import { cmdlineText, parseDarwinPsDetails, parseEtimeSeconds } from './session-process-tree'

describe('session process details', () => {
  it('reads Linux cmdline and macOS ps rows', () => {
    expect(cmdlineText('node\0/repo/node_modules/.bin/vitest\0run\0')).toBe(
      'node /repo/node_modules/.bin/vitest run'
    )
    expect(cmdlineText('')).toBeNull()
    expect(parseEtimeSeconds('05:07')).toBe(307)
    expect(parseEtimeSeconds('2-03:04:05')).toBe(((2 * 24 + 3) * 60 + 4) * 60 + 5)
    expect(parseEtimeSeconds('junk')).toBeNull()
    const rows = parseDarwinPsDetails(' 4242   01:00 /usr/bin/node a b.test.ts\n', 100_000)
    expect(rows.get(4242)).toEqual({
      command: '/usr/bin/node a b.test.ts',
      cwd: null,
      startedAt: 40_000
    })
  })
})
