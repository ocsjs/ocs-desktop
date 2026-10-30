/**
 * 拓展目录完整性校验（纯函数，无 electron 依赖，可单测）。
 * 校验基准为构建期生成的官方逐文件哈希清单（BundledExtensionManifest，随 zip 打入 asar）。
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/** 构建期生成的逐文件哈希清单（结构同 bundled.ts 中的 BundledExtensionManifest） */
export interface ExtensionFileManifest {
	fileCount: number;
	totalBytes: number;
	/** 相对路径（正斜杠）→ 文件内容 SHA256 */
	files: Record<string, string>;
}

function sha256File(file: string) {
	return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** 快检：文件数 + 总字节比对官方清单（不读取文件内容，毫秒级）；多余文件同样判负 */
export function quickVerifyExtension(dir: string, manifest: ExtensionFileManifest): boolean {
	let count = 0;
	let bytes = 0;
	const walk = (current: string): boolean => {
		for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
			const p = path.join(current, entry.name);
			if (entry.isDirectory()) {
				if (!walk(p)) return false;
			} else if (entry.isFile()) {
				count++;
				bytes += fs.statSync(p).size;
				// 提前退出：数量/体积已超过官方清单即判定异常
				if (count > manifest.fileCount || bytes > manifest.totalBytes) return false;
			}
		}
		return true;
	};
	if (!fs.existsSync(dir)) return false;
	if (!walk(dir)) return false;
	return count === manifest.fileCount && bytes === manifest.totalBytes;
}

/** 全量校验：按官方清单逐文件重算 SHA256（快检失败后的精确判定） */
export function fullVerifyExtension(dir: string, manifest: ExtensionFileManifest): boolean {
	if (!quickVerifyExtension(dir, manifest)) return false;
	for (const [rel, expected] of Object.entries(manifest.files)) {
		const file = path.join(dir, ...rel.split('/'));
		if (!fs.existsSync(file)) return false;
		if (sha256File(file) !== expected) return false;
	}
	return true;
}
