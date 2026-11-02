/**
 * CRX 工具（无 Electron 依赖：bundled 拓展兜底下载与 worker 拓展安装代理共用）。
 * --load-extension 仅支持已解压的拓展目录（须含 manifest.json），不支持 .crx 文件，
 * 故 CRX 需剥头（CRX2/CRX3 = 签名头 + ZIP）后按 zip 解压使用。
 */

/** 剥离 crx 头，返回 zip 字节（支持 crx2/crx3） */
export function stripCrxHeader(buf: Buffer): Buffer {
	if (buf.toString('ascii', 0, 4) !== 'Cr24') throw new Error('不是有效的 CRX 文件（魔数不符）');
	const version = buf.readUInt32LE(4);
	if (version === 3) {
		const headerSize = buf.readUInt32LE(8);
		return buf.subarray(12 + headerSize);
	}
	if (version === 2) {
		const pubkeyLen = buf.readUInt32LE(8);
		const sigLen = buf.readUInt32LE(12);
		return buf.subarray(16 + pubkeyLen + sigLen);
	}
	throw new Error('不支持的 CRX 版本: ' + version);
}
