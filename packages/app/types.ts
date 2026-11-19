/**
 * 跨进程共享类型已下沉至 @ocs-desktop/common（见 common/src/types.ts），
 * 此处仅做兼容再导出；新代码请直接从 '@ocs-desktop/common' 引入。
 */
export type { RemoteMethods, AppStore, UserScripts, RawAutomationScript } from '@ocs-desktop/common';
export { LoggerCore } from '@ocs-desktop/common';
export { ScriptWorker } from './src/worker';
