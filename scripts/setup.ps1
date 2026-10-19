# ocs-desktop 本地环境快速构建脚本（Windows PowerShell）
#
# 功能：
#   1. 检测 Node.js（>= 22），未安装则自动安装（优先 winget，兜底官方 MSI）
#   2. 检测 pnpm（>= 10），未安装则自动安装
#   3. 检测 Electron 依赖，配置国内镜像源（ELECTRON_MIRROR）加速下载
#   4. 执行 pnpm install 补全依赖
#
# 用法：  powershell -ExecutionPolicy Bypass -File ./scripts/setup.ps1
#
# 可选环境变量：
#   $env:NODEJS_MIRROR   Node.js 下载镜像，默认 https://nodejs.org/dist
#                        国内可设为 https://npmmirror.com/mirrors/node
#   $env:ELECTRON_MIRROR Electron 下载镜像，默认 https://npmmirror.com/mirrors/electron/
#                        设置为 "off" 可禁用镜像切换

$ErrorActionPreference = 'Stop'

$RequiredNodeMajor = 22
$NodeVersionFull   = 'v22.20.0'
$PnpmVersion       = '10.21.0'
$DefaultElectronMirror        = 'https://npmmirror.com/mirrors/electron/'
$DefaultElectronBuilderMirror = 'https://npmmirror.com/mirrors/electron-builder-binaries/'

function Log([string]$msg)  { Write-Host "[setup] $msg" -ForegroundColor Green }
function Warn([string]$msg) { Write-Host "[setup] $msg" -ForegroundColor Yellow }
function Err([string]$msg)  { Write-Host "[setup] $msg" -ForegroundColor Red; exit 1 }

function Test-Cmd([string]$name) {
	return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

Set-Location (Join-Path $PSScriptRoot '..')

# ---------------------------------------------------------------------------
# 1. Node.js
# ---------------------------------------------------------------------------
function Get-NodeMajor {
	try {
		$v = (node -v) -replace '^v', ''
		return [int]($v.Split('.')[0])
	} catch {
		return 0
	}
}

function Install-Node {
	if (Test-Cmd 'winget') {
		Log '使用 winget 安装 Node.js LTS ...'
		winget install --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements -e
		# 刷新当前会话 PATH
		$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
					[Environment]::GetEnvironmentVariable('Path', 'User')
		return
	}

	# 兜底：下载官方 MSI 静默安装
	$arch = if ([Environment]::Is64BitOperatingSystem) { 'x64' } else { 'x86' }
	$mirror = if ($env:NODEJS_MIRROR) { $env:NODEJS_MIRROR } else { 'https://nodejs.org/dist' }
	$file = "node-$NodeVersionFull-$arch.msi"
	$url = "$mirror/$NodeVersionFull/$file"
	$tmp = Join-Path $env:TEMP $file

	Log "下载 Node.js $NodeVersionFull ($arch) ..."
	Log "来源: $url"
	Invoke-WebRequest -Uri $url -OutFile $tmp -UseBasicParsing

	Log '静默安装 Node.js MSI ...'
	Start-Process msiexec.exe -ArgumentList "/i `"$tmp`" /qn /norestart" -Wait
	Remove-Item $tmp -Force -ErrorAction SilentlyContinue

	$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
				[Environment]::GetEnvironmentVariable('Path', 'User')
}

function Setup-Node {
	if (Test-Cmd 'node') {
		$major = Get-NodeMajor
		if ($major -ge $RequiredNodeMajor) {
			Log "Node.js 已安装: $(node -v)"
			return
		}
		Warn "Node.js 版本过低 ($(node -v))，需要 >= $RequiredNodeMajor，将安装新版本"
	} else {
		Log '未检测到 Node.js，开始自动安装 ...'
	}

	Install-Node

	if (-not (Test-Cmd 'node')) {
		Err "Node.js 安装失败，请手动安装 >= $RequiredNodeMajor 后重试: https://nodejs.org/"
	}
	Log "Node.js 安装完成: $(node -v)"
}

# ---------------------------------------------------------------------------
# 2. pnpm
# ---------------------------------------------------------------------------
function Setup-Pnpm {
	if (Test-Cmd 'pnpm') {
		Log "pnpm 已安装: $(pnpm -v)"
		return
	}

	Log '未检测到 pnpm，开始自动安装 ...'
	if (Test-Cmd 'corepack') {
		Log "使用 corepack 启用 pnpm@$PnpmVersion ..."
		corepack enable
		corepack prepare "pnpm@$PnpmVersion" --activate
	} else {
		Log "使用 npm 全局安装 pnpm@$PnpmVersion ..."
		npm install -g "pnpm@$PnpmVersion"
	}

	if (-not (Test-Cmd 'pnpm')) {
		Err 'pnpm 安装失败，请手动执行: npm install -g pnpm'
	}
	Log "pnpm 安装完成: $(pnpm -v)"
}

# ---------------------------------------------------------------------------
# 3. Electron 镜像配置
# ---------------------------------------------------------------------------
function Setup-ElectronMirror {
	if ($env:ELECTRON_MIRROR -eq 'off') {
		Log '已通过 ELECTRON_MIRROR=off 禁用 Electron 国内镜像'
		return
	}
	if (-not $env:ELECTRON_MIRROR) {
		$env:ELECTRON_MIRROR = $DefaultElectronMirror
	}
	if (-not $env:ELECTRON_BUILDER_BINARIES_MIRROR) {
		$env:ELECTRON_BUILDER_BINARIES_MIRROR = $DefaultElectronBuilderMirror
	}
	Log "Electron 下载镜像: $env:ELECTRON_MIRROR"
	Log "electron-builder 二进制镜像: $env:ELECTRON_BUILDER_BINARIES_MIRROR"
}

# ---------------------------------------------------------------------------
# 4. 依赖安装 + Electron 校验
# ---------------------------------------------------------------------------
function Install-Deps {
	Log '执行 pnpm install ...'
	pnpm install
	if ($LASTEXITCODE -ne 0) { Err 'pnpm install 失败' }
	Verify-Electron
}

# Electron 二进制校验（postinstall 可能因网络问题未下载成功）。
# pnpm workspace 下 electron 通常在子包或 .pnpm 虚拟 store 中，需全局查找。
function Verify-Electron {
	$candidates = @()
	if (Test-Path 'node_modules\electron') { $candidates += 'node_modules\electron' }
	$candidates += Get-ChildItem -Path 'packages\*\node_modules\electron' -ErrorAction SilentlyContinue |
		ForEach-Object { $_.FullName }
	$candidates += Get-ChildItem -Path 'node_modules\.pnpm' -Directory -Filter 'electron@*' -ErrorAction SilentlyContinue |
		ForEach-Object { Join-Path $_.FullName 'node_modules\electron' } |
		Where-Object { Test-Path $_ }

	if ($candidates.Count -eq 0) {
		Err '未在 workspace 中找到 electron 包，请检查 pnpm install 是否成功'
	}

	# 去重（子包 node_modules 中的 electron 是指向 .pnpm 的符号链接）
	$uniq = @{}
	foreach ($dir in $candidates) {
		$real = (Resolve-Path $dir).Path
		$uniq[$real] = $true
	}
	Log "检测到 Electron 包目录: $($uniq.Keys -join ', ')"

	$ok = $false
	foreach ($dir in $uniq.Keys) {
		$pathTxt = Join-Path $dir 'path.txt'
		$bin = $null
		if (Test-Path $pathTxt) {
			$bin = Join-Path $dir ('dist\' + (Get-Content $pathTxt).Trim())
		}
		# path.txt 与真实二进制都必须存在，否则重新下载
		if (-not $bin -or -not (Test-Path $bin)) {
			Warn "Electron 二进制未下载完成: $dir，尝试手动下载 ..."
			Push-Location $dir
			try {
				node install.js
				if ($LASTEXITCODE -ne 0) { Err "Electron 二进制下载失败: $dir，可设置 `$env:ELECTRON_MIRROR 后重试" }
			} finally {
				Pop-Location
			}
		}
		if ((Test-Path $pathTxt) -and (Test-Path (Join-Path $dir ('dist\' + (Get-Content $pathTxt).Trim())))) {
			Log "Electron 已就绪: $dir\dist\$(Get-Content $pathTxt)"
			$ok = $true
		}
	}
	if (-not $ok) { Err 'Electron 二进制校验失败' }

	# 冒烟测试：确认 electron 可执行（与 electron-vite 的解析方式一致）
	$ver = $null
	try { $ver = (pnpm --filter @ocs-desktop/app exec electron --version 2>$null) } catch {}
	if ($LASTEXITCODE -eq 0 -and $ver) {
		Log "Electron 启动校验通过: $ver"
	} else {
		Err 'Electron 启动校验失败，请手动执行排查: pnpm --filter @ocs-desktop/app exec electron --version'
	}
}

Log '=== ocs-desktop 环境初始化 ==='
Setup-Node
Setup-Pnpm
Setup-ElectronMirror
Install-Deps
Log '=== 环境初始化完成 ==='
Log '常用命令: pnpm dev / pnpm build / pnpm test'
