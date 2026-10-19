#!/usr/bin/env bash
#
# ocs-desktop 本地环境快速构建脚本（macOS / Linux，Windows 可用 Git Bash 运行）
#
# 功能：
#   1. 检测 Node.js（>= 22），未安装则自动安装
#   2. 检测 pnpm（>= 10），未安装则自动安装
#   3. 检测 Electron 依赖，配置国内镜像源（ELECTRON_MIRROR）加速下载
#   4. 执行 pnpm install 补全依赖
#
# 可选环境变量：
#   NODEJS_MIRROR   Node.js 下载镜像，默认 https://nodejs.org/dist
#                   国内可设为 https://npmmirror.com/mirrors/node
#   ELECTRON_MIRROR Electron 下载镜像，默认 https://npmmirror.com/mirrors/electron/
#                   设置为 "off" 可禁用镜像切换
#
set -euo pipefail

REQUIRED_NODE_MAJOR=22
NODE_VERSION_FULL="v22.20.0"
PNPM_VERSION="10.21.0"
DEFAULT_ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
DEFAULT_ELECTRON_BUILDER_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"

log()  { printf '\033[1;32m[setup]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[setup]\033[0m %s\n' "$*" >&2; }
err()  { printf '\033[1;31m[setup]\033[0m %s\n' "$*" >&2; }

need_cmd() { command -v "$1" >/dev/null 2>&1; }

cd "$(dirname "$0")/.."

# ---------------------------------------------------------------------------
# 1. Node.js
# ---------------------------------------------------------------------------
node_major() {
	node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/'
}

install_node_via_tarball() {
	local os arch plat
	os="$(uname -s)"
	arch="$(uname -m)"

	case "$os" in
		Darwin) plat="darwin" ;;
		Linux)  plat="linux" ;;
		*)      err "不支持的操作系统: $os"; exit 1 ;;
	esac
	case "$arch" in
		x86_64 | amd64)   plat="${plat}-x64" ;;
		arm64 | aarch64)  plat="${plat}-arm64" ;;
		*)                err "不支持的 CPU 架构: $arch"; exit 1 ;;
	esac

	local mirror="${NODEJS_MIRROR:-https://nodejs.org/dist}"
	local file="node-${NODE_VERSION_FULL}-${plat}.tar.xz"
	local url="${mirror}/${NODE_VERSION_FULL}/${file}"
	local tmp
	tmp="$(mktemp -d)"

	log "下载 Node.js ${NODE_VERSION_FULL} (${plat}) ..."
	log "来源: ${url}"
	curl -fSL --progress-bar "$url" -o "${tmp}/${file}"

	local dest="${HOME}/.local/nodejs"
	mkdir -p "$dest"
	tar -xJf "${tmp}/${file}" --strip-components=1 -C "$dest"
	rm -rf "$tmp"

	export PATH="${dest}/bin:${PATH}"

	# 持久化 PATH（避免重复写入）
	local line="export PATH=\"${dest}/bin:\$PATH\""
	local profile
	for profile in "${HOME}/.zshrc" "${HOME}/.bashrc" "${HOME}/.profile"; do
		if [ -f "$profile" ] && ! grep -qF "$dest/bin" "$profile"; then
			echo "$line" >> "$profile"
			log "已将 Node.js 路径写入 ${profile}"
		fi
	done
	if [ ! -f "${HOME}/.zshrc" ] && [ ! -f "${HOME}/.bashrc" ] && [ ! -f "${HOME}/.profile" ]; then
		echo "$line" >> "${HOME}/.profile"
		log "已将 Node.js 路径写入 ${HOME}/.profile"
	fi
}

setup_node() {
	if need_cmd node; then
		local major
		major="$(node_major)"
		if [ -n "$major" ] && [ "$major" -ge "$REQUIRED_NODE_MAJOR" ]; then
			log "Node.js 已安装: $(node -v)"
			return
		fi
		warn "Node.js 版本过低 ($(node -v))，需要 >= ${REQUIRED_NODE_MAJOR}，将安装新版本"
	else
		log "未检测到 Node.js，开始自动安装 ..."
	fi

	# macOS 优先使用 Homebrew
	if [ "$(uname -s)" = "Darwin" ] && need_cmd brew; then
		log "使用 Homebrew 安装 Node.js ..."
		brew install node@22 || brew install node
		brew link --overwrite node@22 2>/dev/null || true
	else
		install_node_via_tarball
	fi

	if ! need_cmd node; then
		err "Node.js 安装失败，请手动安装 >= ${REQUIRED_NODE_MAJOR} 后重试: https://nodejs.org/"
		exit 1
	fi
	log "Node.js 安装完成: $(node -v)"
}

# ---------------------------------------------------------------------------
# 2. pnpm
# ---------------------------------------------------------------------------
setup_pnpm() {
	if need_cmd pnpm; then
		log "pnpm 已安装: $(pnpm -v)"
		return
	fi

	log "未检测到 pnpm，开始自动安装 ..."
	if need_cmd corepack; then
		log "使用 corepack 启用 pnpm@${PNPM_VERSION} ..."
		corepack enable || true
		corepack prepare "pnpm@${PNPM_VERSION}" --activate
	else
		log "使用 npm 全局安装 pnpm@${PNPM_VERSION} ..."
		npm install -g "pnpm@${PNPM_VERSION}"
	fi

	if ! need_cmd pnpm; then
		err "pnpm 安装失败，请手动执行: npm install -g pnpm"
		exit 1
	fi
	log "pnpm 安装完成: $(pnpm -v)"
}

# ---------------------------------------------------------------------------
# 3. Electron 镜像配置
# ---------------------------------------------------------------------------
setup_electron_mirror() {
	if [ "${ELECTRON_MIRROR:-}" = "off" ]; then
		log "已通过 ELECTRON_MIRROR=off 禁用 Electron 国内镜像"
		return
	fi
	export ELECTRON_MIRROR="${ELECTRON_MIRROR:-$DEFAULT_ELECTRON_MIRROR}"
	export ELECTRON_BUILDER_BINARIES_MIRROR="${ELECTRON_BUILDER_BINARIES_MIRROR:-$DEFAULT_ELECTRON_BUILDER_MIRROR}"
	log "Electron 下载镜像: ${ELECTRON_MIRROR}"
	log "electron-builder 二进制镜像: ${ELECTRON_BUILDER_BINARIES_MIRROR}"
}

# ---------------------------------------------------------------------------
# 4. 依赖安装 + Electron 校验
# ---------------------------------------------------------------------------
install_deps() {
	log "执行 pnpm install ..."
	pnpm install
	verify_electron
}

# Electron 二进制校验（postinstall 可能因网络问题未下载成功）。
# pnpm workspace 下 electron 通常在子包或 .pnpm 虚拟 store 中，需全局查找。
verify_electron() {
	local candidates=()
	local d

	[ -d node_modules/electron ] && candidates+=("node_modules/electron")
	for d in packages/*/node_modules/electron; do
		[ -e "$d" ] && candidates+=("$d")
	done
	for d in node_modules/.pnpm/electron@*/node_modules/electron; do
		[ -d "$d" ] && candidates+=("$d")
	done

	if [ "${#candidates[@]}" -eq 0 ]; then
		err "未在 workspace 中找到 electron 包，请检查 pnpm install 是否成功"
		exit 1
	fi

	# 去重（子包 node_modules 中的 electron 是指向 .pnpm 的符号链接）
	# 注意：macOS 自带 bash 3.2 在 set -u 下展开空数组会报 unbound variable，
	# 因此用下标遍历而不是 ${uniq[*]} 匹配
	local real dup i
	local uniq=()
	for d in "${candidates[@]}"; do
		real="$(cd "$d" && pwd -P)"
		dup=0
		for ((i = 0; i < ${#uniq[@]}; i++)); do
			if [ "${uniq[i]}" = "$real" ]; then
				dup=1
				break
			fi
		done
		[ "$dup" -eq 0 ] && uniq+=("$real")
	done
	log "检测到 Electron 包目录: ${uniq[*]}"

	local ok=0
	for d in "${uniq[@]}"; do
		local bin=""
		[ -f "$d/path.txt" ] && bin="$d/dist/$(cat "$d/path.txt")"
		# path.txt 与真实二进制都必须存在，否则重新下载
		if [ -z "$bin" ] || [ ! -e "$bin" ]; then
			warn "Electron 二进制未下载完成: $d，尝试手动下载 ..."
			( cd "$d" && node install.js ) || {
				err "Electron 二进制下载失败: $d，可设置 ELECTRON_MIRROR 后重试"
				exit 1
			}
		fi
		if [ -f "$d/path.txt" ] && [ -e "$d/dist/$(cat "$d/path.txt")" ]; then
			log "Electron 已就绪: $d/dist/$(cat "$d/path.txt")"
			ok=1
		fi
	done
	[ "$ok" -eq 0 ] && {
		err "Electron 二进制校验失败"
		exit 1
	}

	# 冒烟测试：确认 electron 可执行（与 electron-vite 的解析方式一致）
	local ver
	if ver="$(pnpm --filter @ocs-desktop/app exec electron --version 2>/dev/null)"; then
		log "Electron 启动校验通过: $ver"
	else
		err "Electron 启动校验失败，请手动执行排查: pnpm --filter @ocs-desktop/app exec electron --version"
		exit 1
	fi
}

main() {
	log "=== ocs-desktop 环境初始化 ==="
	setup_node
	setup_pnpm
	setup_electron_mirror
	install_deps
	log "=== 环境初始化完成 ==="
	log "常用命令: pnpm dev / pnpm build / pnpm test"
}

main "$@"
