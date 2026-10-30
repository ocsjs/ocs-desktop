/**
 * 构建期拓展获取脚本（本地与 CI 同一入口）。
 *
 * 依据 resources/extensions/extensions.lock.json：
 * 1. 缓存命中（zip 存在且 SHA256 匹配钉值）→ 跳过下载，仅重建逐文件清单；
 * 2. 未命中 → 按 sources 顺序下载（支持 crx 格式自动剥头转 zip）；
 * 3. SHA256 比对钉值，不符即失败（供应链投毒在构建侧拦截）；
 * 4. manifest 权限审计：官方包权限必须是 lock 白名单的子集，新增权限构建失败；
 * 5. 生成 <id>.manifest.json（运行时指纹基准，随 zip 一起打入 asar）；
 * 6. 复制许可证文件到 LICENSES/extensions/<id>-LICENSE.txt（GPL 合规）。
 *
 * 用法：
 *   node scripts/fetch-extensions.js     # 或 pnpm fetch:extensions
 *   OCS_SKIP_EXTENSIONS=1                # 跳过（仅限本地快速打包验证，release 禁用）
 *
 * 产物（均不入库，见 .gitignore）：
 *   resources/extensions/<id>.zip
 *   resources/extensions/<id>.manifest.json
 *   LICENSES/extensions/<id>-LICENSE.txt
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const AdmZip = require('adm-zip');

const APP_ROOT = path.join(__dirname, '..');
const EXT_DIR = path.join(APP_ROOT, 'resources', 'extensions');
const LOCK_FILE = path.join(EXT_DIR, 'extensions.lock.json');
const LICENSE_TEMPLATE_DIR = path.join(__dirname, 'licenses');
const LICENSE_OUT_DIR = path.join(APP_ROOT, 'LICENSES', 'extensions');

const TAG = '[fetch-extensions]';

function sha256(buffer) {
	return crypto.createHash('sha256').update(buffer).digest('hex');
}

/** 跟随 302 的下载（Edge/微软分发链均为 302 跳转，谷歌系同理），最多 5 跳 */
function download(url, redirectsLeft = 5) {
	return new Promise((resolve, reject) => {
		const mod = url.startsWith('http:') ? http : https;
		const req = mod.get(url, { headers: { 'user-agent': 'ocs-desktop-build' } }, (res) => {
			if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
				res.resume();
				if (redirectsLeft <= 0) return reject(new Error('重定向次数超限: ' + url));
				return resolve(download(res.headers.location, redirectsLeft - 1));
			}
			if (res.statusCode !== 200) {
				res.resume();
				return reject(new Error(`HTTP ${res.statusCode}: ${url}`));
			}
			const chunks = [];
			res.on('data', (c) => chunks.push(c));
			res.on('end', () => resolve(Buffer.concat(chunks)));
			res.on('error', reject);
		});
		req.setTimeout(300000, () => req.destroy(new Error('下载超时: ' + url)));
		req.on('error', reject);
	});
}

/** 剥离 crx 头，返回 zip 字节（支持 crx2/crx3） */
function stripCrxHeader(buf) {
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

/** 权限审计：官方包声明的权限必须是 lock 白名单的子集 */
function auditPermissions(ext, manifest) {
	const problems = [];
	const mv = manifest.manifest_version || 2;
	if (mv < 3) problems.push(`manifest_version=${mv} 低于 MV3`);
	for (const p of manifest.permissions || []) {
		if (!ext.permissions.includes(p)) problems.push(`新增权限未在白名单: ${p}`);
	}
	for (const p of manifest.host_permissions || []) {
		if (!ext.hostPermissions.includes(p)) problems.push(`新增 host 权限未在白名单: ${p}`);
	}
	if (problems.length) {
		throw new Error(
			`「${ext.name}」权限审计未通过，需人工评审并更新 extensions.lock.json：\n  - ` + problems.join('\n  - ')
		);
	}
}

/** 生成逐文件哈希清单（运行时指纹基准） */
function buildManifest(ext, zipBuf) {
	const zip = new AdmZip(zipBuf);
	const files = {};
	let totalBytes = 0;
	for (const entry of zip.getEntries()) {
		if (entry.isDirectory) continue;
		// 统一为正斜杠相对路径，保证跨平台一致
		const name = entry.entryName.replace(/\\/g, '/');
		const data = entry.getData();
		files[name] = sha256(data);
		totalBytes += data.length;
	}
	const sorted = Object.fromEntries(Object.entries(files).sort(([a], [b]) => (a < b ? -1 : 1)));
	return {
		id: ext.id,
		name: ext.name,
		version: ext.version,
		license: ext.license,
		sourceUrl: ext.sourceUrl,
		homepage: ext.homepage,
		sha256: sha256(zipBuf),
		// 带入运行时：asar 释放失败时远程下载兜底（钉值校验不变）
		format: ext.format,
		sources: ext.sources,
		fileCount: Object.keys(sorted).length,
		totalBytes,
		files: sorted
	};
}

async function fetchOne(ext) {
	const zipPath = path.join(EXT_DIR, ext.id + '.zip');
	const manifestPath = path.join(EXT_DIR, ext.id + '.manifest.json');

	// 缓存命中：zip 存在且哈希匹配钉值 → 仅确保清单存在且含兜底下载源字段
	if (fs.existsSync(zipPath)) {
		const cached = fs.readFileSync(zipPath);
		if (sha256(cached) === ext.sha256) {
			// 旧版清单无 sources/format（远程下载兜底所需），缺失时重建
			const needRebuild = !fs.existsSync(manifestPath) || !JSON.parse(fs.readFileSync(manifestPath, 'utf-8')).sources;
			if (needRebuild) {
				fs.writeFileSync(manifestPath, JSON.stringify(buildManifest(ext, cached), null, 2));
				console.log(`${TAG} ${ext.id}: 缓存命中，已重建逐文件清单`);
			} else {
				console.log(`${TAG} ${ext.id}: 缓存命中，跳过下载`);
			}
			copyLicense(ext);
			return;
		}
		console.warn(`${TAG} ${ext.id}: 缓存哈希与钉值不符，重新下载`);
	}

	let zipBuf = null;
	let lastError;
	for (const url of ext.sources) {
		try {
			console.log(`${TAG} ${ext.id}: 下载 ${url}`);
			let buf = await download(url);
			if (ext.format === 'crx') buf = stripCrxHeader(buf);
			const actual = sha256(buf);
			if (actual !== ext.sha256) {
				throw new Error(`SHA256 校验失败：期望 ${ext.sha256}，实际 ${actual}`);
			}
			zipBuf = buf;
			break;
		} catch (e) {
			lastError = e;
			console.warn(`${TAG} ${ext.id}: 源失败（${e.message}），尝试下一个`);
		}
	}
	if (!zipBuf) {
		throw new Error(`「${ext.name}」所有下载源均失败。最后错误：${lastError && lastError.message}`);
	}

	// 权限审计（读取 zip 内 manifest.json）
	const zip = new AdmZip(zipBuf);
	const manifestEntry = zip.getEntry('manifest.json');
	if (!manifestEntry) throw new Error(`「${ext.name}」zip 内缺少 manifest.json`);
	auditPermissions(ext, JSON.parse(manifestEntry.getData().toString('utf-8')));

	// 原子写入 zip + 清单
	fs.writeFileSync(zipPath + '.tmp', zipBuf);
	fs.renameSync(zipPath + '.tmp', zipPath);
	fs.writeFileSync(manifestPath, JSON.stringify(buildManifest(ext, zipBuf), null, 2));
	copyLicense(ext);
	console.log(`${TAG} ${ext.id}: v${ext.version} 获取完成（${(zipBuf.length / 1024 / 1024).toFixed(2)}MB）`);
}

function copyLicense(ext) {
	const template = path.join(LICENSE_TEMPLATE_DIR, ext.license + '.txt');
	if (!fs.existsSync(template)) {
		throw new Error(`缺少许可证模板 scripts/licenses/${ext.license}.txt`);
	}
	fs.mkdirSync(LICENSE_OUT_DIR, { recursive: true });
	fs.copyFileSync(template, path.join(LICENSE_OUT_DIR, `${ext.id}-LICENSE.txt`));
}

async function main() {
	if (process.env.OCS_SKIP_EXTENSIONS === '1') {
		console.warn(`${TAG} OCS_SKIP_EXTENSIONS=1，跳过拓展获取（仅限本地验证，release 禁用）`);
		return;
	}
	const lock = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf-8'));
	for (const ext of lock.extensions) {
		await fetchOne(ext);
	}
	console.log(`${TAG} 全部内置拓展就绪（${lock.extensions.map((e) => `${e.id}@${e.version}`).join(', ')}）`);
}

if (require.main === module) {
	main().catch((e) => {
		console.error(`${TAG} 失败:`, e.message);
		process.exit(1);
	});
}

module.exports = { main };
