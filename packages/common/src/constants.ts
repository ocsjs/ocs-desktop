/**
 * OCS 线上服务常量（app / web 经 vite alias 源码编译共享）。
 *
 * 以下独立体系无法 import 本文件，修改常量时需手动同步（各处均有注释互指）：
 * - packages/app/electron.builder.json  → publish.url      对应 OCS_UPDATER.feedUrl
 * - upgrader-stub/main.js               → UPDATER_BASE_URL 对应 OCS_UPDATER.feedUrl
 * - .github/workflows/build.yml         → COS_UPDATER_DIR  对应 OCS_UPDATER.feedUrl 的 COS 路径
 */

/** 官网 */
export const OCS_WEBSITE = 'https://docs.ocsjs.com';
/** 官网软件下载页 */
export const OCS_DOWNLOAD_PAGE = 'https://docs.ocsjs.com/docs/app';
/** CDN 域名 */
export const OCS_CDN = 'https://cdn.ocsjs.com';

/** 软件信息接口（更新日志外的资源/通知/书签/语言等） */
export const OCS_API = {
	infos: `${OCS_CDN}/api/ocs-app-infos.json`,
	langs: `${OCS_CDN}/api/ocs-app-langs.json`,
	guide: `${OCS_CDN}/articles/app/guide.md`
};

/** electron-updater 更新源（latest.yml / 安装包 / blockmap / CHANGELOG.md 所在目录） */
export const OCS_UPDATER = {
	feedUrl: `${OCS_CDN}/app/electron-updater/`,
	changelogFileName: 'CHANGELOG.md'
};

/** OCS 脚本相关静态资源 */
export const OCS_SCRIPT_RESOURCES = {
	index: `${OCS_CDN}/index.js`,
	easyUs: `${OCS_CDN}/easy-us.js`,
	style: `${OCS_CDN}/style.css`
};

/** 本地服务器默认端口（各处 || 15319 兜底统一引用此常量） */
export const DEFAULT_SERVER_PORT = 15319;
