import { randomUUID } from 'crypto';

/**
 * 本地服务访问令牌：仅内存持有，每次启动随机生成，不落盘。
 *
 * 历史问题：token 曾通过 store.set('server.authToken') 明文写入 config.json，
 * 且 /get-actions-key 接口无鉴权发放，导致 worker 的 auth-token 校验形同虚设。
 * 现改为内存态 + IPC/注入式分发（阶段 A）；接口鉴权在阶段 B 落地。
 */
let token = '';

/** 获取本地服务令牌（惰性生成，进程生命周期内不变） */
export function getServerToken(): string {
	if (!token) {
		token = randomUUID().replace(/-/g, '');
	}
	return token;
}
