import express from 'express';
import { Logger } from '../logger';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { app as electronApp } from 'electron';
import { store } from '../store';
import { DEFAULT_SERVER_PORT } from '@ocs-desktop/common';
import { getDecryptedRenderData } from '../crypto';
import { getCurrentWebContents, getProjectPath, moveWindowToTop } from '../utils';
import { canOCR, det, ocr } from '../utils/ocr';
import { randomUUID, createHash } from 'crypto';
import { getInitStatus } from './init.status';
import { probeNetwork } from './net.status';
const logger = Logger('server');

/** 图标内存缓存（进程内一级缓存） */
const iconCache = new Map<string, { data: Buffer; contentType: string }>();
const ICON_CACHE_MAX = 200;

/** 同一 URL 的并发请求合并（in-flight 去重），避免缓存未命中时同一图标重复打外网 */
const iconInflight = new Map<string, Promise<{ data: Buffer; contentType: string }>>();

/** 图标磁盘缓存目录（userData/icons，应用重启后仍有效） */
const ICON_DISK_DIR = path.join(electronApp.getPath('userData'), 'icons');
/** 正常图标磁盘缓存有效期：7 天 */
const ICON_DISK_TTL = 7 * 24 * 60 * 60 * 1000;
/** 兜底图标磁盘缓存有效期：6 小时（弱网恢复后允许重新尝试获取真实图标） */
const FALLBACK_DISK_TTL = 6 * 60 * 60 * 1000;

interface IconDiskMeta {
	contentType: string;
	/** 是否为兜底图标（短 TTL） */
	fallback: boolean;
	time: number;
}

function iconDiskKey(url: string) {
	return createHash('md5').update(url).digest('hex');
}

/** 读取磁盘缓存的图标，过期/损坏返回 null */
function readDiskIcon(url: string): { data: Buffer; contentType: string } | null {
	try {
		const key = iconDiskKey(url);
		const metaPath = path.join(ICON_DISK_DIR, `${key}.json`);
		const dataPath = path.join(ICON_DISK_DIR, `${key}.bin`);
		if (!fs.existsSync(metaPath) || !fs.existsSync(dataPath)) return null;
		const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as IconDiskMeta;
		const ttl = meta.fallback ? FALLBACK_DISK_TTL : ICON_DISK_TTL;
		if (Date.now() - meta.time > ttl) return null;
		return { data: fs.readFileSync(dataPath), contentType: meta.contentType };
	} catch {
		return null;
	}
}

/** 写入磁盘缓存（静默容错） */
function writeDiskIcon(url: string, result: { data: Buffer; contentType: string }, fallback: boolean) {
	try {
		fs.mkdirSync(ICON_DISK_DIR, { recursive: true });
		const key = iconDiskKey(url);
		const meta: IconDiskMeta = { contentType: result.contentType, fallback, time: Date.now() };
		fs.writeFileSync(path.join(ICON_DISK_DIR, `${key}.json`), JSON.stringify(meta), 'utf-8');
		fs.writeFileSync(path.join(ICON_DISK_DIR, `${key}.bin`), result.data);
	} catch (err) {
		logger.warn('图标磁盘缓存写入失败', err);
	}
}

/** 从 URL 中提取域名 */
function extractDomain(url: string): string | null {
	try {
		return new URL(url).hostname;
	} catch {
		return null;
	}
}

/** 默认网站图标（地球 SVG），所有源都取不到时返回，避免出现空白图标 */
const FALLBACK_ICON = {
	data: Buffer.from(
		`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#86909c" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><line x1="3" y1="12" x2="21" y2="12"/></svg>`,
		'utf8'
	),
	contentType: 'image/svg+xml'
};

/**
 * 校验 buffer 是否为可解析的图片数据。
 * 通过文件头魔数判定常见图片格式，避免把 HTML 404 页等非图片内容当作图标返回。
 */
function isImageBuffer(data: Buffer, contentType: string): boolean {
	if (!data || data.length < 4) return false;

	// PNG: 89 50 4E 47
	if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return true;
	// JPEG: FF D8 FF
	if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return true;
	// GIF: 47 49 46 38 (GIF8)
	if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x38) return true;
	// BMP: 42 4D
	if (data[0] === 0x42 && data[1] === 0x4d) return true;
	// ICO: 00 00 01 00
	if (data[0] === 0x00 && data[1] === 0x00 && data[2] === 0x01 && data[3] === 0x00) return true;
	// WEBP: RIFF....WEBP
	if (
		data.length >= 12 &&
		data[0] === 0x52 &&
		data[1] === 0x49 &&
		data[2] === 0x46 &&
		data[3] === 0x46 &&
		data[8] === 0x57 &&
		data[9] === 0x45 &&
		data[10] === 0x42 &&
		data[11] === 0x50
	) {
		return true;
	}
	// SVG（文本）：以 <?xml 或 <svg 开头，或 content-type 声明为 svg
	const head = data.slice(0, 256).toString('utf8').trimStart().toLowerCase();
	if (head.startsWith('<?xml') || head.startsWith('<svg') || contentType.toLowerCase().includes('svg')) {
		return true;
	}
	// 兜底：content-type 明确是图片
	if (contentType.toLowerCase().startsWith('image/')) return true;
	return false;
}

/** 通用请求头：部分图标服务器会按 UA 重定向或返回非图标内容，统一带浏览器 UA */
const ICON_REQUEST_HEADERS = {
	'User-Agent':
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
	Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
};

/** 请求某个 URL 的图片数据，返回可解析图片或 null */
async function tryFetchImage(url: string): Promise<{ data: Buffer; contentType: string } | null> {
	try {
		const response = await axios.get(url, {
			responseType: 'arraybuffer',
			timeout: 3000,
			// 允许跟随重定向（部分图标地址会 301/302 到真实图片，Google Favicon 也会 302）
			maxRedirects: 5,
			headers: ICON_REQUEST_HEADERS
		});
		const contentType = response.headers['content-type'] || 'image/png';
		return isImageBuffer(response.data, contentType) ? { data: response.data, contentType } : null;
	} catch {
		return null;
	}
}

/**
 * 获取网站图标 — 多源竞速策略：
 * 原始 URL、站点自带 favicon.ico、第三方 favicon 服务、Google Favicon API 全部并行请求，
 * 第一个返回有效图片的源胜出；单请求 3s 超时，整体 4s 预算，超时返回兜底图标。
 * （原串行降级单图标最坏 5 源 × 3s ≈ 15s+，弱网环境下导航页 icons 长时间空白）
 */
async function fetchIcon(iconUrl: string): Promise<{ data: Buffer; contentType: string }> {
	const candidates: string[] = [iconUrl];

	const domain = extractDomain(iconUrl);
	if (domain) {
		// 站点自带 favicon.ico，国内可达性最好
		candidates.push(`https://${domain}/favicon.ico`);
		// 第三方可达的 favicon 服务
		candidates.push(`https://icons.duckduckgo.com/ip3/${domain}.png`);
		candidates.push(`https://api.iowen.cn/favicon/${domain}.png`);
		// Google Favicon（接口会 302 重定向到真实图标，部分地区不可达）
		candidates.push(`https://www.google.com/s2/favicons?domain=${domain}&sz=64`);
	}

	// 竞速：任一源返回有效图片即胜出；全部失败/超时返回 null（手写 any，兼容 ES2020 编译目标）
	const raceAll = new Promise<{ data: Buffer; contentType: string } | null>((resolve) => {
		let settled = false;
		let pending = candidates.length;
		for (const url of candidates) {
			tryFetchImage(url).then((r) => {
				if (settled) return;
				if (r) {
					settled = true;
					resolve(r);
				} else if (--pending === 0) {
					settled = true;
					resolve(null);
				}
			});
		}
	});
	const result = await Promise.race([raceAll, new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000))]);

	return result ?? FALLBACK_ICON;
}

export async function startupServer() {
	const app = express();

	store.set('server', {
		port: DEFAULT_SERVER_PORT,
		authToken: randomUUID().replace(/-/g, '')
	});

	app.use((req, res, next) => {
		res.setHeader('Access-Control-Allow-Origin', req.headers.origin || 'unknown');
		res.setHeader('Access-Control-Allow-Credentials', 'true');
		res.setHeader('Access-Control-Allow-Headers', 'Content-Type, request-id, if-none-match');
		res.setHeader('Access-Control-Allow-Methods', '*');
		if (req.method === 'OPTIONS') {
			res.sendStatus(204);
			return;
		}
		next();
	});
	// 解析 post 数据
	app.use(express.urlencoded({ extended: false, limit: '10mb' }));
	app.use(express.json({ limit: '10mb' }));

	app.get('/state', (req, res) => {
		res.json({
			public: path.join(getProjectPath(), './public'),
			project: getProjectPath()
		});
	});

	/** 应用启动初始化状态（供 loading 闪屏页轮询） */
	app.get('/api/init/status', (req, res) => {
		res.json(getInitStatus());
	});

	app.get('/ocs-global-setting', (req, res) => {
		const render = getDecryptedRenderData(store);
		res.json(render.setting.ocs);
	});

	/** 获取 browser 数据 */
	app.get('/browser', (req, res) => {
		const render = getDecryptedRenderData(store);
		// 如果开启了同步配置，就返回，否则返回空对象
		const data = render?.setting?.ocs?.openSync ? render?.setting?.ocs?.store : {};
		res.json(data);
	});

	app.get('/is-browser-config-sync', (req, res) => {
		const render = getDecryptedRenderData(store);
		res.end(String(render.setting.ocs.openSync));
	});

	/** 脚本操作 */
	app.get('/ocs-script-actions', (req, res) => {
		res.json({ allow: true });
	});

	app.get('/get-actions-key', (req, res) => {
		res.send(store.store.server.authToken);
	});

	/** 获取浏览器信息（供导航页主动获取） */
	app.get('/api/bookmark/browser-info', (req, res) => {
		const uid = req.query.uid as string;
		if (!uid) {
			res.status(400).json({ error: '缺少 uid 参数' });
			return;
		}
		const render = getDecryptedRenderData(store);
		const root = render?.browser?.root;
		if (!root) {
			res.json(null);
			return;
		}
		// 递归查找浏览器
		function findBrowser(children: any): any {
			for (const key in children) {
				if (Object.prototype.hasOwnProperty.call(children, key)) {
					const entity = children[key];
					if (entity.type === 'browser' && entity.uid === uid) {
						return entity;
					} else if (entity.type === 'folder' && entity.children) {
						const found = findBrowser(entity.children);
						if (found) return found;
					}
				}
			}
			return null;
		}
		const browser = findBrowser(root.children || {});
		if (!browser) {
			res.json(null);
			return;
		}
		res.json({
			uid: browser.uid,
			name: browser.name || '',
			notes: browser.notes || '',
			tags: browser.tags || []
		});
	});

	/** 获取导航页设置：搜索引擎开关、快捷平台访问开关、自定义网站列表 */
	app.get('/api/bookmark/page-settings', (req, res) => {
		const render = getDecryptedRenderData(store);
		const bookmarkPage = render?.setting?.browser?.bookmarkPage;
		res.json({
			enableSearch: bookmarkPage?.enableSearch !== false,
			enableQuickAccess: bookmarkPage?.enableQuickAccess !== false,
			customSites: Array.isArray(bookmarkPage?.customSites) ? bookmarkPage.customSites : []
		});
	});

	/** 获取网站图标（内存缓存 → 磁盘缓存 → in-flight 去重 → 多源竞速） */
	app.get('/icon', async (req, res) => {
		const iconUrl = req.query.url as string;
		if (!iconUrl) {
			res.status(400).send('Missing url parameter');
			return;
		}

		const sendIcon = (icon: { data: Buffer; contentType: string }) => {
			res.setHeader('Content-Type', icon.contentType);
			res.setHeader('Cache-Control', 'public, max-age=86400');
			res.send(icon.data);
		};

		// 一级：内存缓存
		const cached = iconCache.get(iconUrl);
		if (cached) {
			sendIcon(cached);
			return;
		}

		// 二级：磁盘缓存（应用重启后仍有效）
		const disk = readDiskIcon(iconUrl);
		if (disk) {
			iconCache.set(iconUrl, disk);
			sendIcon(disk);
			return;
		}

		// 三级：in-flight 去重，同一 URL 并发 miss 只发起一次外网请求；
		// 弱网模式（3s 探测失败）直接返回兜底图标，不再发起竞速请求
		let inflight = iconInflight.get(iconUrl);
		if (!inflight) {
			inflight = (async () => ((await probeNetwork()) ? fetchIcon(iconUrl) : FALLBACK_ICON))().finally(() =>
				iconInflight.delete(iconUrl)
			);
			iconInflight.set(iconUrl, inflight);
		}
		const result = await inflight;

		// 写入内存 + 磁盘缓存（兜底图标也缓存：内存避免重复竞速，磁盘短 TTL 允许弱网恢复后重试）
		if (iconCache.size >= ICON_CACHE_MAX) {
			const firstKey = iconCache.keys().next().value;
			if (firstKey !== undefined) iconCache.delete(firstKey);
		}
		iconCache.set(iconUrl, result);
		writeDiskIcon(iconUrl, result, result === FALLBACK_ICON);

		sendIcon(result);
	});

	/** 请求转发 */
	app.post('/proxy', async (req, res) => {
		const { method, url, data, headers } = req.body || {};
		axios
			.request({
				method,
				url,
				data,
				headers
			})
			.then(({ data }) => {
				res.send(data);
			})
			.catch((err) => {
				res.send(err);
			});
	});

	app.get(/\/ocs-action_.+/, (req, res) => {
		res.send('正在执行脚本 : ' + req.path + ' 请勿操作。');
	});

	// ocr 验证码破解
	app.post('/ocr', async (req, res) => {
		const base64 = req.body.image?.toString();
		const det_target = req.body.det_target?.toString();
		const det_bg = req.body.det_bg?.toString();

		if (canOCR()) {
			try {
				if (base64) {
					res.json({ canOCR: true, code: await ocr(base64) });
				} else if (det_target && det_bg) {
					res.json({ canOCR: true, det: await det(det_target, det_bg) });
				} else {
					res.send({ error: '参数缺失!' });
				}
			} catch (err) {
				// err 可能是 Error / Buffer(stderr) / 字符串，统一转为可读消息，避免客户端收到 [object Object]
				const message = err instanceof Error ? err.message : Buffer.isBuffer(err) ? err.toString('utf-8') : String(err);
				res.json({ canOCR: true, error: message });
			}
		} else {
			res.json({ canOCR: false });
		}
	});

	app.get('/api/bookmark/show-browser-in-app', (req, res) => {
		moveWindowToTop();
		// 显示浏览器文件
		getCurrentWebContents().send('show-browser-in-app', req.query.uid);
	});

	// 提供本地用户脚本（扩展只能拦截 http/https 请求安装脚本）
	app.get('/api/local-userscript', (req, res) => {
		const filePath = req.query.path as string;
		if (filePath && fs.existsSync(filePath)) {
			res.setHeader('Content-Type', 'application/javascript');
			res.sendFile(path.resolve(filePath));
		} else {
			res.status(404).send('File not found');
		}
	});

	// 静态资源：
	// 生产模式 —— 渲染产物经 electron-vite 输出到 out/renderer，直接静态托管；
	// 开发模式 —— out/renderer 不存在（首次运行尤其如此），渲染页面由 vite dev server 托管，
	//   将页面/静态请求代理过去，保证主窗口与启动的浏览器（导航页等）都能直接访问最新页面。
	const devRendererUrl = process.env.ELECTRON_RENDERER_URL;
	if (devRendererUrl) {
		const devOrigin = devRendererUrl.replace(/\/+$/, '');
		const devHost = new URL(devOrigin).host;
		app.use((req, res, next) => {
			if (req.method !== 'GET' && req.method !== 'HEAD') {
				next();
				return;
			}
			axios
				.get(devOrigin + req.originalUrl, {
					responseType: 'stream',
					timeout: 10000,
					maxRedirects: 0,
					validateStatus: () => true,
					headers: {
						host: devHost,
						accept: req.headers.accept || '*/*',
						// 让上游返回未压缩内容，避免压缩流与响应头转发不一致
						'accept-encoding': 'identity',
						// 保留条件请求头，维持 vite 的 304 缓存行为
						...(typeof req.headers['if-none-match'] === 'string'
							? { 'if-none-match': req.headers['if-none-match'] }
							: {}),
						...(typeof req.headers['if-modified-since'] === 'string'
							? { 'if-modified-since': req.headers['if-modified-since'] }
							: {})
					}
				})
				.then((upstream) => {
					res.status(upstream.status);
					for (const [key, value] of Object.entries(upstream.headers)) {
						// 逐跳头与流式传输冲突，交由 express 自行处理
						if (['transfer-encoding', 'connection', 'content-length'].includes(key)) continue;
						if (typeof value === 'string') res.setHeader(key, value);
					}
					upstream.data.pipe(res);
				})
				.catch(() => {
					res.status(502).send(`Vite dev server 未就绪，请稍后刷新（${devOrigin}）`);
				});
		});
	} else {
		app.use(express.static(path.join(getProjectPath(), './out/renderer')));
	}

	return new Promise<void>((resolve, reject) => {
		const server = app.listen(store.store.server.port, () => {
			const address = server.address();
			if (address && typeof address === 'object') {
				// 存储本次服务的端口
				logger.info(`OCS服务启动成功 => ${address.port}`);
			}
			resolve();
		});

		// eslint-disable-next-line no-undef
		server.on('error', (err: NodeJS.ErrnoException) => {
			if (err.code === 'EADDRINUSE') {
				logger.error(`端口 ${store.store.server.port} 已被占用，服务启动失败`);
			} else {
				logger.error(`OCS服务启动失败: ${err.message}`);
			}
			reject(err);
		});
	});
}
