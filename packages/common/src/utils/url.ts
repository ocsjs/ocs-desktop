/**
 * 链接自动识别与规范化（渲染进程 / 主进程共用）
 *
 * 处理用户手动输入或从聊天软件等处粘贴的链接：
 * - 去除首尾空白与意外携带的引号、尖括号
 * - 已带协议头（http://、https:// 等任意 scheme）原样保留
 * - 协议相对链接（//example.com）补全 https:
 * - 域名形态（www.example.com、example.com/path、localhost:3000、127.0.0.1 等）自动补全 https:// 前缀
 * - 无法识别为链接时原样返回，交由上层校验
 */
export function normalizeUrl(input: unknown): string {
	let value = String(input ?? '').trim();
	// 去除粘贴时意外携带的首尾引号 / 尖括号（链接首尾不可能出现这些字符）
	value = value.replace(/^["'<\s]+/, '').replace(/["'>\s]+$/, '');
	if (!value) return value;

	// 已带任意协议头（http: https: ftp: file: data: ...）
	if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) {
		return value;
	}
	// 协议相对链接 //example.com
	if (value.startsWith('//')) {
		return 'https:' + value;
	}
	// 域名 / localhost / IPv4，可后接端口与路径、查询、锚点
	if (/^(localhost|(\d{1,3}\.){3}\d{1,3}|[a-z0-9]([\w-]*[a-z0-9])?(\.[a-z0-9]([\w-]*[a-z0-9])?)+)(:\d+)?([/?#].*)?$/i.test(value)) {
		return 'https://' + value;
	}
	return value;
}
