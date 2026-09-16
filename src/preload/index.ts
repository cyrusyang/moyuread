import { contextBridge, ipcRenderer } from 'electron'
import type { AppSettings, BookmarkItem, BrowserState, SiteItem } from '../shared/types'

const api = {
  getState: () => ipcRenderer.invoke('browser:get-state') as Promise<BrowserState>,
  onState: (listener: (state: BrowserState) => void) => { const fn = (_event: Electron.IpcRendererEvent, state: BrowserState) => listener(state); ipcRenderer.on('browser:state', fn); return () => ipcRenderer.removeListener('browser:state', fn) },
  onTabUpdate: (listener: (tab: BrowserState['tabs'][number]) => void) => { const fn = (_event: Electron.IpcRendererEvent, tab: BrowserState['tabs'][number]) => listener(tab); ipcRenderer.on('browser:tab-update', fn); return () => ipcRenderer.removeListener('browser:tab-update', fn) },
  onHidden: (listener: (hidden: boolean) => void) => { const fn = (_event: Electron.IpcRendererEvent, value: boolean) => listener(value); ipcRenderer.on('browser:hidden', fn); return () => ipcRenderer.removeListener('browser:hidden', fn) },
  newTab: (url?: string) => ipcRenderer.invoke('browser:new-tab', url),
  closeTab: (id: string) => ipcRenderer.invoke('browser:close-tab', id),
  switchTab: (id: string) => ipcRenderer.invoke('browser:switch-tab', id),
  navigate: (id: string, input: string) => ipcRenderer.invoke('browser:navigate', id, input),
  showHome: () => ipcRenderer.invoke('browser:show-home'),
  goBack: (id: string) => ipcRenderer.invoke('browser:go-back', id),
  goForward: (id: string) => ipcRenderer.invoke('browser:go-forward', id),
  reload: (id: string) => ipcRenderer.invoke('browser:reload', id),
  stop: (id: string) => ipcRenderer.invoke('browser:stop', id),
  setZoom: (id: string, zoom: number) => ipcRenderer.invoke('browser:set-zoom', id, zoom),
  setLayout: (layout: { x: number; y: number; width: number; height: number }) => ipcRenderer.invoke('browser:set-layout', layout),
  toggleHidden: (hidden?: boolean) => ipcRenderer.invoke('browser:toggle-hidden', hidden),
  setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => ipcRenderer.invoke('settings:set', key, value) as Promise<AppSettings>,
  clearWebData: () => ipcRenderer.invoke('settings:clear-web-data'),
  addBookmark: (item: { parentId?: string | null; title: string; url?: string | null; kind?: BookmarkItem['kind'] }) => ipcRenderer.invoke('bookmark:add', item) as Promise<BookmarkItem>,
  updateBookmark: (id: string, patch: Partial<Pick<BookmarkItem, 'title' | 'url' | 'parentId'>>) => ipcRenderer.invoke('bookmark:update', id, patch),
  deleteBookmark: (id: string) => ipcRenderer.invoke('bookmark:delete', id),
  reorderBookmark: (id: string, beforeId?: string) => ipcRenderer.invoke('bookmark:reorder', id, beforeId),
  addSite: (item: { title: string; url: string }) => ipcRenderer.invoke('site:add', item.title, item.url) as Promise<SiteItem>,
  updateSite: (id: string, patch: Partial<Pick<SiteItem, 'title' | 'url'>>) => ipcRenderer.invoke('site:update', id, patch),
  deleteSite: (id: string) => ipcRenderer.invoke('site:delete', id),
  reorderSite: (id: string, beforeId?: string) => ipcRenderer.invoke('site:reorder', id, beforeId),
  deleteHistory: (id: string) => ipcRenderer.invoke('history:delete', id),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  updateBossShortcut: (shortcut: string) => ipcRenderer.invoke('settings:boss-shortcut', shortcut),
  minimizeToTray: () => ipcRenderer.invoke('tray:minimize'),
  quit: () => ipcRenderer.invoke('app:quit')
}

contextBridge.exposeInMainWorld('moyu', api)
