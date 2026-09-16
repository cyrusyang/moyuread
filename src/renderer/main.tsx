import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowLeft, ArrowRight, Bookmark, BookmarkPlus, BookOpen, ChevronDown, CircleHelp, Clock3, Eye, EyeOff, Folder, Globe2, History, Home, Minus, MoreHorizontal, Pencil, Plus, RefreshCw, Search, Settings2, ShieldCheck, Trash2, X } from 'lucide-react'
import type { AppSettings, BookmarkItem, BrowserState, HistoryItem, SiteItem } from '../shared/types'
import { SOFTWARE_UI_OPACITY } from '../shared/webTransparency'
import './styles.css'

const emptyState: BrowserState = { tabs: [], activeTabId: '', homeVisible: true, bookmarks: [], history: [], sites: [], settings: { theme: 'dark', searchEngine: 'bing', restoreTabs: false, autoHideOnLeave: false, webOnlyMode: false, webPageTransparency: false, bossShortcut: 'CommandOrControl+Alt+H' }, hidden: false }
type Panel = 'bookmarks' | 'history' | 'sites' | 'settings' | null
type Category = '推荐' | '小说' | '视频' | '备考' | '财经'
const TITLEBAR_HEIGHT = 34
const READER_BAR_HEIGHT = 54

const recommendations: Record<Category, Array<{ title: string; url: string }>> = {
  推荐: [
    { title: '微信读书', url: 'https://weread.qq.com/' },
    { title: '抖音', url: 'https://www.douyin.com/' },
    { title: '小红书', url: 'https://www.xiaohongshu.com/explore' },
    { title: '七猫小说', url: 'https://www.qimao.com/' },
    { title: '番茄小说', url: 'https://fanqienovel.com/' },
    { title: '粉笔网', url: 'https://www.fenbi.com/' },
    { title: '起点中文', url: 'https://www.qidian.com/' },
    { title: '掌阅', url: 'https://www.ireader.com.cn/' }
  ],
  小说: [
    { title: '微信读书', url: 'https://weread.qq.com/' },
    { title: '起点中文', url: 'https://www.qidian.com/' },
    { title: '番茄小说', url: 'https://fanqienovel.com/' },
    { title: '七猫小说', url: 'https://www.qimao.com/' }
  ],
  视频: [
    { title: '哔哩哔哩', url: 'https://www.bilibili.com/' },
    { title: '抖音', url: 'https://www.douyin.com/' },
    { title: '优酷', url: 'https://www.youku.com/' },
    { title: '腾讯视频', url: 'https://v.qq.com/' }
  ],
  备考: [
    { title: '粉笔网', url: 'https://www.fenbi.com/' },
    { title: '中国大学 MOOC', url: 'https://www.icourse163.org/' },
    { title: '知乎', url: 'https://www.zhihu.com/' },
    { title: '学堂在线', url: 'https://www.xuetangx.com/' }
  ],
  财经: [
    { title: '雪球', url: 'https://xueqiu.com/' },
    { title: '东方财富', url: 'https://www.eastmoney.com/' },
    { title: '同花顺', url: 'https://www.10jqka.com.cn/' },
    { title: '华尔街见闻', url: 'https://wallstreetcn.com/' }
  ]
}

function App() {
  const [state, setState] = useState<BrowserState>(emptyState)
  const [panel, setPanel] = useState<Panel>(null)
  const [address, setAddress] = useState('')
  const active = state.tabs.find((tab) => tab.id === state.activeTabId)
  const isHome = state.homeVisible
  const softwareTransparencyEnabled = state.settings.webOnlyMode
  const webPageTransparencyEnabled = state.settings.webPageTransparency

  useEffect(() => {
    window.moyu.getState().then(setState)
    const offState = window.moyu.onState(setState)
    const offHidden = window.moyu.onHidden((value) => setState((current) => ({ ...current, hidden: value })))
    return () => { offState(); offHidden() }
  }, [])

  useEffect(() => setAddress(active?.url?.startsWith('http') ? active.url : ''), [active?.id, active?.url])
  useEffect(() => {
    const syncLayout = () => {
      const left = panel ? window.innerWidth : 0
      const top = isHome ? 0 : TITLEBAR_HEIGHT + READER_BAR_HEIGHT
      void window.moyu.setLayout({ x: left, y: top, width: Math.max(0, window.innerWidth - left), height: Math.max(0, window.innerHeight - top) })
    }
    syncLayout()
    window.addEventListener('resize', syncLayout)
    return () => window.removeEventListener('resize', syncLayout)
  }, [isHome, panel])

  const navigate = () => { if (active && address.trim()) void window.moyu.navigate(active.id, address) }
  const openUrl = (url: string) => {
    setPanel(null)
    if (active) { setAddress(url); void window.moyu.navigate(active.id, url) }
    else void window.moyu.newTab(url)
  }
  const goHome = () => {
    setPanel(null)
    void window.moyu.showHome()
  }
  const togglePanel = (next: Exclude<Panel, null>) => setPanel((current) => current === next ? null : next)
  const addCurrentBookmark = async () => {
    if (!active || !active.url || active.url === 'about:blank') return
    const title = window.prompt('输入书签名称', active.title || active.url)
    if (title?.trim()) await window.moyu.addBookmark({ title, url: active.url })
  }

  return <div className={'app-shell ' + (state.settings.theme === 'light' ? 'theme-light' : 'theme-dark') + (softwareTransparencyEnabled ? ' transparent-mode' : '') + (!isHome ? ' reading-mode' : '')} style={softwareTransparencyEnabled ? { opacity: SOFTWARE_UI_OPACITY } : undefined}>
    <TitleBar
      onHome={goHome}
      softwareTransparencyEnabled={softwareTransparencyEnabled}
      webPageTransparencyEnabled={webPageTransparencyEnabled}
      onToggleSoftwareTransparency={() => void window.moyu.setSetting('webOnlyMode', !softwareTransparencyEnabled)}
      onToggleWebPageTransparency={() => void window.moyu.setSetting('webPageTransparency', !webPageTransparencyEnabled)}
    />
    {!isHome && <ReaderBar active={active} address={address} setAddress={setAddress} onNavigate={navigate} onHome={goHome} onBookmark={addCurrentBookmark} onSettings={() => togglePanel('settings')} />}
    {isHome && <HomePage state={state} onOpen={openUrl} onPanel={togglePanel} />}

    {panel && <SidePanel panel={panel} state={state} onOpen={openUrl} onClose={() => setPanel(null)} />}

    {state.hidden && <div className="hide-overlay" onDoubleClick={() => void window.moyu.toggleHidden(false)}>
      <div className="hide-card"><div className="hide-icon"><Eye size={20} /></div><strong>内容已隐藏</strong><span>当前阅读进度仍然保留</span><button onClick={() => void window.moyu.toggleHidden(false)}><Eye size={16} />恢复显示</button></div>
    </div>}
  </div>
}

function TitleBar({ onHome, softwareTransparencyEnabled, webPageTransparencyEnabled, onToggleSoftwareTransparency, onToggleWebPageTransparency }: {
  onHome: () => void
  softwareTransparencyEnabled: boolean
  webPageTransparencyEnabled: boolean
  onToggleSoftwareTransparency: () => void
  onToggleWebPageTransparency: () => void
}) {
  return <div className="titlebar">
    <button className="brand-button" onClick={onHome} title="回到软件首页" aria-label="回到软件首页"><Home size={15} /></button>
    <div className="window-actions">
      <button className={'transparency-toggle ' + (softwareTransparencyEnabled ? 'active' : '')} onClick={onToggleSoftwareTransparency} title={softwareTransparencyEnabled ? '关闭软件透明' : '开启软件透明'} aria-label={softwareTransparencyEnabled ? '关闭软件透明' : '开启软件透明'}>
        {softwareTransparencyEnabled ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
      {softwareTransparencyEnabled && <button className={'transparency-toggle web-transparency-toggle ' + (webPageTransparencyEnabled ? 'active' : '')} onClick={onToggleWebPageTransparency} title={webPageTransparencyEnabled ? '关闭网页透明' : '开启网页透明'} aria-label={webPageTransparencyEnabled ? '关闭网页透明' : '开启网页透明'}>
        <Globe2 size={15} />
      </button>}
      <button onClick={() => void window.moyu.minimizeToTray()} title="最小化" aria-label="最小化"><Minus size={16} /></button>
      <button className="close-button" onClick={() => void window.moyu.quit()} title="退出" aria-label="退出"><X size={16} /></button>
    </div>
  </div>
}

function ReaderBar({ active, address, setAddress, onNavigate, onHome, onBookmark, onSettings }: {
  active: BrowserState['tabs'][number] | undefined
  address: string
  setAddress: (value: string) => void
  onNavigate: () => void
  onHome: () => void
  onBookmark: () => void
  onSettings: () => void
}) {
  return <div className="reader-bar">
    <button className="reader-home" onClick={onHome} title="回到首页"><Home size={17} /><span>首页</span></button>
    <button disabled={!active?.canGoBack} onClick={() => active && void window.moyu.goBack(active.id)} title="后退"><ArrowLeft size={17} /></button>
    <button disabled={!active?.canGoForward} onClick={() => active && void window.moyu.goForward(active.id)} title="前进"><ArrowRight size={17} /></button>
    <form className="reader-address" onSubmit={(event) => { event.preventDefault(); onNavigate() }}>
      <ShieldCheck size={14} />
      <input value={address} onChange={(event) => setAddress(event.target.value)} spellCheck={false} aria-label="网址" />
    </form>
    <button onClick={() => active && (active.loading ? void window.moyu.stop(active.id) : void window.moyu.reload(active.id))} title={active?.loading ? '停止加载' : '刷新'}>{active?.loading ? <X size={16} /> : <RefreshCw size={16} />}</button>
    <button onClick={() => void onBookmark()} title="收藏当前页面"><BookmarkPlus size={17} /></button>
    <button onClick={onSettings} title="设置"><MoreHorizontal size={18} /></button>
  </div>
}

function HomePage({ state, onOpen, onPanel }: { state: BrowserState; onOpen: (url: string) => void; onPanel: (panel: Exclude<Panel, null>) => void }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category>('推荐')
  const sites = state.sites.filter((site) => site.url !== 'about:blank')
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (query.trim()) onOpen(query.trim()) }
  const addSite = async () => {
    const title = window.prompt('站点名称')
    const url = window.prompt('网址', 'https://')
    if (title?.trim() && url?.trim()) await window.moyu.addSite({ title, url })
  }

  return <main className="home-page">
    <form className="home-search" onSubmit={submit}>
      <Search size={18} />
      <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入网址或搜索内容..." />
      <button type="submit" aria-label="打开"><ArrowRight size={18} /></button>
    </form>

    <div className="home-tools">
      <button className={'compat-toggle ' + (state.settings.autoHideOnLeave ? 'on' : '')} onClick={() => void window.moyu.setSetting('autoHideOnLeave', !state.settings.autoHideOnLeave)}>
        <span className="toggle-track"><span /></span><span>移出隐藏</span>
      </button>
      <button onClick={() => onPanel('history')}><History size={16} />历史记录</button>
      <button onClick={() => onPanel('bookmarks')}><Bookmark size={16} />收藏夹</button>
    </div>

    <section className="recommend-card">
      <nav className="category-list" aria-label="网站分类">
        {(Object.keys(recommendations) as Category[]).map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}
      </nav>
      <div className="recommend-grid">
        {recommendations[category].map((site) => <button key={site.title} onClick={() => onOpen(site.url)}>{site.title}</button>)}
      </div>
    </section>

    <section className="my-sites-card">
      <div className="sites-heading">
        <div><span className="site-switch"><span /></span><strong>我的站点</strong></div>
        <div><button onClick={() => onPanel('sites')}>编辑</button><button className="add-site" onClick={() => void addSite()} title="添加站点"><Plus size={17} /></button></div>
      </div>
      {sites.length === 0 ? <button className="empty-sites" onClick={() => void addSite()}>暂未添加站点</button> : <div className="site-grid">{sites.map((site) => <button key={site.id} onClick={() => onOpen(site.url)}><Globe2 size={16} /><span>{site.title}</span></button>)}</div>}
    </section>

    <nav className="bottom-nav" aria-label="主导航">
      <button className="active" onClick={() => undefined} title="首页"><Home size={20} /></button>
      <button onClick={() => onPanel('bookmarks')} title="收藏夹"><BookOpen size={19} /></button>
      <button onClick={() => onPanel('sites')} title="我的站点"><Pencil size={19} /></button>
      <button onClick={() => onPanel('history')} title="历史记录"><History size={19} /></button>
      <button onClick={() => onPanel('settings')} title="设置"><Settings2 size={19} /></button>
    </nav>
  </main>
}

function SidePanel({ panel, state, onOpen, onClose }: { panel: Exclude<Panel, null>; state: BrowserState; onOpen: (url: string) => void; onClose: () => void }) {
  return <section className="side-panel">
    <div className="panel-title"><div><p>{panel === 'bookmarks' ? '收藏夹' : panel === 'history' ? '历史记录' : panel === 'sites' ? '我的站点' : '设置'}</p><small>{panel === 'settings' ? '外观、隐私与快捷操作' : '数据仅保存在本机'}</small></div><button onClick={onClose}><X size={17} /></button></div>
    {panel === 'bookmarks' && <BookmarksPanel items={state.bookmarks} onOpen={onOpen} />}
    {panel === 'history' && <HistoryPanel items={state.history} onOpen={onOpen} />}
    {panel === 'sites' && <SitesPanel items={state.sites.filter((site) => site.url !== 'about:blank')} onOpen={onOpen} />}
    {panel === 'settings' && <SettingsPanel settings={state.settings} />}
  </section>
}

function BookmarksPanel({ items, onOpen }: { items: BookmarkItem[]; onOpen: (url: string) => void }) {
  const roots = items.filter((item) => !item.parentId)
  const create = async (kind: BookmarkItem['kind']) => { const title = window.prompt(kind === 'folder' ? '文件夹名称' : '书签名称'); if (!title?.trim()) return; const url = kind === 'url' ? window.prompt('网址', 'https://') : null; if (kind === 'url' && !url?.trim()) return; await window.moyu.addBookmark({ title, url, kind }) }
  const edit = async (item: BookmarkItem) => { const title = window.prompt('编辑名称', item.title); if (!title?.trim()) return; const url = item.kind === 'url' ? window.prompt('编辑网址', item.url ?? 'https://') : undefined; if (item.kind === 'url' && !url?.trim()) return; await window.moyu.updateBookmark(item.id, { title, ...(item.kind === 'url' ? { url } : {}) }) }
  const renderItem = (item: BookmarkItem, depth = 0): React.ReactNode => <div key={item.id}><div className="list-row" style={{ paddingLeft: 12 + depth * 16 }} onClick={() => item.url && onOpen(item.url)}>{item.kind === 'folder' ? <Folder size={16} /> : <Globe2 size={16} />}<span className="row-main"><strong>{item.title}</strong>{item.url && <small>{item.url}</small>}</span><button onClick={(event) => { event.stopPropagation(); void edit(item) }} title="编辑"><Pencil size={13} /></button><button onClick={(event) => { event.stopPropagation(); void window.moyu.deleteBookmark(item.id) }} title="删除"><Trash2 size={13} /></button></div>{item.kind === 'folder' && items.filter((child) => child.parentId === item.id).map((child) => renderItem(child, depth + 1))}</div>
  return <div className="panel-body"><div className="panel-actions"><button onClick={() => void create('folder')}><Folder size={14} />新建文件夹</button><button onClick={() => void create('url')}><Plus size={14} />添加书签</button></div>{roots.length === 0 ? <Empty label="还没有收藏" /> : <div className="list">{roots.map((item) => renderItem(item))}</div>}<div className="panel-note"><ChevronDown size={14} />点击条目即可打开</div></div>
}

function HistoryPanel({ items, onOpen }: { items: HistoryItem[]; onOpen: (url: string) => void }) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => items.filter((item) => (item.title + ' ' + item.url).toLowerCase().includes(query.trim().toLowerCase())), [items, query])
  return <div className="panel-body"><div className="panel-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索历史记录" /></div><div className="panel-actions"><button onClick={() => void window.moyu.clearHistory()}><Trash2 size={14} />清空历史</button></div>{filtered.length === 0 ? <Empty label={query ? '没有匹配的记录' : '还没有历史记录'} /> : <div className="list">{filtered.map((item) => <div className="list-row" key={item.id} onClick={() => onOpen(item.url)}><Clock3 size={16} /><span className="row-main"><strong>{item.title}</strong><small>{item.url}</small></span><button onClick={(event) => { event.stopPropagation(); void window.moyu.deleteHistory(item.id) }} title="删除"><X size={14} /></button></div>)}</div>}</div>
}

function SitesPanel({ items, onOpen }: { items: SiteItem[]; onOpen: (url: string) => void }) {
  const add = async () => { const title = window.prompt('站点名称'); const url = window.prompt('网址', 'https://'); if (title?.trim() && url?.trim()) await window.moyu.addSite({ title, url }) }
  const edit = async (item: SiteItem) => { const title = window.prompt('站点名称', item.title); const url = window.prompt('网址', item.url); if (title?.trim() && url?.trim()) await window.moyu.updateSite(item.id, { title, url }) }
  return <div className="panel-body"><div className="panel-actions"><button onClick={() => void add()}><Plus size={14} />添加站点</button></div>{items.length === 0 ? <Empty label="还没有常用站点" /> : <div className="list">{items.map((item) => <div className="list-row" key={item.id} onClick={() => onOpen(item.url)}><Globe2 size={16} /><span className="row-main"><strong>{item.title}</strong><small>{item.url}</small></span><button onClick={(event) => { event.stopPropagation(); void edit(item) }} title="编辑"><Pencil size={13} /></button><button onClick={(event) => { event.stopPropagation(); void window.moyu.deleteSite(item.id) }} title="删除"><Trash2 size={13} /></button></div>)}</div>}</div>
}

function SettingsPanel({ settings }: { settings: AppSettings }) {
  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => { void window.moyu.setSetting(key, value) }
  const [shortcut, setShortcut] = useState(settings.bossShortcut)
  const [recording, setRecording] = useState(false)
  useEffect(() => setShortcut(settings.bossShortcut), [settings.bossShortcut])
  const readable = shortcut.replace('CommandOrControl', 'Ctrl').replace('Super', 'Win').replaceAll('+', ' + ')
  const handleShortcut = async (event: React.KeyboardEvent) => { if (!recording) return; event.preventDefault(); const parts: string[] = []; if (event.ctrlKey) parts.push('CommandOrControl'); if (event.metaKey) parts.push('Super'); if (event.altKey) parts.push('Alt'); if (event.shiftKey) parts.push('Shift'); const key = event.key.length === 1 ? event.key.toUpperCase() : event.key; if (!['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) parts.push(key); if (parts.length >= 2) { const result = await window.moyu.updateBossShortcut(parts.join('+')); if (result.error) window.alert(result.error); else setShortcut(result.shortcut); setRecording(false) } }
  return <div className="panel-body settings-body">
    <SettingGroup title="外观与搜索"><label className="setting-row"><span>主题</span><select value={settings.theme} onChange={(event) => update('theme', event.target.value as AppSettings['theme'])}><option value="dark">深色</option><option value="light">浅色</option></select></label><label className="setting-row"><span>默认搜索引擎</span><select value={settings.searchEngine} onChange={(event) => update('searchEngine', event.target.value as AppSettings['searchEngine'])}><option value="bing">必应</option><option value="baidu">百度</option></select></label></SettingGroup>
    <SettingGroup title="浏览与隐私"><label className="setting-row"><span>启动时恢复标签</span><input type="checkbox" checked={settings.restoreTabs} onChange={(event) => update('restoreTabs', event.target.checked)} /></label><label className="setting-row"><span>鼠标移出时隐藏</span><input type="checkbox" checked={settings.autoHideOnLeave} onChange={(event) => update('autoHideOnLeave', event.target.checked)} /></label><label className="setting-row"><span>软件透明</span><input type="checkbox" checked={settings.webOnlyMode} onChange={(event) => update('webOnlyMode', event.target.checked)} /></label>{settings.webOnlyMode && <label className="setting-row"><span>网页透明</span><input type="checkbox" checked={settings.webPageTransparency} onChange={(event) => update('webPageTransparency', event.target.checked)} /></label>}<button className="danger-action" onClick={() => void window.moyu.clearWebData()}><Trash2 size={15} />清除 Cookie 与网站数据</button></SettingGroup>
    <SettingGroup title="老板键"><div className="shortcut-editor"><span>当前快捷键</span><button onClick={() => setRecording(true)} onKeyDown={(event) => void handleShortcut(event)} autoFocus={recording}>{recording ? '请按下新的组合键' : readable}</button></div></SettingGroup>
    <div className="settings-footer"><ShieldCheck size={14} />网页运行在隔离环境中，无法访问本地文件。</div>
  </div>
}

function SettingGroup({ title, children }: { title: string; children: React.ReactNode }) { return <div className="setting-group"><h3>{title}</h3>{children}</div> }
function Empty({ label }: { label: string }) { return <div className="empty"><Bookmark size={21} /><span>{label}</span></div> }

createRoot(document.getElementById('root')!).render(<App />)

