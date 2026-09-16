const MODIFIERS = new Map([
  ['ctrl', 'CommandOrControl'],
  ['control', 'CommandOrControl'],
  ['commandorcontrol', 'CommandOrControl'],
  ['cmdorctrl', 'CommandOrControl'],
  ['alt', 'Alt'],
  ['option', 'Alt'],
  ['shift', 'Shift'],
  ['command', 'Super'],
  ['cmd', 'Super'],
  ['super', 'Super']
])

const NAMED_KEYS = new Set([
  'Escape', 'Tab', 'Capslock', 'Space', 'PageUp', 'PageDown', 'End', 'Home',
  'Left', 'Up', 'Right', 'Down', 'Insert', 'Delete', 'Backspace', 'Enter',
  'Plus', 'Minus', 'PrintScreen', 'MediaPlayPause', 'MediaStop', 'MediaNextTrack',
  'MediaPreviousTrack', 'VolumeUp', 'VolumeDown', 'VolumeMute'
])

function normalizeKey(value: string): string | null {
  const key = value.trim()
  if (/^[a-z]$/i.test(key)) return key.toUpperCase()
  if (/^\d$/.test(key)) return key
  if (/^F(?:[1-9]|1\d|2[0-4])$/i.test(key)) return key.toUpperCase()
  const named = [...NAMED_KEYS].find((candidate) => candidate.toLowerCase() === key.toLowerCase())
  return named ?? null
}

/** Returns a canonical Electron accelerator or null for an unsafe/invalid value. */
export function normalizeBossShortcut(value: string): string | null {
  const parts = value.split('+').map((part) => part.trim()).filter(Boolean)
  if (parts.length < 2) return null
  const modifiers: string[] = []
  let key: string | null = null
  for (const part of parts) {
    const modifier = MODIFIERS.get(part.toLowerCase())
    if (modifier) {
      if (!modifiers.includes(modifier)) modifiers.push(modifier)
      continue
    }
    if (key || !normalizeKey(part)) return null
    key = normalizeKey(part)
  }
  if (!key || modifiers.length === 0) return null
  const ordered = ['CommandOrControl', 'Super', 'Alt', 'Shift'].filter((modifier) => modifiers.includes(modifier))
  return [...ordered, key].join('+')
}

export function isValidBossShortcut(value: string): boolean {
  return normalizeBossShortcut(value) !== null
}
