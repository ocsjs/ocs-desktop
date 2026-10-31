/** 系统自动化程序共享小工具 */

export function sleep(t: number) {
	return new Promise((resolve) => setTimeout(resolve, t));
}
