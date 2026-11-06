## 后端来自 [hotier/MediaGet](https://github.com/hotier/MediaGet)，前端完全由 Codex 完成，作者屌毛不会

# MediaGet 完整源码（Windows 最终整合版）

这一份项目包含原始网页前端、解析后台和全部最终 Windows 桌面功能。无需再按顺序应用旧版“源码补充”ZIP，也无需修改构建后的 JS 分块。

已整合：平台账号窗口与 Cookie 保存、系统代理、YouTube 最高画质下载和音视频合并、TikTok 始终启用、Instagram 修复、自选下载目录、下载进度及取消、完成后定位文件、内置图标。

## 目录怎么找

| 路径 | 内容 |
| --- | --- |
| `src/app/` | Next.js 页面、布局和 API 入口 |
| `src/components/` | 视频结果、音乐、播放器等 React 前端组件 |
| `src/app/globals.css` | 网页全局样式 |
| `public/` | 品牌图标、平台 Logo 等静态资源 |
| `packages/parse-core/` | 各平台解析、缓存和请求处理源码 |
| `desktop/main.cjs` | Windows 窗口、账号菜单、代理设置和服务启动 |
| `desktop/preload.cjs` | 下载状态面板、进度条、取消与文件夹按钮 |
| `desktop/progress.cjs`、`desktop/downloads.cjs` | 下载任务、自选目录、文件定位 |
| `desktop/youtube.cjs`、`tiktok.cjs`、`instagram.cjs` | 已验证的桌面解析实现 |
| `desktop/youtube-download.cjs` | 本地下载、音视频合并及清理 |
| `desktop/Launcher.cs`、`MediaGet.ico` | 单文件 EXE 启动器和内嵌图标 |
| `scripts/build-windows.ps1` | Windows 打包脚本 |
| `scripts/runtime-assets.json` | 依赖版本、下载地址和校验值 |
| `tests/`、`desktop/*.test.cjs` | 原项目及桌面相关测试 |

修改普通界面主要看 `src/`；修改右下角下载面板主要看 `desktop/preload.cjs`，它属于 Windows 适配层。

## 开发前准备

- Node.js 22.12 或更高版本，包含 npm；本次验证使用 Node.js 24.22.1。
- 构建 Windows EXE 时使用 Windows 10/11 64 位。脚本使用系统自带的 PowerShell、tar 和 .NET Framework C# 编译器。
- 建议解压到较短路径，例如 `E:\MediaGet-source`，避免 Windows 路径过长。

首次在项目根目录执行：

```powershell
npm ci
npm ci --prefix desktop
```

### 只预览网页前端

```powershell
npm run dev
```

按控制台显示的地址打开网页，默认是 `http://localhost:3000`，修改 React 和 CSS 后可热更新。

注意：普通网页模式沿用原项目的 Web/Serverless 解析逻辑；系统账号窗口、本地 yt-dlp、自动合并和下载面板属于桌面模式。仅启动网页不等于启动 Windows 最终版的全部功能。

### 从源码构建 Windows EXE（推荐）

复用现有成品中已经验证过的运行组件，重新构建本项目的全部网页和桌面代码：

```powershell
npm run build:windows -- -RuntimeFromExe "D:\Soft\视频解析工具MediaGet\MediaGet-Windows-x64.exe"
```

输出在 `dist/MediaGet-Windows-x64.exe`，同时生成 `dist/SHA256.txt`。

这里复用的只是 Electron、yt-dlp、FFmpeg 等运行组件；网页和桌面代码以本项目源码重新构建，不会套回旧版编译代码。原 EXE 和用户账号设置不会被修改。

也可以不提供现有 EXE，让脚本按固定版本下载依赖：

```powershell
npm run build:windows
```

该方式需要访问 GitHub 和 FFmpeg 构建站，下载量较大。下载后会检查 SHA-256。若下载环境需要代理，可以先为当前 PowerShell 设置 `HTTPS_PROXY`，例如：

```powershell
$env:HTTPS_PROXY = "http://127.0.0.1:你的HTTP代理端口"
```

网络代理只影响当前终端，不要把账号密码或真实 Cookie 写进源码。

### 本机桌面预览

完成上述构建后，可运行：

```powershell
npm run desktop:start
```

它会使用 `.work/runtime-base` 中的运行环境，并将开发设置存到 `.work/dev-user-data`，与正常安装使用的数据分开。前端修改后需重新 `npm run build` 再启动桌面预览。

首次桌面预览前，请先完成一次 Windows 构建，让脚本准备运行组件。若希望独立准备环境，可用 `npm run desktop:runtime` 安装 Electron，并按 `scripts/runtime-assets.json` 将 yt-dlp、FFmpeg、ffprobe 放入 `desktop/tools/`；只安装 Electron 不足以使用本地解析及合并功能。

## 源码接入方式

`desktop/server-runner.cjs` 在启动 Next.js 前，将三个桌面解析器注册到 `globalThis.__mediagetDesktopParsers`。

`packages/parse-core/src/lib/youtube.js`、`tiktokDlp.js`、`instagram.js` 在源码层检测这个桥接对象：桌面模式调用最新本地实现；没有桥接对象的普通 Web 模式继续使用原实现。Instagram 保留原图文解析作为回退。

因此，不再依赖旧补充说明里的 `2072.js`、`64449` 等构建分块编号。以后重新构建或改变前端代码，无需手工修改打包产物。

## 测试

```powershell
npm run test:desktop
npm test -- tests/desktop-parsers.test.ts
```

原项目其余测试仍在 `tests/`。真实在线解析需要相应网站、代理或登录状态，普通单元测试不代表所有线上内容都能访问。

## 运行依赖和数据

- Electron 42.0.0、undici 7.16.0、yt-dlp 2026.10.26、FFmpeg 9.0.2；运行依赖按脚本准备，不把大型二进制混入源码包。
- 正常发行版继续使用 `%APPDATA%\mediaget-desktop` 保存用户设置；不读取旧 TikTok 关闭开关。
- 单文件启动器按打包内容的摘要生成独立解压目录，重新构建后不会误用旧版缓存。
- `.work/`、`.next/`、`node_modules/`、`dist/` 都是生成目录，不属于源码备份内容。
- 真实 `settings.env`、Cookie、登录浏览会话和下载文件均不应提交或分发。

## 来源与许可证

基于 `hotier/MediaGet` 0.1.24 的原始源码及此次 Windows 适配。原项目 README 保存在 `README.upstream.md`，原许可证、接口文档及原始测试均保留。

原项目：https://github.com/hotier/MediaGet 。第三方运行组件各自的许可证随其发行包和最终程序保留。本项目不解除平台的私密、付费、地区或访问权限限制。
