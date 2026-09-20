/**
 * OCS Desktop 强制升级引导器（upgrader-stub）
 *
 * 背景：旧版本客户端的自动更新为“下载 zip -> 删除 resources/app -> 解压覆盖 -> 重启”，
 * 只能更新 JS 代码，无法升级 exe / 运行时 / 原生模块。自 3.0.0 起更新机制迁移至
 * electron-updater（latest.yml + NSIS 安装包），旧客户端一律由本引导器接管升级。
 *
 * 工作方式：
 * 1. 发布方将本目录打成的 upgrader.zip 上传 CDN，并把 ocs-app-infos.json 顶部
 *    引导条目的 url 指向该 zip（一次性配置，之后 infos.json 无需再维护）；
 * 2. 旧客户端走旧逻辑下载并替换 resources/app，重启后运行本程序；
 * 3. 本程序拉取 electron-updater 更新目录的 latest.yml 得到最新版本号与安装包名，
 *    下载最新安装包并引导覆盖安装（不依赖 infos.json 的 app_downloads 维护）。
 *
 * 兼容性要求：仅使用 Node 内置模块与 Electron 早期即稳定的 API（app/dialog/shell），
 * 不得引入任何第三方依赖与原生模块（如 keytar），以保证在任意旧版 Electron 运行时上可执行。
 */
const { app, dialog, shell } = require('electron');
const { spawn } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');

// 更新源目录：与 packages/common/src/constants.ts 的 OCS_UPDATER.feedUrl 保持一致（本文件为独立运行时，无法 import）
const UPDATER_BASE_URL = 'https://cdn.ocsjs.com/app/electron-updater/';
const FALLBACK_DOWNLOAD_PAGE = 'https://docs.ocsjs.com';

function fetchText(url) {
	return new Promise((resolve, reject) => {
		https
			.get(url, (res) => {
				if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
					res.resume();
					resolve(fetchText(res.headers.location));
					return;
				}
				let data = '';
				res.on('data', (chunk) => (data += chunk));
				res.on('end', () => resolve(data));
				res.on('error', reject);
			})
			.on('error', reject);
	});
}

function download(url, dest) {
	return new Promise((resolve, reject) => {
		https
			.get(url, (res) => {
				if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
					res.resume();
					resolve(download(res.headers.location, dest));
					return;
				}
				const file = fs.createWriteStream(dest);
				res.pipe(file);
				file.on('finish', () => file.close(() => resolve(dest)));
				file.on('error', reject);
			})
			.on('error', reject);
	});
}

function showMessage(options) {
	return dialog.showMessageBox(
		Object.assign({ title: 'OCS更新程序', type: 'warning', noLink: true, buttons: ['确定'] }, options)
	);
}

app.whenReady().then(async () => {
	try {
		// 从 electron-updater 更新目录的 latest.yml 读取最新版本号与安装包文件名
		const yml = await fetchText(UPDATER_BASE_URL + 'latest.yml?t=' + Date.now());
		const version = (yml.match(/^version:\s*(\S+)/m) || [])[1];
		const file = (yml.match(/^\s*url:\s*(\S+)/m) || [])[1];
		if (!version || !file) {
			throw new Error('latest.yml 解析失败（缺少 version/url 字段）');
		}

		if (process.platform === 'win32') {
			await showMessage({
				message:
					'当前版本过旧，已停止对该版本的自动更新支持。\n点击确定后将自动下载最新安装包（' +
					version +
					'），请稍候（期间本窗口无响应属正常）。'
			});
			const dest = path.join(app.getPath('temp'), file);
			await download(UPDATER_BASE_URL + file, dest);
			await showMessage({
				message: '最新安装包下载完成，点击确定开始安装。\n安装为覆盖安装，你的浏览器与配置数据不受影响。'
			});
			spawn(dest, [], { detached: true, stdio: 'ignore' }).unref();
			app.quit();
		} else {
			await showMessage({
				message: '当前版本过旧，已停止对该版本的自动更新支持。\n点击确定将打开下载页，请手动下载最新安装包覆盖安装。'
			});
			const dmg = 'ocs-' + version + '-setup-mac-x64.dmg';
			shell.openExternal(process.platform === 'darwin' ? UPDATER_BASE_URL + dmg : FALLBACK_DOWNLOAD_PAGE);
			app.quit();
		}
	} catch (err) {
		await showMessage({
			type: 'error',
			message: '自动升级引导失败：' + err + '\n点击确定将打开下载页，请手动下载最新版本覆盖安装。'
		});
		shell.openExternal(FALLBACK_DOWNLOAD_PAGE);
		app.quit();
	}
});
