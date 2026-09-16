import { describe, expect, it } from 'vitest'
import { isAllowedNavigation, normalizeNavigationInput } from '../src/shared/url'

describe('normalizeNavigationInput', () => {
  it('keeps http URLs and adds https to domains', () => {
    expect(normalizeNavigationInput('https://example.com/a', 'bing')).toBe('https://example.com/a')
    expect(normalizeNavigationInput('example.com', 'bing')).toBe('https://example.com')
  })
  it('uses the selected search engine for plain text', () => {
    expect(normalizeNavigationInput('hello world', 'bing')).toBe('https://www.bing.com/search?q=hello%20world')
    expect(normalizeNavigationInput('hello world', 'baidu')).toBe('https://www.baidu.com/s?wd=hello%20world')
  })
})

describe('navigation policy', () => {
  it('only permits app blank pages and remote http(s)', () => {
    expect(isAllowedNavigation('about:blank')).toBe(true)
    expect(isAllowedNavigation('https://example.com')).toBe(true)
    expect(isAllowedNavigation('file:///C:/secret.txt')).toBe(false)
    expect(isAllowedNavigation('javascript:alert(1)')).toBe(false)
  })
})
