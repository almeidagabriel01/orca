import { describe, expect, it } from 'vitest'
import { compareAppVersions, isPrereleaseAppVersion } from './app-version'

it('orders prereleases by SemVer precedence without rounding legacy numeric identifiers', () => {
  expect(compareAppVersions('v4.2.0-rc.A.10', '4.2.0-rc.a.9')).toBeLessThan(0)
  expect(compareAppVersions('4.2.0-rc.9007199254740992', '4.2.0-rc.9007199254740993')).toBeLessThan(
    0
  )
  expect(compareAppVersions('04.2.0+local', '4.2.0+other')).toBe(0)
})

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
