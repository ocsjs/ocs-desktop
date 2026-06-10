#!/usr/bin/env bash

# ==========================================
# 手动发布脚本（备用）
# ==========================================
# 注意：常规发布流程由 Release Please GitHub Action 自动管理。
# 当你在 main 分支上推送符合 Conventional Commits 规范的提交时：
#   1. Release Please 会自动创建 Release PR（包含版本号 bump + CHANGELOG 更新）
#   2. 合并 Release PR 后，会自动创建 GitHub Release + tag
#   3. tag 推送后触发 build.yml 执行多平台构建和产物上传
#
# 此脚本仅在需要手动发布时使用（如紧急修复、跳过 CI 流程等场景）。
# ==========================================

set -e

# 从控制台获取需要发布的版本
read -p "请输入需要发布的版本(例如: 0.0.1): " version

# 判断是否为空
if [ -z "$version" ]; then
    echo "版本号不能为空!"
    exit 1
fi

# 确认是否发布版本
read -p "确认发布版本 $version ? [y/n]: " isRelease

if [ "$isRelease" = "y" ]; then
    echo "版本发布 $version"

    # 代码检查
    pnpm lint &&
    # 更新版本
    pnpm version "$version" --no-git-tag-version --allow-same-version &&
    cd ./packages/app &&
    pnpm version "$version" --no-git-tag-version --allow-same-version &&
    cd ../../ &&
    # 本地构建
    pnpm build &&
    # 保存
    git add ./packages/app/package.json package.json CHANGELOG.md &&
    git commit -m "chore: release $version" &&
    git tag "v$version" &&
    # 提交
    git push origin main --tags
    echo "$version 发布成功"
elif [ "$isRelease" = "n" ]; then
    echo "取消发布"
else
    echo "输入有误"
fi
