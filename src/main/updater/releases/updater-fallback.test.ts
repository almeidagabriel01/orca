import { describe, expect, it } from 'vitest'
import { compareVersions } from './updater-fallback'

describe('compareVersions with fork builds', () => {
  it.each([
    ['1.4.278-fork.1', '1.4.278', 1],
    ['1.4.278-fork.1', '1.4.279', -1],
    ['1.4.278-fork.1', '1.4.278-fork.2', -1],
    ['1.4.277-fork.9', '1.4.278-fork.1', -1],
    ['1.4.278-fork.1', '1.4.278-rc.1', 1]
  ])('%s vs %s', (left, right, expected) => {
    expect(Math.sign(compareVersions(left, right))).toBe(expected)
    expect(Math.sign(compareVersions(right, left))).toBe(-expected)
  })
})
