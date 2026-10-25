import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import AdmZip from 'adm-zip';
import { unzip } from '../src/utils';

// ── 统一解压管线（utils.unzip）测试 ──
// 覆盖主流解压流程要点：预检（魔数/存在性）、暂存目录隔离（失败不污染目标）、
// __MACOSX 垃圾剥离、原子换入、unix 属性还原（符号链接/执行位，win32 跳过）。

// vitest 会将 vi.mock 提升至模块顶部，先于上方静态 import 生效
vi.mock('electron', () => ({
	app: { getPath: () => os.tmpdir() },
	dialog: {},
	BrowserWindow: class {}
}));

let workDir = '';

function freshWorkDir() {
	workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocs-unzip-test-'));
	return workDir;
}

/** 用 adm-zip 构建测试 zip（attr 为 unix 权限位，如 0o755） */
function buildZip(entries: { name: string; content: string | Buffer; attr?: number }[], zipPath: string) {
	const zip = new AdmZip();
	for (const e of entries) {
		zip.addFile(e.name, Buffer.isBuffer(e.content) ? e.content : Buffer.from(e.content), '', e.attr);
	}
	zip.writeZip(zipPath);
	return zipPath;
}

/**
 * 补丁 zip 中央目录中指定条目的 unix mode（externalFileAttributes 高 16 位）。
 *
 * adm-zip 的 attr 参数只接受权限位（0xfff 掩码），文件类型被强制为 S_IFREG，
 * 无法构造符号链接条目；extract-zip 依据中央目录的 mode 判定软链（S_IFLNK），
 * 因此测试在 zip 构建后直接补丁中央目录属性字段。
 */
function patchCentralDirectoryMode(zipPath: string, entryName: string, mode: number) {
	const buf = fs.readFileSync(zipPath);
	// 从尾部定位 EOCD（签名 0x06054b50）
	let eocd = -1;
	for (let i = buf.length - 22; i >= 0; i--) {
		if (buf.readUInt32LE(i) === 0x06054b50) {
			eocd = i;
			break;
		}
	}
	if (eocd < 0) throw new Error('非法 zip：未找到 EOCD');
	let offset = buf.readUInt32LE(eocd + 16); // 中央目录起始偏移
	const count = buf.readUInt16LE(eocd + 10);
	for (let i = 0; i < count; i++) {
		if (buf.readUInt32LE(offset) !== 0x02014b50) break; // 中央目录条目签名
		const nameLen = buf.readUInt16LE(offset + 28);
		const extraLen = buf.readUInt16LE(offset + 30);
		const commentLen = buf.readUInt16LE(offset + 32);
		const name = buf.toString('utf8', offset + 46, offset + 46 + nameLen);
		if (name === entryName) {
			buf.writeUInt32LE((mode << 16) >>> 0, offset + 38); // CENATX external attributes
			fs.writeFileSync(zipPath, buf);
			return;
		}
		offset += 46 + nameLen + extraLen + commentLen;
	}
	throw new Error('条目不存在：' + entryName);
}

beforeEach(() => freshWorkDir());
afterEach(() => fs.rmSync(workDir, { recursive: true, force: true }));

describe('unzip 统一解压管线', () => {
	it('正常解压并还原文件内容', async () => {
		const zipPath = buildZip([{ name: 'a/b/hello.txt', content: 'hello ocs' }], path.join(workDir, 'a.zip'));
		const out = path.join(workDir, 'out');
		await unzip(zipPath, out);
		expect(fs.readFileSync(path.join(out, 'a/b/hello.txt'), 'utf-8')).toBe('hello ocs');
	});

	it('剥离 __MACOSX 资源叉目录', async () => {
		const zipPath = buildZip(
			[
				{ name: 'real.txt', content: 'x' },
				{ name: '__MACOSX/._real.txt', content: 'junk' }
			],
			path.join(workDir, 'm.zip')
		);
		const out = path.join(workDir, 'out');
		await unzip(zipPath, out);
		expect(fs.existsSync(path.join(out, 'real.txt'))).toBe(true);
		expect(fs.existsSync(path.join(out, '__MACOSX'))).toBe(false);
	});

	it('拒绝非 zip 文件（魔数校验）', async () => {
		const fake = path.join(workDir, 'fake.zip');
		fs.writeFileSync(fake, 'this is not a zip');
		await expect(unzip(fake, path.join(workDir, 'out'))).rejects.toThrow('不是有效的 ZIP');
	});

	it('拒绝不存在的压缩包', async () => {
		await expect(unzip(path.join(workDir, 'nope.zip'), path.join(workDir, 'out'))).rejects.toThrow('不存在');
	});

	it('失败时不污染已有目标目录（暂存隔离 + 原子换入）', async () => {
		const out = path.join(workDir, 'out');
		fs.mkdirSync(out, { recursive: true });
		fs.writeFileSync(path.join(out, 'old.txt'), 'keep me');
		const fake = path.join(workDir, 'fake.zip');
		fs.writeFileSync(fake, 'garbage');
		await expect(unzip(fake, out)).rejects.toThrow();
		// 旧版本保持可用
		expect(fs.readFileSync(path.join(out, 'old.txt'), 'utf-8')).toBe('keep me');
		// 暂存目录已清理
		expect(fs.readdirSync(workDir).filter((f) => f.includes('.extracting-'))).toHaveLength(0);
	});

	it('成功时旧目录被整体替换', async () => {
		const out = path.join(workDir, 'out');
		fs.mkdirSync(out, { recursive: true });
		fs.writeFileSync(path.join(out, 'old.txt'), 'old');
		const zipPath = buildZip([{ name: 'new.txt', content: 'new' }], path.join(workDir, 'n.zip'));
		await unzip(zipPath, out);
		expect(fs.existsSync(path.join(out, 'old.txt'))).toBe(false);
		expect(fs.readFileSync(path.join(out, 'new.txt'), 'utf-8')).toBe('new');
	});

	// Windows 创建符号链接需提权/开发者模式（extract-zip 会抛错），仅在类 unix 下验证还原
	it.skipIf(process.platform === 'win32')('还原 zip 内的符号链接与执行位', async () => {
		const zipPath = buildZip(
			[
				{ name: 'target.txt', content: 'real content' },
				// 符号链接条目：内容为链接目标路径（adm-zip 无法造软链类型，下方补丁中央目录标记 S_IFLNK）
				{ name: 'link.txt', content: 'target.txt' },
				// 可执行文件：权限位 0755（adm-zip attr 接受权限位）
				{ name: 'run.sh', content: '#!/bin/sh\necho hi\n', attr: 0o755 }
			],
			path.join(workDir, 'attr.zip')
		);
		// 把 link.txt 标记为符号链接（S_IFLNK | 0777）
		patchCentralDirectoryMode(zipPath, 'link.txt', 0o120777);
		const out = path.join(workDir, 'out');
		await unzip(zipPath, out);

		const linkStat = fs.lstatSync(path.join(out, 'link.txt'));
		expect(linkStat.isSymbolicLink()).toBe(true);
		expect(fs.readlinkSync(path.join(out, 'link.txt'))).toBe('target.txt');
		expect(fs.statSync(path.join(out, 'run.sh')).mode & 0o111).toBeTruthy();
	});
});
