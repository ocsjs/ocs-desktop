import express from 'express';
import { Logger } from '../logger';
import path from 'path';
import axios from 'axios';
import { store } from '../store';
import { getCurrentWebContents, getProjectPath, moveWindowToTop } from '../utils';
import { canOCR, det, ocr } from '../utils/ocr';
import { randomUUID } from 'crypto';
const logger = Logger('server');

export async function startupServer() {
	const app = express();

	store.set('server', {
		port: 15319,
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

	app.get('/ocs-global-setting', (req, res) => {
		res.json(store.store.render.setting.ocs);
	});

	/** 获取 browser 数据 */
	app.get('/browser', (req, res) => {
		// 如果开启了同步配置，就返回，否则返回空对象
		res.json(store?.store?.render?.setting?.ocs?.openSync ? store?.store?.render?.setting?.ocs?.store : {});
	});

	/** 脚本操作 */
	app.get('/ocs-script-actions', (req, res) => {
		res.json({ allow: true });
	});

	app.get('/get-actions-key', (req, res) => {
		res.send(store.store.server.authToken);
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
				res.json({ canOCR: true, error: err });
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

	// 静态资源
	app.use(express.static(path.join(getProjectPath(), './public')));

	const server = app.listen(store.store.server.port, () => {
		const address = server.address();
		if (address && typeof address === 'object') {
			// 存储本次服务的端口
			logger.info(`OCS服务启动成功 => ${address.port}`);
		}
	});
}
