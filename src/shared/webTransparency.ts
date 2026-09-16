export const SOFTWARE_UI_OPACITY = 0.88

export const WEB_TRANSPARENCY_CSS_ORIGIN = 'user' as const

export const transparentWebCss = `
html, body, body *, body *::before, body *::after {
  background-color: transparent !important;
}
`

