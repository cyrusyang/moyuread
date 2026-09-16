import { describe, expect, it } from 'vitest'
import { isHoverRestoreBlocked, isPointInsideBounds } from '../src/shared/windowBounds'

const bounds = { x: 100, y: 200, width: 300, height: 150 }

describe('isPointInsideBounds', () => {
  it('accepts points inside the rectangle and on its edges', () => {
    expect(isPointInsideBounds({ x: 250, y: 275 }, bounds)).toBe(true)
    expect(isPointInsideBounds({ x: 100, y: 200 }, bounds)).toBe(true)
    expect(isPointInsideBounds({ x: 400, y: 350 }, bounds)).toBe(true)
  })

  it('rejects points beyond each edge', () => {
    expect(isPointInsideBounds({ x: 99, y: 275 }, bounds)).toBe(false)
    expect(isPointInsideBounds({ x: 401, y: 275 }, bounds)).toBe(false)
    expect(isPointInsideBounds({ x: 250, y: 199 }, bounds)).toBe(false)
    expect(isPointInsideBounds({ x: 250, y: 351 }, bounds)).toBe(false)
  })
})

describe('isHoverRestoreBlocked', () => {
  it('blocks restore while the cursor remains on the clicked display', () => {
    expect(isHoverRestoreBlocked(1, 1)).toBe(true)
  })

  it('allows restore on another display or without an outside click', () => {
    expect(isHoverRestoreBlocked(2, 1)).toBe(false)
    expect(isHoverRestoreBlocked(null, 1)).toBe(false)
  })
})
