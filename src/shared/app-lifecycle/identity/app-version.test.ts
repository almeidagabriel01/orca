import { describe, expect, it } from 'vitest'
import { compareAppVersions, isPrereleaseAppVersion } from './app-version'

describe('fork versions', () => {
  it('sort after their upstream base and before the next upstream release', () => {
    const ordered = [
      '1.4.271-rc.2',
      '1.4.271',
      '1.4.271-fork.1',
      '1.4.271-fork.2',
      '1.4.271-fork.10',
      '1.4.272-rc.1',
      '1.4.272'
    ]
    for (let index = 1; index < ordered.length; index += 1) {
      expect(compareAppVersions(ordered[index - 1], ordered[index])).toBeLessThan(0)
      expect(compareAppVersions(ordered[index], ordered[index - 1])).toBeGreaterThan(0)
    }
    expect(compareAppVersions('1.4.271-fork.2', '1.4.271-fork.2')).toBe(0)
    expect(isPrereleaseAppVersion('1.4.271-fork.2')).toBe(false)
    expect(isPrereleaseAppVersion('1.4.271-rc.2')).toBe(true)
  })
})
