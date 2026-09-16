export interface ScreenPoint {
  x: number
  y: number
}

export interface ScreenBounds extends ScreenPoint {
  width: number
  height: number
}

export function isPointInsideBounds(point: ScreenPoint, bounds: ScreenBounds) {
  return point.x >= bounds.x
    && point.x <= bounds.x + bounds.width
    && point.y >= bounds.y
    && point.y <= bounds.y + bounds.height
}


export function isHoverRestoreBlocked(
  blockedDisplayId: number | null,
  cursorDisplayId: number
) {
  return blockedDisplayId !== null && blockedDisplayId === cursorDisplayId
}
