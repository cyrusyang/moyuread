import { describe, expect, it, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import Database from 'better-sqlite3'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Store } from '../src/main/store'

const dirs: string[] = []
afterEach(() => { while (dirs.length) { const dir = dirs.pop()!; rmSync(dir, { recursive: true, force: true }) } })

function makeStore() { const dir = mkdtempSync(join(tmpdir(), 'moyu-test-')); dirs.push(dir); return new Store(join(dir, 'test.sqlite')) }

describe('Store', () => {
  it('persists settings and nested bookmarks', () => {
    const store = makeStore()
    store.setSetting('searchEngine', 'baidu')
    const folder = store.addBookmark({ title: '资料', kind: 'folder' })
    store.addBookmark({ parentId: folder.id, title: 'Example', url: 'https://example.com' })
    expect(store.getSettings().searchEngine).toBe('baidu')
    expect(store.listBookmarks().map((item) => item.title)).toEqual(['资料', 'Example'])
    store.close()
  })
  it('supplies and persists the window transparency setting', () => {
    const store = makeStore()
    expect(store.getSettings().restoreTabs).toBe(false)
    expect(store.getSettings().webOnlyMode).toBe(false)
    expect(store.getSettings().webPageTransparency).toBe(false)
    store.setSetting('webOnlyMode', true)
    store.setSetting('webPageTransparency', true)
    expect(store.getSettings().webOnlyMode).toBe(true)
    expect(store.getSettings().webPageTransparency).toBe(true)
    store.close()
  })

  it('migrates the previous restore-tabs default once and then respects user changes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'moyu-test-'))
    dirs.push(dir)
    const file = join(dir, 'legacy.sqlite')
    const legacy = new Database(file)
    legacy.exec('CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
    const insert = legacy.prepare('INSERT INTO settings(key, value) VALUES (?, ?)')
    insert.run('theme', JSON.stringify('dark'))
    insert.run('restoreTabs', JSON.stringify(true))
    legacy.close()

    const migrated = new Store(file)
    expect(migrated.getSettings().restoreTabs).toBe(false)
    migrated.setSetting('restoreTabs', true)
    migrated.close()

    const reopened = new Store(file)
    expect(reopened.getSettings().restoreTabs).toBe(true)
    reopened.close()
  })

  it('deduplicates history in the listing while retaining the newest visit', () => {
    const store = makeStore()
    store.addHistory('https://example.com', 'First')
    store.addHistory('https://example.com', 'Second')
    expect(store.listHistory()).toHaveLength(1)
    expect(store.listHistory()[0].title).toBe('Second')
    store.close()
  })


  it('persists the active tab identifier across saves', () => {
    const store = makeStore()
    const tabs = [
      { id: 'one', url: 'https://one.example', title: 'One', loading: false, canGoBack: false, canGoForward: false, zoom: 1 },
      { id: 'two', url: 'https://two.example', title: 'Two', loading: false, canGoBack: false, canGoForward: false, zoom: 1 }
    ]
    store.saveTabs(tabs, 'two')
    expect(store.getSavedActiveTabId()).toBe('two')
    store.close()
  })

  it('cascades nested bookmark deletion and allows moving an item to the root', () => {
    const store = makeStore()
    const outer = store.addBookmark({ title: '??', kind: 'folder' })
    const inner = store.addBookmark({ parentId: outer.id, title: '??', kind: 'folder' })
    const link = store.addBookmark({ parentId: inner.id, title: '??', url: 'https://example.com' })
    store.updateBookmark(inner.id, { parentId: null })
    expect(store.listBookmarks().find((item) => item.id === inner.id)?.parentId).toBeNull()
    store.updateBookmark(link.id, { parentId: inner.id })
    store.deleteBookmark(outer.id)
    expect(store.listBookmarks().map((item) => item.id)).toEqual([inner.id, link.id])
    store.deleteBookmark(inner.id)
    expect(store.listBookmarks()).toEqual([])
    store.close()
  })
})

