/**
 * 一次性 codemod：remote → bridge 调用点迁移（B-P2）。
 * 规则（只替换调用头，不解析参数列表，天然免疫嵌套括号）：
 * - remote.<ns>.call('x', ...)  → bridge.<ns>.x(...)
 * - remote.<ns>.callSync('x', ...) → await bridge.<ns>.x(...)（上下文已审计为 async）
 * - remote.path.get('sep') → bridge.path.sep
 * - remote['electron-store'].get('store') → await bridge.electronStore.get()
 * - import ... from '.../remote' → '.../bridge'
 */
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../packages/web/src');
const NS = ['methods', 'fs', 'path', 'os', 'win', 'webContents', 'app', 'dialog', 'logger'];

function transform(content) {
	let out = content;
	for (const ns of NS) {
		// callSync 优先（先处理长模式再处理短模式，避免部分匹配）
		out = out
			.replace(new RegExp(`remote\\.${ns}\\.callSync\\('(\\w+)',\\s*`, 'g'), `await bridge.${ns}.$1(`)
			.replace(new RegExp(`remote\\.${ns}\\.callSync\\('(\\w+)'\\)`, 'g'), `await bridge.${ns}.$1()`)
			.replace(new RegExp(`remote\\.${ns}\\.call\\('(\\w+)',\\s*`, 'g'), `bridge.${ns}.$1(`)
			.replace(new RegExp(`remote\\.${ns}\\.call\\('(\\w+)'\\)`, 'g'), `bridge.${ns}.$1()`);
	}
	out = out
		.replace(/remote\.path\.get\('sep'\)/g, 'bridge.path.sep')
		.replace(/remote\['electron-store'\]\.get\('store'\)/g, 'await bridge.electronStore.get()')
		.replace(/from '([^']*\/)remote'/g, "from '$1bridge'");
	return out;
}

function walk(dir) {
	const changed = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			changed.push(...walk(full));
		} else if (/\.(ts|vue)$/.test(entry.name)) {
			const before = fs.readFileSync(full, 'utf-8');
			const after = transform(before);
			if (after !== before) {
				fs.writeFileSync(full, after);
				changed.push(path.relative(SRC, full));
			}
		}
	}
	return changed;
}

const changed = walk(SRC);
console.log(`codemod touched ${changed.length} files:`);
changed.forEach((f) => console.log(' -', f));
