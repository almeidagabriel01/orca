import { describe, expect, it } from 'vitest'
import {
  formatUsedOfTotal,
  isHeavyCpu,
  isHeavyMemory,
  loadPercent,
  percentTone,
  usedPercent
} from './resource-host-meters'

const GIB = 1024 ** 3

describe('percentTone', () => {
  it('stays neutral below the warning mark and unknown values', () => {
    expect(percentTone(null)).toBe('normal')
    expect(percentTone(79.9)).toBe('normal')
  })
  it('warns from 80% and turns critical from 90%', () => {
    expect(percentTone(80)).toBe('warning')
    expect(percentTone(89.9)).toBe('warning')
    expect(percentTone(90)).toBe('critical')
    expect(percentTone(140)).toBe('critical')
  })
})

describe('usedPercent', () => {
  it('is unknown without a pair or without a total (no swap)', () => {
    expect(usedPercent(null)).toBeNull()
    expect(usedPercent({ used: 0, total: 0 })).toBeNull()
  })
  it('is the used share', () => {
    expect(usedPercent({ used: 12 * GIB, total: 16 * GIB })).toBe(75)
  })
})

describe('loadPercent', () => {
  it('reads the 1-minute load against the cores', () => {
    expect(loadPercent([8, 1, 1], 8)).toBe(100)
    expect(loadPercent([2, 9, 9], 8)).toBe(25)
  })
  it('is unknown without load or cores', () => {
    expect(loadPercent(null, 8)).toBeNull()
    expect(loadPercent([1, 1, 1], null)).toBeNull()
    expect(loadPercent([1, 1, 1], 0)).toBeNull()
  })
})

describe('formatUsedOfTotal', () => {
  it('picks the unit from the total', () => {
    expect(formatUsedOfTotal({ used: 12.1 * GIB, total: 16 * GIB })).toBe('12.1/16.0 GB')
    expect(formatUsedOfTotal({ used: 210 * GIB, total: 460 * GIB })).toBe('210/460 GB')
    expect(formatUsedOfTotal({ used: 300 * 1024 ** 2, total: 512 * 1024 ** 2 })).toBe('300/512 MB')
  })
})

describe('heavy usage', () => {
  it('flags CPU from 50% and memory from 2 GB, never unsampled rows', () => {
    expect(isHeavyCpu(null)).toBe(false)
    expect(isHeavyCpu(49.9)).toBe(false)
    expect(isHeavyCpu(50)).toBe(true)
    expect(isHeavyMemory(null)).toBe(false)
    expect(isHeavyMemory(2 * GIB - 1)).toBe(false)
    expect(isHeavyMemory(2 * GIB)).toBe(true)
  })
})
