const { series, src, dest } = require('gulp');
const { execOut } = require('./utils');
const zip = require('gulp-zip');
const fs = require('fs');
const path = require('path');

// 平台映射：@puppeteer/browsers 支持的平台标识
const PLATFORM_MAP = {
	'win-x64': 'win64',
	'mac-x64': 'mac',
	'mac-arm64': 'mac_arm',
	'linux-x64': 'linux'
};

// 137 版本后谷歌禁止使用命令行加载插件，目前只能内置Chrome for Test测试浏览器，并且进行严格版本控制，手动更新
function downloadChrome() {
	const platform = process.env.PLATFORM || 'win';
	const arch = process.env.ARCH || 'x64';
	const targetPlatform = `${platform}-${arch}`;

	const browserPlatform = PLATFORM_MAP[targetPlatform];

	if (!browserPlatform) {
		throw new Error(`Chrome for Testing 不支持平台: ${targetPlatform}`);
	}

	console.log(`目标平台: ${targetPlatform}`);
	console.log(`Chrome 平台参数: ${browserPlatform}`);

	return execOut(
		`npx @puppeteer/browsers install chrome@137.0.7151.55 --platform ${browserPlatform} --path ../.chrome-temp`
	);
}

// 验证 Chrome 架构
function verifyChromeArchitecture() {
	const platform = process.env.PLATFORM || 'win';
	const arch = process.env.ARCH || 'x64';
	const targetPlatform = `${platform}-${arch}`;
	const expectedBrowserPlatform = PLATFORM_MAP[targetPlatform];

	if (!expectedBrowserPlatform) {
		throw new Error(`不支持的平台: ${targetPlatform}`);
	}

	const chromeDir = path.resolve(__dirname, '../.chrome-temp/chrome');

	if (!fs.existsSync(chromeDir)) {
		throw new Error(`Chrome 目录不存在: ${chromeDir}`);
	}

	// 检测实际下载的 Chrome 平台
	const actualPlatform = detectChromePlatform(chromeDir);

	console.log(`目标平台: ${targetPlatform}`);
	console.log(`期望 Chrome 平台: ${expectedBrowserPlatform}`);
	console.log(`实际 Chrome 平台: ${actualPlatform}`);

	// 平台名称映射（检测值 -> 期望值）
	const platformAliasMap = {
		'mac': 'mac',      // mac-x64 下载的目录名是 mac
		'mac_arm': 'mac_arm',
		'win64': 'win64',
		'linux': 'linux'
	};

	const normalizedActual = platformAliasMap[actualPlatform] || actualPlatform;

	if (normalizedActual !== expectedBrowserPlatform) {
		throw new Error(
			`Chrome 架构不匹配! 期望: ${expectedBrowserPlatform}, 实际: ${actualPlatform}`
		);
	}

	console.log('✅ Chrome 架构验证通过');
	return Promise.resolve();
}

// 检测 Chrome 平台（通过下载目录名前缀判断）
// 下载目录结构: .chrome-temp/chrome/{platform}-{version}/chrome-{dir}/...
// 例如: .chrome-temp/chrome/linux-137.0.7151.55/chrome-linux64/chrome
function detectChromePlatform(chromeDir) {
	const entries = fs.readdirSync(chromeDir);

	for (const entry of entries) {
		if (entry.startsWith('mac_arm-')) return 'mac_arm';
		if (entry.startsWith('mac-')) return 'mac';
		if (entry.startsWith('win64-') || entry.startsWith('win32-')) return 'win64';
		if (entry.startsWith('linux-')) return 'linux';
	}

	return 'unknown';
}

function pack() {
	const platform = process.env.PLATFORM || 'win';
	const arch = process.env.ARCH || 'x64';
	const targetDir = `../bin/chrome/${platform}-${arch}`;

	console.log(`打包 Chrome 到: ${targetDir}`);

	return src('../.chrome-temp/chrome/**/*')
		.pipe(zip('chrome.zip'))
		.pipe(dest(targetDir));
}

exports.default = series(downloadChrome, verifyChromeArchitecture, pack);