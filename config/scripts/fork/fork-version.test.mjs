import { describe, expect, it } from 'vitest'
import { nextForkVersion, resolveVersionConflict } from './fork-version.mjs'

describe('fork versions', () => {
  it('counts fork releases per upstream base', () => {
    expect(nextForkVersion('1.4.271')).toBe('1.4.271-fork.1')
    expect(nextForkVersion('1.4.271-fork.1')).toBe('1.4.271-fork.2')
    expect(nextForkVersion('1.4.271-fork.2', '1.4.271')).toBe('1.4.271-fork.3')
    expect(nextForkVersion('1.4.271-fork.2', '1.4.300')).toBe('1.4.300-fork.1')
    expect(() => nextForkVersion('1.4.271-fork.2', '1.4.200')).toThrow()
    expect(() => nextForkVersion('1.4.271-rc.1')).toThrow()
  })

  it('keeps our version line and leaves every other conflict', () => {
    const versionOnly =
      '{\n  "name": "orca",\n<<<<<<< HEAD\n  "version": "1.4.271-fork.1",\n=======\n  "version": "1.4.290",\n>>>>>>> upstream/main\n  "main": "x"\n}\n'
    expect(resolveVersionConflict(versionOnly)).toBe(
      '{\n  "name": "orca",\n  "version": "1.4.271-fork.1",\n  "main": "x"\n}\n'
    )
    const other = '<<<<<<< HEAD\n  "a": "1",\n=======\n  "a": "2",\n>>>>>>> upstream/main\n'
    expect(resolveVersionConflict(other)).toBe(other)
  })
})
