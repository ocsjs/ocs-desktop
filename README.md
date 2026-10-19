# ocs-desktop

拥有 一键刷课，多账号刷课，浏览器多开/分身，浏览器管理，自动登录，等功能，支持 Windows, Linux, Mac 多个操作系统。

## 初始化项目依赖

### 方式一：一键环境初始化（推荐）

使用环境构建脚本，自动完成 Node.js（>= 22）、pnpm（>= 10）的检测与安装，并配置 Electron 国内镜像源后安装依赖：

```bash
# macOS / Linux / Windows Git Bash
pnpm setup            # 或 bash ./scripts/setup.sh

# Windows PowerShell
powershell -ExecutionPolicy Bypass -File ./scripts/setup.ps1
```

可选环境变量：

```bash
# Node.js 下载镜像（国内加速）
export NODEJS_MIRROR=https://npmmirror.com/mirrors/node

# 禁用 Electron 国内镜像（默认使用 npmmirror）
export ELECTRON_MIRROR=off
```

### 方式二：手动安装

```bash
# 启用 Corepack（Node.js 自带的包管理器管理工具，会自动识别 packageManager 字段安装对应版本的 pnpm）
corepack enable

# 安装依赖
pnpm install
```

## 运行

一键启动开发环境（同时运行 common 编译、Web 开发服务器、Electron 主进程）：

```bash
pnpm dev
```

也可以单独启动各个模块（各命令已自动处理 common 编译，无需手动执行）：

```bash
pnpm dev:web   # 仅启动 Web 开发服务器
pnpm dev:app   # 仅启动 Electron 主进程
```

访问 http://localhost:3000 查看 Web 界面。

## 打包

```bash
pnpm build
```

## 注意

新项目打包时需删除 node_modules/chromium/lib/chromium 中的文件，否则打包后会带有 chromium 文件导致体积非常大。
因为此项目主要依赖电脑本地的浏览器，所以无需内置 chromium，移除即可。
