import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import AdmZip from 'adm-zip';
import { quickVerifyExtension, fullVerifyExtension } from '../src/extensions/verify';

/**
 * 内置拓展完整性校验（verify.ts）测试。
 * 使用 resources/extensions 下构建期生成的真实 zip + manifest（需先运行 pnpm fetch:extensions）；
 * 不存在时跳过（CI 未执行获取脚本的环境）。
 */
const EXT_DIR = path.join(__dirname, '..', 'resources', 'extensions');
const hasFixtures = fs
	.readdirSync(EXT_DIR, { withFileTypes: true })
	.some((f) => f.isFile() && f.name.endsWith('.manifest.json'));

let workDir: string;
beforeEach(() => {
	workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocs-ext-verify-'));
});
afterEach(() => fs.rmSync(workDir, { recursive: true, force: true }));

function extractFixture(id: string) {
	const manifest = JSON.parse(fs.readFileSync(path.join(EXT_DIR, `${id}.manifest.json`), 'utf-8'));
	const dir = path.join(workDir, id);
	new AdmZip(path.join(EXT_DIR, `${id}.zip`)).extractAllTo(dir, true);
	return { manifest, dir };
}

(hasFixtures ? describe : describe.skip)('内置拓展完整性校验', () => {
	it('官方清单校验原始释放目录：通过', () => {
		const { manifest, dir } = extractFixture('scriptcat');
		expect(quickVerifyExtension(dir, manifest)).toBe(true);
		expect(fullVerifyExtension(dir, manifest)).toBe(true);
	});

	it('篡改单个文件内容：全量校验拒绝', () => {
		const { manifest, dir } = extractFixture('scriptcat');
		const target = path.join(dir, 'manifest.json');
		fs.writeFileSync(target, fs.readFileSync(target).toString() + ' ');
		expect(fullVerifyExtension(dir, manifest)).toBe(false);
	});

	it('删除文件：快检即拒绝', () => {
		const { manifest, dir } = extractFixture('scriptcat');
		fs.rmSync(path.join(dir, 'manifest.json'));
		expect(quickVerifyExtension(dir, manifest)).toBe(false);
		expect(fullVerifyExtension(dir, manifest)).toBe(false);
	});

	it('植入多余文件：快检即拒绝', () => {
		const { manifest, dir } = extractFixture('tampermonkey');
		fs.writeFileSync(path.join(dir, 'evil.js'), 'malicious');
		expect(quickVerifyExtension(dir, manifest)).toBe(false);
		expect(fullVerifyExtension(dir, manifest)).toBe(false);
	});

	it('同尺寸替换内容（绕过 size 快检）：全量哈希兜底拒绝', () => {
		const { manifest, dir } = extractFixture('tampermonkey');
		const target = path.join(dir, 'manifest.json');
		const content = fs.readFileSync(target, 'utf-8');
		// 替换为等长字符串（数字 5 → 6），size 不变但哈希变化
		const tampered = content.replace(/5/g, '6');
		expect(tampered.length).toBe(content.length);
		fs.writeFileSync(target, tampered);
		expect(quickVerifyExtension(dir, manifest)).toBe(true); // 快检被绕过（预期行为）
		expect(fullVerifyExtension(dir, manifest)).toBe(false); // 全量哈希兜底
	});
});
