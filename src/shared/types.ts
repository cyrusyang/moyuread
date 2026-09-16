export type ViewId = string

export interface BrowserTab {
  id: ViewId
  url: string
  title: string
  favicon?: string
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
  zoom: number
}

export interface BookmarkItem {
  id: string
  parentId: string | null
  kind: 'folder' | 'url'
  title: string
  url: string | null
  position: number
}

export interface HistoryItem {
  id: string
  url: string
  title: string
  visitTime: string
}

export interface SiteItem {
  id: string
  title: string
  url: string
  position: number
}

export interface AppSettings {
  theme: 'light' | 'dark'
  searchEngine: 'bing' | 'baidu'
  restoreTabs: boolean
  autoHideOnLeave: boolean
  webOnlyMode: boolean
  webPageTransparency: boolean
  bossShortcut: string
}

export interface BrowserState {
  tabs: BrowserTab[]
  activeTabId: string
  homeVisible: boolean
  bookmarks: BookmarkItem[]
  history: HistoryItem[]
  sites: SiteItem[]
  settings: AppSettings
  hidden: boolean
}
