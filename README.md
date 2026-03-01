# ocs-desktop

拥有 一键刷课，多账号刷课，浏览器多开/分身，浏览器管理，自动登录，等功能，支持 Windows, Linux, Mac 多个操作系统。

## 初始化项目依赖

```bash
# 启用 Corepack（Node.js 自带的包管理器管理工具）
corepack enable
corepack prepare pnpm@10.21.0 --activate

# 安装依赖
pnpm install

# 编译 common 库，此操作只需执行一次，除非后续更改 common 代码，否则无需重复操作。
pnpm dev:common
```

## 运行

启动项目，需要在**两个终端**（命令窗口）中分别运行：

**终端 1** - 运行 Electron 渲染进程（Vite 开发服务器）

```bash
pnpm dev:web
```

**终端 2** - 运行 Electron 主进程

```bash
pnpm dev:app
```

访问 http://localhost:3000 查看 Web 界面。

## 打包

```bash
pnpm build
```

## 注意

新项目打包时需删除 node_modules/chromium/lib/chromium 中的文件，否则打包后会带有 chromium 文件导致体积非常大。
因为此项目主要依赖电脑本地的浏览器，所以无需内置 chromium，移除即可。
