/**
 * 宿主环境判定。
 *
 * 阶段 C 后渲染进程不再直接持有 Node/Electron 能力（nodeIntegration=false），
 * 底层能力统一由 preload 注入的 window.ocs 提供；
 * 纯浏览器宿主（受管 Chromium 导航页）无 preload 注入，据此判定 inBrowser。
 */
// eslint-disable-next-line no-undef
export const inBrowser = typeof (window as any).ocs === 'undefined';
