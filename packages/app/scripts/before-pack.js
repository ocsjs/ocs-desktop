/**
 * electron-builder beforePack 钩子：打包前确保内置拓展就绪。
 * 在打包复制文件之前执行，此时写入 resources/extensions/ 的产物会被 files 收进 asar。
 * 多平台/多架构构建会多次触发，fetch-extensions 内部缓存保证只下载一次。
 */
module.exports = async function beforePack() {
	await require('./fetch-extensions').main();
};
