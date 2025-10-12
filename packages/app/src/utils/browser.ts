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
	return fs
		.readdirSync(extensionsFolder)
		.filter((f) => f !== '.DS_Store')
		.filter((f) => !f.endsWith('.zip'))
		.map((file) => path.join(extensionsFolder, file));
}
