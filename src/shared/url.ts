export function normalizeNavigationInput(input: string, searchEngine: 'bing' | 'baidu'): string {
  const value = input.trim()
  if (!value) return 'about:blank'
  if (/^https?:\/\//i.test(value)) return value
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(value)) return `https://${value}`
  const base = searchEngine === 'baidu' ? 'https://www.baidu.com/s?wd=' : 'https://www.bing.com/search?q='
  return `${base}${encodeURIComponent(value)}`
}

export function isAllowedNavigation(url: string): boolean {
  return /^https?:\/\//i.test(url) || url === 'about:blank'
}
