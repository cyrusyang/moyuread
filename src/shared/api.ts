import type { AppSettings, BookmarkItem, BrowserState, HistoryItem, SiteItem } from './types'

export interface MoyuApi {
  getState(): Promise<BrowserState>
  onState(listener: (state: BrowserState) => void): () => void
  onTabUpdate(listener: (tab: BrowserState['tabs'][number]) => void): () => void
  onHidden(listener: (hidden: boolean) => void): () => void
  newTab(url?: string): Promise<void>
  closeTab(id: string): Promise<void>
  switchTab(id: string): Promise<void>
  navigate(id: string, input: string): Promise<void>
  showHome(): Promise<void>
  goBack(id: string): Promise<void>
  goForward(id: string): Promise<void>
  reload(id: string): Promise<void>
  stop(id: string): Promise<void>
  setZoom(id: string, zoom: number): Promise<void>
  setLayout(layout: { x: number; y: number; width: number; height: number }): Promise<void>
  toggleHidden(hidden?: boolean): Promise<void>
  setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<AppSettings>
  clearWebData(): Promise<void>
  addBookmark(item: { parentId?: string | null; title: string; url?: string | null; kind?: BookmarkItem['kind'] }): Promise<BookmarkItem>
  updateBookmark(id: string, patch: Partial<Pick<BookmarkItem, 'title' | 'url' | 'parentId'>>): Promise<void>
  deleteBookmark(id: string): Promise<void>
  reorderBookmark(id: string, beforeId?: string): Promise<void>
  addSite(item: { title: string; url: string }): Promise<SiteItem>
  updateSite(id: string, patch: Partial<Pick<SiteItem, 'title' | 'url'>>): Promise<void>
  deleteSite(id: string): Promise<void>
  reorderSite(id: string, beforeId?: string): Promise<void>
  deleteHistory(id: string): Promise<void>
  clearHistory(): Promise<void>
  updateBossShortcut(shortcut: string): Promise<{ shortcut: string; error?: string }>
  minimizeToTray(): Promise<void>
  quit(): Promise<void>
}

declare global {
  interface Window {
    moyu: MoyuApi
  }
}
