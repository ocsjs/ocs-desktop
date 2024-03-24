# ocs-desktop

ocs 软件

## 运行

```bash
# 安装依赖
npm i pnpm -g
pnpm install

# 打开两个终端
# 终端1
cd packages/web
npm run dev
# 终端2

# 编译 common 库
cd packages/common
npx tsc
# 回到 app 项目，并运行
cd ../app
npm run dev
```

## 打包

```bash
npm run build
```
