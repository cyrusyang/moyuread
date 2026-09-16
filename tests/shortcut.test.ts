import { describe, expect, it } from 'vitest'
import { isValidBossShortcut, normalizeBossShortcut } from '../src/shared/shortcut'

describe('boss shortcut validation', () => {
  it('normalizes common modifier aliases', () => {
    expect(normalizeBossShortcut('ctrl + alt + h')).toBe('CommandOrControl+Alt+H')
    expect(normalizeBossShortcut('Shift+F12')).toBe('Shift+F12')
  })

  it('rejects incomplete or ambiguous accelerators', () => {
    expect(isValidBossShortcut('H')).toBe(false)
    expect(isValidBossShortcut('Ctrl+Alt')).toBe(false)
    expect(isValidBossShortcut('Ctrl+Alt+H+J')).toBe(false)
    expect(isValidBossShortcut('Ctrl+Alt+NotAKey')).toBe(false)
  })
})
