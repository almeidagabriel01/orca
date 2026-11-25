import { describe, expect, it } from 'vitest'
import { getEffectiveRunHostId, hasRunHostPreference } from './project-run-host-preference'

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

it('treats an ssh alias saved by fork.2 as no preference, so routing stays automatic', () => {
  const settings = {
    projectRunHostIds: { p: 'ssh:vps' as const },
    heavyRunHostDefault: 'ssh:github.com-client-a' as const
  }
  expect(getEffectiveRunHostId(settings, 'p', [MAC, 'ssh:vps', 'ssh:github.com-client-a'])).toBe(
    null
  )
  expect(hasRunHostPreference(settings)).toBe(false)
})
