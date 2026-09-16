# Moyu Browser

一个基于 Electron 的独立桌面浏览器外壳，主打**专注模式**与**一键隐藏**。

不依赖任何云服务：标签页、书签、历史记录和设置全部存储在本机 SQLite 中。

## 功能特性

### 浏览

- 多标签页浏览，基于 Electron `WebContentsView`
- 前进 / 后退 / 刷新 / 停止 / 缩放
- 智能地址栏：自动区分 URL 与搜索词，支持必应 / 百度
- 导航白名单：仅允许 `http://`、`https://` 与 `about:blank`，阻断 `file://` 等本地协议

### 摸鱼向

- **老板键（Boss Key）**：全局快捷键，一键隐藏 / 恢复窗口。快捷键在保存前会做规范化与合法性校验，非法值会被拒绝
- **网页透明模式**：把网页背景置为透明，让页面与桌面融为一体
- **仅网页模式（Web Only Mode）**：隐藏浏览器 UI，只保留网页内容
- **离开自动隐藏**：鼠标移出窗口时自动收起
- 托盘常驻，最小化到托盘

### 数据管理

- 书签：支持文件夹与网址两级结构，可拖拽排序
- 历史记录：单条删除 / 一键清空
- 自定义首页站点快捷入口
- 设置项：主题（亮 / 暗）、搜索引擎、恢复会话标签、自动隐藏、网页透明、老板键
- 一键清除网页数据（Cookie、缓存等）

## 技术栈

| 类别 | 选型 |
| --- | --- |
| 运行时 | Electron 35 |
| 构建 | electron-vite 3 + Vite 6 |
| UI | React 18 + lucide-react |
| 语言 | TypeScript 5.7 |
| 存储 | better-sqlite3 |
| 全局热键 | uiohook-napi |
| 测试 | Vitest 2 + jsdom |
| 打包 | electron-builder（NSIS）+ electron-updater |

## 目录结构

```
src/
├── main/                 # 主进程
│   ├── main.ts           # 窗口、标签页、快捷键、托盘、IPC
│   └── store.ts          # SQLite 持久化
├── preload/
│   └── index.ts          # contextBridge 暴露的 window.moyu API
├── renderer/             # 渲染层（React）
│   ├── index.html
│   ├── main.tsx
│   └── styles.css
└── shared/               # 主进程与渲染层共享
    ├── api.ts            # MoyuApi 接口定义
    ├── types.ts          # 领域类型
    ├── url.ts            # 地址栏输入归一化 + 导航白名单
    ├── shortcut.ts       # 快捷键规范化与校验
    ├── webTransparency.ts # 网页透明 CSS 注入
    └── windowBounds.ts   # 窗口边界计算

tests/                    # Vitest 单元测试（shared 层纯函数）
```

`src/shared` 中的逻辑全部为无副作用的纯函数，因此可以直接被单元测试覆盖，不依赖 Electron 运行时。

## 开发

```bash
npm install          # 安装依赖
npm run dev          # 启动开发模式（热重载）
npm run typecheck    # TypeScript 类型检查
npm test             # 运行单元测试
```

## 构建与打包

```bash
npm run build        # 编译到 out/
npm run package:win  # 编译 + 重建原生模块 + 生成 Windows NSIS 安装包
```

产物输出到 `release/`，安装包命名为 `MoyuBrowser-<version>-setup.exe`。

> `better-sqlite3` 与 `uiohook-napi` 是原生模块，切换 Electron 版本后需要重新编译（`npm run rebuild:native`）。

## 隐私

本项目不含任何遥测、统计或上报逻辑，所有数据仅保存在本机。仓库中不包含任何密钥、令牌或内网地址。

## 许可证

[MIT](LICENSE)
