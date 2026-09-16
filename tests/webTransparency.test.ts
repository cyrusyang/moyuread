import { describe, expect, it } from 'vitest'
import { SOFTWARE_UI_OPACITY, transparentWebCss, WEB_TRANSPARENCY_CSS_ORIGIN } from '../src/shared/webTransparency'

describe('transparency presentation', () => {
  it('uses a readable opacity for software UI only', () => {
    expect(SOFTWARE_UI_OPACITY).toBeGreaterThan(0)
    expect(SOFTWARE_UI_OPACITY).toBeLessThan(1)
  })

  it('injects transparency rules from the user cascade origin', () => {
    expect(WEB_TRANSPARENCY_CSS_ORIGIN).toBe('user')
  })

  it('makes webpage background colors transparent without removing background images or typography', () => {
    expect(transparentWebCss).toContain('background-color: transparent !important')
    expect(transparentWebCss).not.toContain('background: transparent')
    expect(transparentWebCss).not.toContain('background-image: none')
    expect(transparentWebCss).not.toContain('font-')
    expect(transparentWebCss).not.toContain('color: rgba')
    expect(transparentWebCss).not.toContain('text-shadow')
  })
})

