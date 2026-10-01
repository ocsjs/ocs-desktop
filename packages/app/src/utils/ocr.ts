import { writeFile, mkdirSync, existsSync, rmSync, writeFileSync, chmodSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import child_process from 'child_process';
import { Logger } from '../logger';
import { store } from '../store';

const getOcrFolder = () => path.join(store.store.paths.downloadFolder, './apps/ocr');

const logger = Logger('ocr');

/**
 * 使用 ddddocr 进行验证码识别
 * @param base64 图片 base64
 */
export function ocr(base64: string) {
	return new Promise<string>((resolve, reject) => {
		const uuid = randomUUID();
		const img_cache = path.join(getOcrFolder(), './img_cache');
		if (!existsSync(img_cache)) {
			mkdirSync(img_cache, { recursive: true });
		}
		const img = path.join(img_cache, uuid + '.png');
		writeFile(img, base64, 'base64', () => {
			// 要使用 "" 去包裹路径，防止出现空格
			const cmd = [`".${path.join(getOcrFolder(), getOCRFileName())}"`, '--ocr', `"${img}"`].join(' ');
			logger.log('cmd', cmd);

			// timeout 防止 ocr.exe 挂起导致请求无限等待
			child_process.exec(cmd, { timeout: 20_000, windowsHide: true }, (err, stdout, stderr) => {
				if (err || stderr) {
					reject(err || stderr);
				} else {
					resolve(stdout.trim());
				}
				// 删除图片
				if (existsSync(img)) {
					rmSync(img);
				}
			});
		});
	});
}

/**
 * 使用 ddddocr 进行滑块识别
 *
 * @param det_target_base64 滑块图片
 * @param det_bg_base64 滑块背景图片
 *
 * target_y: 滑块高度
 * target: [x1,y1,x2,y2]
 */
export function det(det_target_base64: string, det_bg_base64: string) {
	return new Promise<{
		target_y: number;
		target: [number, number, number, number];
	}>((resolve, reject) => {
		const img_cache = path.join(getOcrFolder(), './img_cache');
		if (!existsSync(img_cache)) {
			mkdirSync(img_cache, { recursive: true });
		}
		const img1 = path.join(img_cache, randomUUID() + '.png');
		const img2 = path.join(img_cache, randomUUID() + '.png');
		writeFileSync(img1, det_target_base64, 'base64');
		writeFileSync(img2, det_bg_base64, 'base64');

		const cmd = [
			`"${path.join(getOcrFolder(), getOCRFileName())}"`,
			'--det-target',
			`"${img1}"`,
			'--det-bg',
			`"${img2}"`
		].join(' ');

		child_process.exec(cmd, { timeout: 20_000, windowsHide: true }, (err, stdout, stderr) => {
			if (err || stderr) {
				reject(err || stderr);
			} else {
				resolve(JSON.parse(stdout.trim().replace(/'/g, '"')));
			}
			// 删除图片
			if (existsSync(img1)) {
				rmSync(img1);
			}
			if (existsSync(img2)) {
				rmSync(img2);
			}
		});
	});
}

/** 判断是否能够进行验证码识别 */
export function canOCR() {
	const ocrPath = path.join(getOcrFolder(), getOCRFileName());
	if (!existsSync(ocrPath)) {
		return false;
	}
	// 资源中心下载解压可能丢失 unix 执行位（与 init.chrome 对浏览器可执行文件的处理同理），
	// 非 win32 平台补一次 chmod，避免 child_process.exec 报 EACCES
	if (process.platform !== 'win32') {
		try {
			chmodSync(ocrPath, 0o755);
		} catch (e) {
			logger.error('chmod ocr executable failed', { ocrPath, error: String(e) });
		}
	}
	return true;
}

function getOCRFileName() {
	return process.platform === 'win32' ? './ocr.exe' : './ocr';
}
