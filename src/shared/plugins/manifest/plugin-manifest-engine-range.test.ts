import { expect, it } from 'vitest'
import { satisfiesOrcaEngineRange } from './plugin-manifest-engine-range'

it.each([
  ['1.4.278-fork.1', '>=1.4.278', true],
  ['1.4.278-fork.1', '>=1.4.279', false],
  ['1.4.278-rc.1', '>=1.4.278', false],
  ['1.4.278', '>=1.4.278', true]
])('%s satisfies %s: %s', (host, range, expected) => {
  expect(satisfiesOrcaEngineRange(host, range)).toBe(expected)
})
