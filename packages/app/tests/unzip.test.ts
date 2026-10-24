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

/** 用 adm-zip 构建测试 zip（attr 为 unix mode << 16，用于软链/执行位用例） */
function buildZip(entries: { name: string; content: string | Buffer; attr?: number }[], zipPath: string) {
	const zip = new AdmZip();
	for (const e of entries) {
		zip.addFile(e.name, Buffer.isBuffer(e.content) ? e.content : Buffer.from(e.content), '', e.attr);
	}
	zip.writeZip(zipPath);
	return zipPath;
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

	// Windows 创建符号链接需提权/开发者模式（代码保留文本文件兜底），仅在类 unix 下验证还原
	it.skipIf(process.platform === 'win32')('还原 zip 内的符号链接与执行位', async () => {
		const zipPath = buildZip(
			[
				{ name: 'target.txt', content: 'real content' },
				// 符号链接条目：内容为链接目标路径，unix 类型位 S_IFLNK
				{ name: 'link.txt', content: 'target.txt', attr: (0o120777 << 16) >>> 0 },
				// 可执行文件：0755
				{ name: 'run.sh', content: '#!/bin/sh\necho hi\n', attr: (0o100755 << 16) >>> 0 }
			],
			path.join(workDir, 'attr.zip')
		);
		const out = path.join(workDir, 'out');
		await unzip(zipPath, out);

		const linkStat = fs.lstatSync(path.join(out, 'link.txt'));
		expect(linkStat.isSymbolicLink()).toBe(true);
		expect(fs.readlinkSync(path.join(out, 'link.txt'))).toBe('target.txt');
		expect(fs.statSync(path.join(out, 'run.sh')).mode & 0o111).toBeTruthy();
	});
});
