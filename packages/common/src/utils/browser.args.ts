/**
 * 格式化浏览器拓展启动参数（worker 与渲染进程裸启动共用，保持单一实现）。
 * --disable-extensions-except 防止 Chrome 在某些版本/策略下禁用通过 --load-extension 加载的扩展
 * shellQuote：仅 shell 字符串拼接场景（child_process.exec）使用——路径含空格时 shell 会截断参数，
 * worker（Playwright argv 数组）场景禁用，否则引号会成为参数值的一部分。
 */
export function formatExtensionArguments(extensionPaths: string[], opts?: { shellQuote?: boolean }) {
	const paths = extensionPaths
		.filter((f) => !f.includes('.DS_Store'))
		.map((p) => p.replace(/\\/g, '/'))
		.join(',');
	const quote = (s: string) => (opts?.shellQuote ? `"${s}"` : s);
	return paths.length === 0 ? [] : [`--load-extension=${quote(paths)}`, `--disable-extensions-except=${quote(paths)}`];
}
