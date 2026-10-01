/**
 * 渲染进程（浏览器环境）安全入口：仅包含可在 web 侧运行的模块与跨进程共享类型。
 *
 * 主入口 '@ocs-desktop/common' 包含 Node/Electron 能力（chrome.path、valid.browser 等），
 * 仅限主进程（@ocs-desktop/app）使用；渲染进程（@ocs-desktop/web）请一律使用
 * '@ocs-desktop/common/web'。
 */
export * from './src/constants';
export * from './src/api';
export { StringUtils } from './src/utils/string';
export { normalizeUrl } from './src/utils/url';
export { validateConfigValue } from './src/utils/config';
export * from './src/interface';
export * from './src/contract';
export * from './src/scripts/interface';
export * from './src/scripts/script';
export type { LoggerCore } from './src/logger.core';
