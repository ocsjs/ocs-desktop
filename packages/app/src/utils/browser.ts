import fs from 'fs';
import path from 'path';

/**
 * 获取浏览器主版本号
 * @param executablePath 浏览器可执行文件路径
 */
export function getBrowserMajorVersion(executablePath: string) {
	if (fs.existsSync(executablePath) === false) return;

	let manifest = fs.readdirSync(path.dirname(executablePath)).find((f) => {
		const file = path.join(path.dirname(executablePath), f);
		return fs.statSync(file).isDirectory() && fs.readdirSync(file).some((f) => f.endsWith('.manifest'));
	});
	if (!manifest) {
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
