import fs from 'fs';
import path from 'path';
/**
 * 获取浏览器主版本号
 * @param executablePath 浏览器可执行文件路径
 */
export function getBrowserMajorVersion(executablePath: string) {
	if (fs.existsSync(executablePath) === false) return;
	if (process.platform === 'darwin') {
		// 内置浏览器的版本查找方法
		const versionsFolder = path.join(
			path.dirname(executablePath),
			'..',
			'./Frameworks/Google Chrome for Testing Framework.framework/Versions/'
		);
		const exists = fs.existsSync(versionsFolder);
		if (exists === false) return;
		const versions = fs
			.readdirSync(versionsFolder)
			.filter((f) => f !== '.DS_Store' && fs.statSync(path.join(versionsFolder, f)).isDirectory())
			.filter((f) => f.split('.').length > 1);

		if (versions.length === 0) return;
		const version = versions
			.map((v) => {
				const major = parseInt(v.split('.')[0]);
				if (isNaN(major)) return 0;
				return major;
			})
			.sort((a, b) => b - a)[0];
		if (version === 0) return;
		return version;
	}

	// 普通浏览器的版本查找方法
	let manifest = fs.readdirSync(path.dirname(executablePath)).find((f) => {
		const file = path.join(path.dirname(executablePath), f);
		return fs.statSync(file).isDirectory() && fs.readdirSync(file).some((f) => f.endsWith('.manifest'));
	});
	if (!manifest) {
		// 内置浏览器的版本查找方法
		manifest = fs.readdirSync(path.dirname(executablePath)).find((f) => f.endsWith('.manifest'));
	}
	if (manifest && manifest.split('.').length > 1) {
		return parseInt(manifest.split('.')[0]);
	}
}

export function getExtensionPaths(extensionsFolder: string) {
	return (
		fs
			.readdirSync(extensionsFolder)
			.filter((f) => f !== '.DS_Store')
			.filter((f) => !f.endsWith('.zip'))
			.map((file) => path.join(extensionsFolder, file))
			// 只保留真正的 Chrome 扩展（目录且含 manifest.json），跳过 OCR 等非扩展文件夹
			.filter((p) => fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'manifest.json')))
	);
}

/** 内容一致则跳过写入，避免扩展文件变动触发 Chrome 扩展重载 */
function writeIfChanged(file: string, content: string) {
	if (fs.existsSync(file) && fs.readFileSync(file, 'utf-8') === content) return;
	fs.writeFileSync(file, content, 'utf-8');
}

/**
 * 生成（或复用）浏览器专属的导航页扩展：
 * 通过 chrome_url_overrides.newtab 将「新建标签页」替换为本地导航页（携带 uid）。
 * 扩展页以整页 iframe 嵌入导航页：标签页 URL 停留在扩展页（Chrome 视其为新标签页，
 * 地址栏显示为空，类似 Edge 新标签页），iframe 内部仍为 localhost 源，
 * localStorage / 接口请求等数据流与直接访问完全一致。
 * 扩展按浏览器独立生成（uid 固定），内容对同一浏览器恒定，多浏览器并发互不干扰。
 * @param dir 扩展目录（建议位于该浏览器专属缓存目录下）
 * @returns 扩展目录路径
 */
export function ensureNewTabExtension(dir: string, opts: { uid: string; port: number }): string {
	const targetUrl = `http://localhost:${opts.port}/index.html#/bookmarks?uid=${encodeURIComponent(opts.uid)}`;

	// OCS 图标：复制应用图标作为扩展图标，与中文名配合，
	// 便于用户在 Chrome「新标签页被修改」提示中确认该扩展为 OCS 官方程序而非恶意程序
	const iconSource = path.resolve('./public/favicon.png');
	const hasIcon = fs.existsSync(iconSource);

	const manifest = JSON.stringify(
		{
			manifest_version: 3,
			name: 'OCS 快捷导航页',
			version: '1.0.0',
			description: 'OCS 网课助手官方拓展：将新建标签页显示为 OCS 快捷导航页',
			chrome_url_overrides: { newtab: 'newtab.html' },
			...(hasIcon ? { icons: { 16: 'icon.png', 48: 'icon.png', 128: 'icon.png' } } : {})
		},
		null,
		'\t'
	);

	// 整页 iframe 嵌入导航页，标签页地址栏保持 NTP 空白状态
	const html = `<!DOCTYPE html>
<html lang="zh-CN">
	<head>
		<meta charset="UTF-8" />
		<title>OCS 快捷导航页</title>
		<style>
			html,
			body {
				margin: 0;
				padding: 0;
				height: 100%;
				overflow: hidden;
			}
			iframe {
				position: fixed;
				inset: 0;
				width: 100%;
				height: 100%;
				border: 0;
			}
		</style>
	</head>
	<body>
		<iframe src="${targetUrl}"></iframe>
	</body>
</html>
`;

	fs.mkdirSync(dir, { recursive: true });
	writeIfChanged(path.join(dir, 'manifest.json'), manifest);
	writeIfChanged(path.join(dir, 'newtab.html'), html);
	if (hasIcon) {
		// 图标为二进制文件，按内容比对后复制，避免重复写入触发扩展重载
		const iconData = fs.readFileSync(iconSource);
		const iconTarget = path.join(dir, 'icon.png');
		if (!fs.existsSync(iconTarget) || !fs.readFileSync(iconTarget).equals(iconData)) {
			fs.writeFileSync(iconTarget, iconData);
		}
	}
	return dir;
}
