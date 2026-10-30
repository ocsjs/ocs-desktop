/**
 * 格式化浏览器拓展启动参数（worker 与渲染进程裸启动共用，保持单一实现）。
 * --disable-extensions-except 防止 Chrome 在某些版本/策略下禁用通过 --load-extension 加载的扩展
 */
export function formatExtensionArguments(extensionPaths: string[]) {
	const paths = extensionPaths
		.filter((f) => !f.includes('.DS_Store'))
		.map((p) => p.replace(/\\/g, '/'))
		.join(',');
	return paths.length === 0 ? [] : [`--load-extension=${paths}`, `--disable-extensions-except=${paths}`];
}
