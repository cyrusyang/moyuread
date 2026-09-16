import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import type { AppSettings, BookmarkItem, BrowserTab, HistoryItem, SiteItem } from '../shared/types'

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  searchEngine: 'bing',
  restoreTabs: false,
  autoHideOnLeave: false,
  webOnlyMode: false,
  webPageTransparency: false,
  bossShortcut: 'CommandOrControl+Alt+H'
}

const STARTUP_DEFAULT_MIGRATION_KEY = 'migration.startup-new-tab-default-v1'

type Row = Record<string, unknown>

export class Store {
  private readonly db: Database.Database

  constructor(file: string) {
    this.db = new Database(file)
    this.db.pragma('journal_mode = WAL')
    // SQLite does not enforce foreign keys unless the connection opts in.
    // Keep folder deletion and nested bookmark cleanup consistent with the schema.
    this.db.pragma('foreign_keys = ON')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS tabs (
        id TEXT PRIMARY KEY, url TEXT NOT NULL, title TEXT NOT NULL, favicon TEXT,
        position INTEGER NOT NULL, zoom REAL NOT NULL DEFAULT 1, active INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS bookmarks (
        id TEXT PRIMARY KEY, parent_id TEXT, kind TEXT NOT NULL,
        title TEXT NOT NULL, url TEXT, position INTEGER NOT NULL,
        FOREIGN KEY(parent_id) REFERENCES bookmarks(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS history (
        id TEXT PRIMARY KEY, url TEXT NOT NULL, title TEXT NOT NULL,
        visit_time TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_history_visit_time ON history(visit_time DESC);
      CREATE TABLE IF NOT EXISTS sites (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, url TEXT NOT NULL, position INTEGER NOT NULL
      );
    `)
    // Add columns introduced after the first MVP build without invalidating an existing database.
    try { this.db.exec('ALTER TABLE tabs ADD COLUMN active INTEGER NOT NULL DEFAULT 0') } catch { /* already migrated */ }
    if (!this.db.prepare('SELECT 1 FROM settings WHERE key = ?').get('theme')) {
      const insert = this.db.prepare('INSERT INTO settings(key, value) VALUES (?, ?)')
      const tx = this.db.transaction(() => {
        for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) insert.run(key, JSON.stringify(value))
      })
      tx()
    }
    if (!this.db.prepare('SELECT 1 FROM settings WHERE key = ?').get(STARTUP_DEFAULT_MIGRATION_KEY)) {
      const upsert = this.db.prepare('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      const tx = this.db.transaction(() => {
        upsert.run('restoreTabs', JSON.stringify(false))
        upsert.run(STARTUP_DEFAULT_MIGRATION_KEY, JSON.stringify(true))
      })
      tx()
    }
    if (this.listSites().length === 0) {
      const insert = this.db.prepare('INSERT INTO sites(id, title, url, position) VALUES (?, ?, ?, ?)')
      insert.run(randomUUID(), '本地新标签', 'about:blank', 0)
    }
  }

  close() { this.db.close() }

  getSettings(): AppSettings {
    const result = { ...DEFAULT_SETTINGS }
    for (const row of this.db.prepare('SELECT key, value FROM settings').all() as Row[]) {
      const key = row.key as keyof AppSettings
      if (key in result) (result as Record<string, unknown>)[key] = JSON.parse(row.value as string)
    }
    return result
  }

  setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    this.db.prepare('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, JSON.stringify(value))
    return this.getSettings()
  }

  listTabs(): BrowserTab[] {
    return (this.db.prepare('SELECT id, url, title, favicon, position, zoom FROM tabs ORDER BY position').all() as Row[]).map((row) => ({
      id: row.id as string, url: row.url as string, title: row.title as string,
      favicon: row.favicon as string | undefined, loading: false,
      canGoBack: false, canGoForward: false, zoom: row.zoom as number
    }))
  }

  getSavedActiveTabId(): string | null {
    const row = this.db.prepare('SELECT id FROM tabs WHERE active = 1 ORDER BY position LIMIT 1').get() as Row | undefined
    return (row?.id as string | undefined) ?? null
  }

  saveTabs(tabs: BrowserTab[], activeTabId?: string) {
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM tabs').run()
      const insert = this.db.prepare('INSERT INTO tabs(id, url, title, favicon, position, zoom, active) VALUES (?, ?, ?, ?, ?, ?, ?)')
      tabs.filter((tab) => tab.url && tab.url !== 'about:blank').forEach((tab, position) => insert.run(tab.id, tab.url, tab.title, tab.favicon ?? null, position, tab.zoom ?? 1, tab.id === activeTabId ? 1 : 0))
    })
    tx()
  }

  listBookmarks(): BookmarkItem[] {
    return (this.db.prepare('SELECT id, parent_id, kind, title, url, position FROM bookmarks ORDER BY parent_id IS NOT NULL, parent_id, position').all() as Row[]).map((row) => ({
      id: row.id as string, parentId: (row.parent_id as string | null) ?? null,
      kind: row.kind as BookmarkItem['kind'], title: row.title as string,
      url: (row.url as string | null) ?? null, position: row.position as number
    }))
  }

  addBookmark(input: { parentId?: string | null; title: string; url?: string | null; kind?: BookmarkItem['kind'] }): BookmarkItem {
    const parentId = input.parentId ?? null
    const position = (this.db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM bookmarks WHERE parent_id IS ?').get(parentId) as Row).next as number
    const item: BookmarkItem = { id: randomUUID(), parentId, kind: input.kind ?? 'url', title: input.title.trim(), url: input.url ?? null, position }
    this.db.prepare('INSERT INTO bookmarks(id, parent_id, kind, title, url, position) VALUES (?, ?, ?, ?, ?, ?)').run(item.id, item.parentId, item.kind, item.title, item.url, position)
    return item
  }

  updateBookmark(id: string, patch: Partial<Pick<BookmarkItem, 'title' | 'url' | 'parentId'>>) {
    const current = this.db.prepare('SELECT title, url, parent_id FROM bookmarks WHERE id = ?').get(id) as Row | undefined
    if (!current) return
    const parentId = Object.prototype.hasOwnProperty.call(patch, 'parentId') ? patch.parentId : current.parent_id
    this.db.prepare('UPDATE bookmarks SET title = ?, url = ?, parent_id = ? WHERE id = ?').run(patch.title ?? current.title, patch.url ?? current.url, parentId, id)
  }

  deleteBookmark(id: string) { this.db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id) }

  reorderBookmark(id: string, beforeId?: string) {
    const item = this.db.prepare('SELECT parent_id FROM bookmarks WHERE id = ?').get(id) as Row | undefined
    if (!item) return
    const parentId = (item.parent_id as string | null) ?? null
    const siblings = this.db.prepare('SELECT id FROM bookmarks WHERE parent_id IS ? ORDER BY position').all(parentId) as Row[]
    const ids = siblings.map((row) => row.id as string).filter((value) => value !== id)
    const index = beforeId ? Math.max(0, ids.indexOf(beforeId)) : ids.length
    ids.splice(index < 0 ? ids.length : index, 0, id)
    const update = this.db.prepare('UPDATE bookmarks SET position = ? WHERE id = ?')
    const tx = this.db.transaction(() => ids.forEach((value, position) => update.run(position, value)))
    tx()
  }

  addHistory(url: string, title: string) {
    this.db.prepare('INSERT INTO history(id, url, title, visit_time) VALUES (?, ?, ?, ?)').run(randomUUID(), url, title || url, new Date().toISOString())
  }

  listHistory(limit = 100): HistoryItem[] {
    const query = `SELECT h.id, h.url, h.title, h.visit_time
      FROM history h
      INNER JOIN (SELECT url, MAX(visit_time) AS visit_time FROM history GROUP BY url) latest
        ON latest.url = h.url AND latest.visit_time = h.visit_time
      ORDER BY h.visit_time DESC LIMIT ?`
    return (this.db.prepare(query).all(limit) as Row[]).map((row) => ({ id: row.id as string, url: row.url as string, title: row.title as string, visitTime: row.visit_time as string }))
  }

  deleteHistory(id: string) { this.db.prepare('DELETE FROM history WHERE id = ?').run(id) }
  clearHistory() { this.db.prepare('DELETE FROM history').run() }

  listSites(): SiteItem[] {
    return (this.db.prepare('SELECT id, title, url, position FROM sites ORDER BY position').all() as Row[]).map((row) => ({ id: row.id as string, title: row.title as string, url: row.url as string, position: row.position as number }))
  }

  addSite(title: string, url: string): SiteItem {
    const position = (this.db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM sites').get() as Row).next as number
    const item = { id: randomUUID(), title: title.trim(), url, position }
    this.db.prepare('INSERT INTO sites(id, title, url, position) VALUES (?, ?, ?, ?)').run(item.id, item.title, item.url, position)
    return item
  }
  updateSite(id: string, patch: Partial<Pick<SiteItem, 'title' | 'url'>>) {
    const current = this.db.prepare('SELECT title, url FROM sites WHERE id = ?').get(id) as Row | undefined
    if (!current) return
    this.db.prepare('UPDATE sites SET title = ?, url = ? WHERE id = ?').run(patch.title ?? current.title, patch.url ?? current.url, id)
  }
  deleteSite(id: string) { this.db.prepare('DELETE FROM sites WHERE id = ?').run(id) }
  reorderSite(id: string, beforeId?: string) {
    const ids = (this.db.prepare('SELECT id FROM sites ORDER BY position').all() as Row[]).map((row) => row.id as string).filter((value) => value !== id)
    const index = beforeId ? ids.indexOf(beforeId) : ids.length
    ids.splice(index < 0 ? ids.length : index, 0, id)
    const update = this.db.prepare('UPDATE sites SET position = ? WHERE id = ?')
    const tx = this.db.transaction(() => ids.forEach((value, position) => update.run(position, value)))
    tx()
  }

  clearAll() {
    this.db.transaction(() => { this.db.prepare('DELETE FROM history').run(); this.db.prepare('DELETE FROM bookmarks').run() })()
  }
}
