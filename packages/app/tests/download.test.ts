import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { AddressInfo } from 'net';
import { downloadFile } from '../src/utils/download';

// ── 统一下载器（utils/download.ts）测试 ──
// 覆盖：分块并发完整性、块内断线重试续传、跨调用断点续传（旁车元数据）、
// 服务器不支持 Range 时的单流回退、etag 变化放弃续传。

// vitest 会将 vi.mock 提升至模块顶部，先于上方静态 import 生效
vi.mock('electron', () => ({
	app: { getPath: () => os.tmpdir() },
	dialog: {},
	BrowserWindow: class {}
}));

/** 确定性伪随机内容（可逐字节校验） */
function makeSource(size: number): Buffer {
	const buf = Buffer.alloc(size);
	for (let i = 0; i < size; i++) buf[i] = (i * 31) % 251;
	return buf;
}

const SOURCE = makeSource(10 * 1024 * 1024 + 12345); // 10MB+ 不规则尺寸

/** 可变服务器行为配置（请求时读取，各用例 beforeEach 重置） */
const serverBehavior = {
	range: true,
	/** 每连接最多发送字节数，超出后断开（模拟网络中断） */
	maxBytesPerConn: undefined as number | undefined
};
/** 收到的 Range 请求起始偏移列表 */
let rangeStarts: number[] = [];

let server: http.Server;
let baseUrl = '';
let workDir = '';

beforeAll(async () => {
	server = http.createServer((req, res) => {
		const range = serverBehavior.range && req.headers.range ? /bytes=(\d+)-(\d*)/.exec(req.headers.range) : null;
		let start = 0;
		let end = SOURCE.length - 1;
		if (range) {
			start = Number(range[1]);
			if (range[2]) end = Math.min(Number(range[2]), end);
			rangeStarts.push(start);
			res.writeHead(206, {
				'content-range': `bytes ${start}-${end}/${SOURCE.length}`,
				'content-length': end - start + 1,
				etag: '"v1"'
			});
		} else {
			res.writeHead(200, { 'content-length': SOURCE.length, etag: '"v1"' });
		}
		let body = SOURCE.subarray(start, end + 1);
		if (serverBehavior.maxBytesPerConn) body = body.subarray(0, serverBehavior.maxBytesPerConn);
		res.write(body, () => {
			if (serverBehavior.maxBytesPerConn) {
				// 模拟网络中断：发送部分数据后直接断开
				req.socket.destroy();
			} else {
				res.end();
			}
		});
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());
beforeEach(() => {
	workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocs-download-test-'));
	rangeStarts = [];
	serverBehavior.range = true;
	serverBehavior.maxBytesPerConn = undefined;
});
afterEach(() => fs.rmSync(workDir, { recursive: true, force: true }));

describe('统一下载器', () => {
	it('分块并发下载大文件，内容完整一致', async () => {
		const dest = path.join(workDir, 'out.bin');
		const rates: number[] = [];
		await downloadFile(baseUrl + '/file', dest, {
			chunkSize: 1024 * 1024,
			onProgress: (rate) => rates.push(rate)
		});
		expect(fs.readFileSync(dest).equals(SOURCE)).toBe(true);
		// 旁车元数据已清理
		expect(fs.existsSync(dest + '.ocsdl.json')).toBe(false);
		// 进度单调上升且最终 100
		expect(rates[rates.length - 1]).toBe(100);
		expect(rates.every((r, i) => i === 0 || r >= rates[i - 1])).toBe(true);
		// 确实走了分块（多个 Range 请求）
		expect(rangeStarts.length).toBeGreaterThan(3);
	});

	it('连接中断时块内续传重试，最终完整下载', async () => {
		serverBehavior.maxBytesPerConn = 512 * 1024; // 每连接最多传 512KB 后断开
		const dest = path.join(workDir, 'out.bin');
		await downloadFile(baseUrl + '/file', dest, { chunkSize: 1024 * 1024, retries: 30 });
		expect(fs.readFileSync(dest).equals(SOURCE)).toBe(true);
	});

	it('跨调用断点续传：跳过已完成分块', async () => {
		const dest = path.join(workDir, 'out.bin');
		const chunkSize = 1024 * 1024;
		const chunkCount = Math.ceil(SOURCE.length / chunkSize);
		const doneCount = 4;
		// 预置：文件已预分配且前 doneCount 块数据正确，旁车元数据标记完成
		const handle = fs.openSync(dest, 'w');
		fs.ftruncateSync(handle, SOURCE.length);
		for (let i = 0; i < doneCount; i++) {
			const start = i * chunkSize;
			fs.writeSync(handle, SOURCE, start, Math.min(chunkSize, SOURCE.length - start), start);
		}
		fs.closeSync(handle);
		fs.writeFileSync(
			dest + '.ocsdl.json',
			JSON.stringify({ url: baseUrl + '/file', size: SOURCE.length, etag: '"v1"', chunkSize, done: [0, 1, 2, 3] })
		);

		await downloadFile(baseUrl + '/file', dest, { chunkSize });
		expect(fs.readFileSync(dest).equals(SOURCE)).toBe(true);
		// 探测请求（bytes=0-0，start=0）之外，不应再请求已完成块的起始偏移
		const fetchedStarts = rangeStarts.filter((s) => s !== 0);
		expect(fetchedStarts.every((s) => s >= doneCount * chunkSize)).toBe(true);
		// 覆盖了最后一个块
		expect(fetchedStarts).toContain((chunkCount - 1) * chunkSize);
	});

	it('服务器不支持 Range 时回退单流下载', async () => {
		serverBehavior.range = false;
		const dest = path.join(workDir, 'out.bin');
		await downloadFile(baseUrl + '/file', dest);
		expect(fs.readFileSync(dest).equals(SOURCE)).toBe(true);
	});

	it('资源版本（etag）变化时放弃续传，全量重下', async () => {
		const dest = path.join(workDir, 'out.bin');
		// 预置过期元数据（etag 不匹配）
		fs.writeFileSync(dest, Buffer.alloc(SOURCE.length));
		fs.writeFileSync(
			dest + '.ocsdl.json',
			JSON.stringify({
				url: baseUrl + '/file',
				size: SOURCE.length,
				etag: '"old"',
				chunkSize: 1024 * 1024,
				done: [0, 1]
			})
		);
		await downloadFile(baseUrl + '/file', dest, { chunkSize: 1024 * 1024 });
		expect(fs.readFileSync(dest).equals(SOURCE)).toBe(true);
	});
});
