# ocs-desktop

拥有 一键刷课，多账号刷课，浏览器多开/分身，浏览器管理，自动登录，等功能，支持 Windows, Linux, Mac 多个操作系统。

## 初始化项目依赖

```bash
# 安装依赖
npm i pnpm -g
pnpm install

# 编译 common 库，此操作只需执行一次，除非后续更改 common 代码，否则无需重复操作。
cd packages/common
npx tsc
```

## 运行

启动项目，需要打开两个终端（命令窗口）

**终端 1** - 运行 electron 渲染进程

```bash
cd packages/web
npm run dev
```

**终端 2** - 运行 electron 主进程

```bash
cd packages/app
npm run dev
```

## 打包

```bash
npm run build
```

## 注意

新项目打包时需删除 node_modules/chromium/lib/chromium 中的文件，否则打包后会带有 chromium 文件导致体积非常大。
因为此项目主要依赖电脑本地的浏览器，所以无需内置 chromium，移除即可。
