/**
 * 从 favicon.png 生成多尺寸图标集（packages/app/public/icons/）。
 *
 * 用途：托盘/窗口图标在不同平台需要不同尺寸（Win 托盘 16px、Linux 托盘 22-24px、
 * mac 菜单栏 22pt），直接用 512px 原图缩放会产生锯齿；mac 菜单栏甚至会按
 * 原始点位渲染导致图标巨大。预生成多尺寸后由 nativeImage 按场景选最佳匹配。
 *
 * 必须在 electron 运行时中执行（nativeImage 依赖 electron）：
 *   pnpm --filter @ocs-desktop/app exec electron ../../scripts/generate-icons.js
 */
const { app, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '../packages/app/public/favicon.png');
const OUT_DIR = path.join(__dirname, '../packages/app/public/icons');
const SIZES = [16, 22, 24, 32, 44, 48, 64, 96, 128, 256, 512];

app.whenReady().then(() => {
	const src = nativeImage.createFromPath(SRC);
	if (src.isEmpty()) {
		console.error('源图标读取失败:', SRC);
		app.exit(1);
		return;
	}
	fs.mkdirSync(OUT_DIR, { recursive: true });
	for (const size of SIZES) {
		const img = src.resize({ width: size, height: size, quality: 'best' });
		const file = path.join(OUT_DIR, `${size}.png`);
		fs.writeFileSync(file, img.toPNG());
		console.log('生成', file);
	}
	app.exit(0);
});
