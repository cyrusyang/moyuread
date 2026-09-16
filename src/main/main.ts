import { app, BrowserWindow, Menu, WebContentsView, Tray, nativeImage, ipcMain, globalShortcut, screen, session } from 'electron'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { uIOhook, type UiohookMouseEvent } from 'uiohook-napi'
import { Store } from './store'
import { isAllowedNavigation, normalizeNavigationInput } from '../shared/url'
import { normalizeBossShortcut } from '../shared/shortcut'
import { isHoverRestoreBlocked, isPointInsideBounds } from '../shared/windowBounds'
import { transparentWebCss, WEB_TRANSPARENCY_CSS_ORIGIN } from '../shared/webTransparency'
import type { AppSettings, BrowserState, BrowserTab } from '../shared/types'

let windowRef: BrowserWindow | null = null
let tray: Tray | null = null
let store: Store
let browserSession: Electron.Session
let hidden = false
let hidePoller: NodeJS.Timeout | null = null
let windowHiddenByCursor = false
let autoHideBounds: Electron.Rectangle | null = null
let autoHideArmed = false
let hoverRestoreBlockedDisplayId: number | null = null
let outsideClickDisplayId: number | null = null
let globalMouseListenerStarted = false
let quitting = false
let layout = { x: 0, y: 88, width: 430, height: 732 }
const views = new Map<string, WebContentsView>()
const tabs = new Map<string, BrowserTab>()
const webPageCssKeys = new Map<string, string>()
const webPageTransparencyRevisions = new Map<string, number>()
let activeTabId = ''
let homeVisible = true


function makeTrayIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect rx="8" width="32" height="32" fill="#7c3aed"/><path d="M8 10h16v3H8zm0 5h12v3H8zm0 5h9v3H8z" fill="white"/></svg>`
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`)
}

function send(channel: string, ...args: unknown[]) {
  if (windowRef && !windowRef.isDestroyed()) windowRef.webContents.send(channel, ...args)
}

function snapshot(): BrowserState {
  const listed = [...tabs.values()].map((tab) => ({ ...tab }))
  return { tabs: listed, activeTabId, homeVisible, bookmarks: store.listBookmarks(), history: store.listHistory(), sites: store.listSites(), settings: store.getSettings(), hidden }
}

function pushState() { send('browser:state', snapshot()) }
function getActiveTab() { return tabs.get(activeTabId) }

function updateBounds() {
  if (!windowRef) return
  const bounds = windowRef.getContentBounds()
  layout.width = Math.max(0, bounds.width - layout.x)
  layout.height = Math.max(0, bounds.height - layout.y)
  for (const [id, view] of views) {
    const tab = tabs.get(id)
    const visible = id === activeTabId && !homeVisible && !hidden && !!tab?.url && tab.url !== 'about:blank'
    view.setVisible(visible)
    if (visible) view.setBounds(layout)
  }
}

function persistTabs() { store.saveTabs([...tabs.values()], activeTabId) }

function sendTab(tab: BrowserTab) { send('browser:tab-update', { ...tab }) }

function updateTab(id: string, patch: Partial<BrowserTab>) {
  const tab = tabs.get(id)
  if (!tab) return
  Object.assign(tab, patch)
  if (id === activeTabId) sendTab(tab)
  pushState()
  persistTabs()
}

function updateTransparentPresentation() {
  // Keep native webpage views fully opaque. Software transparency is applied only
  // to the renderer UI so it never fades the embedded website.
  windowRef?.setOpacity(1)
}

async function updateViewWebTransparency(id: string) {
  const view = views.get(id)
  if (!view || view.webContents.isDestroyed()) return

  const revision = (webPageTransparencyRevisions.get(id) ?? 0) + 1
  webPageTransparencyRevisions.set(id, revision)
  const enabled = store.getSettings().webOnlyMode && store.getSettings().webPageTransparency
  view.setBackgroundColor(enabled ? '#00000000' : '#ffffff')

  const previousKey = webPageCssKeys.get(id)
  if (previousKey) {
    try { await view.webContents.removeInsertedCSS(previousKey) } catch { /* navigation may invalidate an old CSS key */ }
    if (webPageTransparencyRevisions.get(id) !== revision) return
    webPageCssKeys.delete(id)
  }
  if (!enabled) return

  try {
    const key = await view.webContents.insertCSS(transparentWebCss, { cssOrigin: WEB_TRANSPARENCY_CSS_ORIGIN })
    if (webPageTransparencyRevisions.get(id) !== revision || !views.has(id) || !store.getSettings().webPageTransparency) {
      try { await view.webContents.removeInsertedCSS(key) } catch { /* view may have navigated or closed */ }
      return
    }
    webPageCssKeys.set(id, key)
  } catch { /* pages can disappear while navigation is in progress */ }
}

function updateAllWebTransparency() {
  for (const id of views.keys()) void updateViewWebTransparency(id)
}

function bindView(id: string, view: WebContentsView) {
  const contents = view.webContents
  contents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) { createTab(url); return { action: 'deny' } }
    return { action: 'deny' }
  })
  contents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url)) event.preventDefault()
  })
  contents.on('will-redirect', (event, url) => {
    if (!isAllowedNavigation(url)) event.preventDefault()
  })
  contents.on('did-start-loading', () => updateTab(id, { loading: true }))
  contents.on('did-stop-loading', () => updateTab(id, { loading: false }))
  contents.on('did-finish-load', () => { void updateViewWebTransparency(id) })
  contents.on('page-title-updated', (_event, title) => { const nextTitle = title || '\u65B0\u6807\u7B7E'; updateTab(id, { title: nextTitle }); const tab = tabs.get(id); if (tab && isAllowedNavigation(tab.url) && tab.url !== 'about:blank' && title) { store.addHistory(tab.url, nextTitle); pushState() } })
  contents.on('page-favicon-updated', (_event, favicons) => updateTab(id, { favicon: favicons[0] }))
  contents.on('did-navigate', (_event, url) => {
    updateTab(id, { url, canGoBack: contents.canGoBack(), canGoForward: contents.canGoForward() })
    if (isAllowedNavigation(url) && url !== 'about:blank') store.addHistory(url, tabs.get(id)?.title || url)
    pushState()
  })
  contents.on('did-navigate-in-page', (_event, url) => updateTab(id, { url, canGoBack: contents.canGoBack(), canGoForward: contents.canGoForward() }))
  contents.on('did-fail-load', (_event, _code, _description, validatedURL, isMainFrame) => {
    if (isMainFrame && validatedURL) updateTab(id, { url: validatedURL, loading: false, title: '页面加载失败' })
  })
}

function createTab(input = 'about:blank', restored?: BrowserTab) {
  const id = restored?.id ?? randomUUID()
  const tab: BrowserTab = restored ? { ...restored, id, url: input, loading: false, canGoBack: false, canGoForward: false } : { id, url: input, title: input === 'about:blank' ? '新标签' : input, loading: false, canGoBack: false, canGoForward: false, zoom: 1 }
  tabs.set(id, tab)
  const view = new WebContentsView({ webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, session: browserSession } })
  view.setBackgroundColor('#ffffff')
  views.set(id, view)
  windowRef?.contentView.addChildView(view)
  bindView(id, view)
  void updateViewWebTransparency(id)
  activeTabId = id
  homeVisible = input === 'about:blank'
  if (tab.zoom !== 1) view.webContents.setZoomFactor(tab.zoom)
  if (input !== 'about:blank') void view.webContents.loadURL(input)
  updateBounds()
  pushState()
  persistTabs()
}

function closeTab(id: string) {
  const tabIds = [...tabs.keys()]
  const closedIndex = tabIds.indexOf(id)
  const view = views.get(id)
  if (view) { windowRef?.contentView.removeChildView(view); view.webContents.close(); views.delete(id) }
  webPageCssKeys.delete(id)
  webPageTransparencyRevisions.delete(id)
  tabs.delete(id)
  if (tabs.size === 0) createTab()
  else if (activeTabId === id) {
    const remainingIds = [...tabs.keys()]
    activeTabId = remainingIds[Math.min(Math.max(closedIndex - 1, 0), remainingIds.length - 1)]
    homeVisible = tabs.get(activeTabId)?.url === 'about:blank'
  }
  updateBounds(); pushState(); persistTabs()
}

function switchTab(id: string) {
  if (!tabs.has(id)) return
  activeTabId = id
  homeVisible = tabs.get(id)?.url === 'about:blank'
  hidden = false
  updateBounds()
  pushState()
}

function showSoftwareHome() {
  homeVisible = true
  hidden = false
  updateBounds()
  pushState()
}

function setHidden(value: boolean) { hidden = value; updateBounds(); send('browser:hidden', hidden); pushState() }

function resetCursorAutoHide() {
  windowHiddenByCursor = false
  autoHideBounds = null
  autoHideArmed = false
  hoverRestoreBlockedDisplayId = null
  outsideClickDisplayId = null
}

function handleGlobalMouseDown(event: UiohookMouseEvent) {
  const displayId = screen.getDisplayNearestPoint(event).id
  if (!autoHideBounds || isPointInsideBounds(event, autoHideBounds)) {
    if (!windowHiddenByCursor) outsideClickDisplayId = null
    return
  }
  if (windowHiddenByCursor) hoverRestoreBlockedDisplayId = displayId
  else if (autoHideArmed) outsideClickDisplayId = displayId
}

function startGlobalMouseListener() {
  if (globalMouseListenerStarted) return
  uIOhook.on('mousedown', handleGlobalMouseDown)
  uIOhook.start()
  globalMouseListenerStarted = true
}

function stopGlobalMouseListener() {
  if (!globalMouseListenerStarted) return
  uIOhook.off('mousedown', handleGlobalMouseDown)
  uIOhook.stop()
  globalMouseListenerStarted = false
}

function minimizeApplicationWindow() {
  resetCursorAutoHide()
  windowRef?.minimize()
}

function showApplicationWindow() {
  resetCursorAutoHide()
  if (!windowRef || windowRef.isDestroyed()) return
  if (windowRef.isMinimized()) windowRef.restore()
  windowRef.show()
  setHidden(false)
}

function registerBossShortcut(value: string) {
  const old = store.getSettings().bossShortcut
  const normalized = normalizeBossShortcut(value)
  if (!normalized) return { shortcut: old, error: '快捷键至少需要 Ctrl、Alt 或 Shift 中的一个修饰键，并包含一个按键' }
  if (old) globalShortcut.unregister(old)
  const ok = globalShortcut.register(normalized, minimizeApplicationWindow)
  if (!ok) { if (old) globalShortcut.register(old, minimizeApplicationWindow); return { shortcut: old, error: '无法注册该快捷键，可能与其他应用冲突' } }
  store.setSetting('bossShortcut', normalized)
  return { shortcut: normalized }
}

function createWindow() {
  windowRef = new BrowserWindow({ width: 430, height: 820, minWidth: 390, minHeight: 620, title: 'Moyu Browser', transparent: true, backgroundColor: '#00000000', show: false, frame: false, autoHideMenuBar: true, webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } })
  const rendererUrl = process.env.ELECTRON_RENDERER_URL
  if (rendererUrl) {
    void windowRef.loadURL(rendererUrl)
    windowRef.show()
  } else {
    void windowRef.loadFile(join(__dirname, '../renderer/index.html'))
  }
  windowRef.once('ready-to-show', () => windowRef?.show())
  windowRef.on('resize', updateBounds)
  windowRef.on('closed', () => { resetCursorAutoHide(); windowRef = null })
  windowRef.on('close', (event) => { if (!quitting) { event.preventDefault(); windowRef?.destroy() } })
  startHidePoller()
}

function startHidePoller() {
  if (hidePoller) clearInterval(hidePoller)
  hidePoller = setInterval(() => {
    if (!windowRef || windowRef.isDestroyed()) return

    if (!store.getSettings().autoHideOnLeave) {
      if (windowHiddenByCursor && !windowRef.isMinimized()) windowRef.showInactive()
      resetCursorAutoHide()
      return
    }

    if (windowRef.isMinimized()) return

    const point = screen.getCursorScreenPoint()
    if (windowHiddenByCursor) {
      const cursorDisplayId = screen.getDisplayNearestPoint(point).id
      if (hoverRestoreBlockedDisplayId !== null && hoverRestoreBlockedDisplayId !== cursorDisplayId) {
        hoverRestoreBlockedDisplayId = null
      }
      const restoreBlocked = isHoverRestoreBlocked(hoverRestoreBlockedDisplayId, cursorDisplayId)
      if (!restoreBlocked && autoHideBounds && isPointInsideBounds(point, autoHideBounds)) {
        windowHiddenByCursor = false
        autoHideBounds = null
        autoHideArmed = true
        hoverRestoreBlockedDisplayId = null
        windowRef.showInactive()
      }
      return
    }

    if (!windowRef.isVisible()) return

    const bounds = windowRef.getBounds()
    autoHideBounds = bounds
    if (isPointInsideBounds(point, bounds)) {
      autoHideArmed = true
      outsideClickDisplayId = null
      return
    }

    if (autoHideArmed) {
      windowHiddenByCursor = true
      hoverRestoreBlockedDisplayId = outsideClickDisplayId
      outsideClickDisplayId = null
      autoHideArmed = false
      windowRef.hide()
    }
  }, 120)
}

function setTransparencyMode(value: boolean) {
  let settings = store.setSetting('webOnlyMode', value)
  if (!value && settings.webPageTransparency) settings = store.setSetting('webPageTransparency', false)
  updateTransparentPresentation()
  updateAllWebTransparency()
  refreshTrayMenu()
  pushState()
  return settings
}

function setWebPageTransparency(value: boolean) {
  const softwareTransparencyEnabled = store.getSettings().webOnlyMode
  const settings = store.setSetting('webPageTransparency', softwareTransparencyEnabled && value)
  updateAllWebTransparency()
  pushState()
  return settings
}

function refreshTrayMenu() {
  if (!tray) return
  const webOnlyMode = store.getSettings().webOnlyMode
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示主窗口', click: showApplicationWindow },
    {
      label: webOnlyMode ? '关闭软件透明' : '开启软件透明',
      click: () => {
        setTransparencyMode(!webOnlyMode)
        showApplicationWindow()
      }
    },
    { type: 'separator' },
    { label: '退出', click: () => { quitting = true; app.quit() } }
  ]))
}

function createTray() {
  tray = new Tray(makeTrayIcon())
  tray.setToolTip('Moyu Browser')
  refreshTrayMenu()
  tray.on('double-click', showApplicationWindow)
}

function registerIpc() {
  ipcMain.handle('browser:get-state', () => snapshot())
  ipcMain.handle('browser:new-tab', (_event, url?: string) => createTab(url || 'about:blank'))
  ipcMain.handle('browser:close-tab', (_event, id: string) => closeTab(id))
  ipcMain.handle('browser:switch-tab', (_event, id: string) => switchTab(id))
  ipcMain.handle('browser:show-home', () => showSoftwareHome())
  ipcMain.handle('browser:navigate', (_event, id: string, input: string) => { const tab = tabs.get(id); const view = views.get(id); if (!tab || !view) return; const url = normalizeNavigationInput(input, store.getSettings().searchEngine); if (url === 'about:blank') { showSoftwareHome(); return } homeVisible = false; tab.url = url; tab.title = '加载中…'; updateBounds(); void view.webContents.loadURL(url); pushState(); persistTabs() })
  ipcMain.handle('browser:go-back', (_event, id: string) => { const view = views.get(id); if (view?.webContents.canGoBack()) view.webContents.goBack() })
  ipcMain.handle('browser:go-forward', (_event, id: string) => { const view = views.get(id); if (view?.webContents.canGoForward()) view.webContents.goForward() })
  ipcMain.handle('browser:reload', (_event, id: string) => views.get(id)?.webContents.reload())
  ipcMain.handle('browser:stop', (_event, id: string) => views.get(id)?.webContents.stop())
  ipcMain.handle('browser:set-zoom', (_event, id: string, zoom: number) => { const view = views.get(id); if (!view) return; const next = Math.min(3, Math.max(0.5, zoom)); view.webContents.setZoomFactor(next); updateTab(id, { zoom: next }) })
  ipcMain.handle('browser:set-layout', (_event, next: typeof layout) => { layout = { ...layout, ...next }; updateBounds() })
  ipcMain.handle('browser:toggle-hidden', (_event, value?: boolean) => setHidden(value ?? !hidden))
  ipcMain.handle('app:get-state', () => snapshot())
  ipcMain.handle('settings:set', (_event, key: keyof AppSettings, value: AppSettings[keyof AppSettings]) => {
    if (key === 'webOnlyMode') return setTransparencyMode(Boolean(value))
    if (key === 'webPageTransparency') return setWebPageTransparency(Boolean(value))
    const settings = store.setSetting(key as never, value as never)
    pushState()
    return settings
  })
  ipcMain.handle('settings:boss-shortcut', (_event, shortcut: string) => registerBossShortcut(shortcut))
  ipcMain.handle('settings:clear-web-data', async () => { await browserSession.clearStorageData(); await browserSession.clearCache(); return true })

  ipcMain.handle('bookmark:list', () => store.listBookmarks())
  ipcMain.handle('bookmark:add', (_event, item) => { const result = store.addBookmark(item); pushState(); return result })
  ipcMain.handle('bookmark:update', (_event, id: string, patch) => { store.updateBookmark(id, patch); pushState() })
  ipcMain.handle('bookmark:delete', (_event, id: string) => { store.deleteBookmark(id); pushState() })
  ipcMain.handle('bookmark:reorder', (_event, id: string, beforeId?: string) => { store.reorderBookmark(id, beforeId); pushState() })
  ipcMain.handle('site:add', (_event, title: string, url: string) => { const item = store.addSite(title, url); pushState(); return item })
  ipcMain.handle('site:update', (_event, id: string, patch) => { store.updateSite(id, patch); pushState() })
  ipcMain.handle('site:delete', (_event, id: string) => { store.deleteSite(id); pushState() })
  ipcMain.handle('site:reorder', (_event, id: string, beforeId?: string) => { store.reorderSite(id, beforeId); pushState() })
  ipcMain.handle('history:delete', (_event, id: string) => { store.deleteHistory(id); pushState() })
  ipcMain.handle('history:clear', () => { store.clearHistory(); pushState() })
  ipcMain.handle('tray:minimize', minimizeApplicationWindow)
  ipcMain.handle('app:quit', () => { quitting = true; app.quit() })
}

app.whenReady().then(() => {
  store = new Store(join(app.getPath('userData'), 'moyu-browser.sqlite'))
  browserSession = session.fromPartition('persist:moyu-browser')
  browserSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
  registerIpc(); createWindow(); createTray(); startGlobalMouseListener()
  const settings = store.getSettings()
  const savedActiveTabId = store.getSavedActiveTabId()
  if (settings.restoreTabs) {
    const restored = store.listTabs()
    if (restored.length) { for (const tab of restored) createTab(tab.url, tab) }
    else createTab()
  } else createTab()
  if (savedActiveTabId && tabs.has(savedActiveTabId)) activeTabId = savedActiveTabId
  homeVisible = !getActiveTab() || getActiveTab()?.url === 'about:blank'
  updateBounds()
  pushState()
  registerBossShortcut(settings.bossShortcut)
  updateTransparentPresentation()
  updateAllWebTransparency()
})

app.on('before-quit', () => { quitting = true; if (hidePoller) clearInterval(hidePoller); stopGlobalMouseListener(); persistTabs(); store?.close(); globalShortcut.unregisterAll() })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })




