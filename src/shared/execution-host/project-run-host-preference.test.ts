import { describe, expect, it } from 'vitest'
import { getEffectiveRunHostId } from './project-run-host-preference'

const VPS = 'runtime:vps' as const
const MAC = 'local' as const

describe('getEffectiveRunHostId', () => {
  it('prefers the project value over the global default', () => {
    expect(
      getEffectiveRunHostId({ projectRunHostIds: { p: MAC }, heavyRunHostDefault: VPS }, 'p', [
        MAC,
        VPS
      ])
    ).toEqual({ hostId: MAC, source: 'project' })
  })

  it('uses the global default when the project has none', () => {
    expect(
      getEffectiveRunHostId({ projectRunHostIds: { other: MAC }, heavyRunHostDefault: VPS }, 'p', [
        MAC,
        VPS
      ])
    ).toEqual({ hostId: VPS, source: 'global' })
  })

  it('falls back with a reason when the preferred host lacks the project', () => {
    const settings = { projectRunHostIds: { p: VPS }, heavyRunHostDefault: MAC }
    expect(getEffectiveRunHostId(settings, 'p', [MAC])).toEqual({
      hostId: MAC,
      source: 'global',
      fallbackFrom: { hostId: VPS, reason: 'project_missing' }
    })
    expect(getEffectiveRunHostId(settings, 'p', [MAC], [MAC])).toEqual({
      hostId: MAC,
      source: 'global',
      fallbackFrom: { hostId: VPS, reason: 'host_unavailable' }
    })
    expect(getEffectiveRunHostId(settings, 'p', [])).toBeNull()
  })

  it('returns null when nothing is set', () => {
    expect(getEffectiveRunHostId({}, 'p', [MAC, VPS])).toBeNull()
    expect(getEffectiveRunHostId({ heavyRunHostDefault: null }, 'p', [MAC])).toBeNull()
  })
})
