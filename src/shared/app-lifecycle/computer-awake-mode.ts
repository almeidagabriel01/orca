export const COMPUTER_AWAKE_MODES = ['on', 'off', 'auto'] as const

export type ComputerAwakeMode = (typeof COMPUTER_AWAKE_MODES)[number]

export type ComputerAwakeStatus = {
  mode: ComputerAwakeMode
  active: boolean
}

export function normalizeComputerAwakeMode(
  mode: unknown,
  legacyAutoEnabled?: boolean
): ComputerAwakeMode {
  const explicitMode = COMPUTER_AWAKE_MODES.includes(mode as ComputerAwakeMode)
    ? (mode as ComputerAwakeMode)
    : null
  if (!explicitMode) {
    return legacyAutoEnabled === true ? 'auto' : 'off'
  }
  if (typeof legacyAutoEnabled === 'boolean' && legacyAutoEnabled !== (explicitMode !== 'off')) {
    // Older builds can only change the legacy boolean, so disagreement means it was written later.
    return legacyAutoEnabled ? 'auto' : 'off'
  }
  return explicitMode
}

export function computerAwakeSettingsForMode(mode: ComputerAwakeMode): {
  computerAwakeMode: ComputerAwakeMode
  keepComputerAwakeWhileAgentsRun: boolean
} {
  return {
    computerAwakeMode: mode,
    // Older Orca versions approximate On with their supported Auto behavior.
    keepComputerAwakeWhileAgentsRun: mode !== 'off'
  }
}

/** Keeps the mode and its legacy boolean in step; every settings writer routes through this. */
export function withComputerAwakeSettings<
  T extends { computerAwakeMode?: unknown; keepComputerAwakeWhileAgentsRun?: boolean }
>(updates: T): T {
  if ('computerAwakeMode' in updates) {
    return {
      ...updates,
      ...computerAwakeSettingsForMode(
        normalizeComputerAwakeMode(
          updates.computerAwakeMode,
          updates.keepComputerAwakeWhileAgentsRun
        )
      )
    }
  }
  if ('keepComputerAwakeWhileAgentsRun' in updates) {
    return {
      ...updates,
      ...computerAwakeSettingsForMode(updates.keepComputerAwakeWhileAgentsRun ? 'auto' : 'off')
    }
  }
  return updates
}

export function readComputerAwakeMode(settings: {
  computerAwakeMode?: unknown
  keepComputerAwakeWhileAgentsRun?: boolean
}): ComputerAwakeMode {
  return normalizeComputerAwakeMode(
    settings.computerAwakeMode,
    settings.keepComputerAwakeWhileAgentsRun
  )
}
