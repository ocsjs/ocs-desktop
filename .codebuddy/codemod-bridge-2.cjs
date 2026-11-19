/**
 * codemod 第二轮（补漏）：
 * 1. 多行调用：remote.<ns>.call(\n\t'x', ...) —— 方法名在下一行
 * 2. 方法名后的 as any 断言：callSync('x' as any, ...) —— 迁移后类型完备，断言一并去除
 * 3. 链式换行：remote.dialog\n\t\t.call('x', ...) —— 对象与 .call 之间的换行
 * 4. 去重：同一文件中重复的 `import { bridge } from '...bridge';` 行
 */
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../packages/web/src');
const NS = ['methods', 'fs', 'path', 'os', 'win', 'webContents', 'app', 'dialog', 'logger'];

function transform(content) {
	let out = content;
	for (const ns of NS) {
		// callSync（含多行与 as any）
		out = out
			.replace(new RegExp(`remote\\.${ns}\\.callSync\\(\\s*'(\\w+)'\\s*(?:as any)?\\s*,\\s*`, 'g'), `await bridge.${ns}.$1(`)
			.replace(new RegExp(`remote\\.${ns}\\.callSync\\(\\s*'(\\w+)'\\s*(?:as any)?\\s*\\)`, 'g'), `await bridge.${ns}.$1()`)
			// call（含多行与 as any）
			.replace(new RegExp(`remote\\.${ns}\\.call\\(\\s*'(\\w+)'\\s*(?:as any)?\\s*,\\s*`, 'g'), `bridge.${ns}.$1(`)
			.replace(new RegExp(`remote\\.${ns}\\.call\\(\\s*'(\\w+)'\\s*(?:as any)?\\s*\\)`, 'g'), `bridge.${ns}.$1()`)
			// 链式换行：remote.<ns>\n\t\t.call('x', ...)
			.replace(new RegExp(`remote\\.${ns}(\\s*)\\.\\s*callSync\\(\\s*'(\\w+)'\\s*(?:as any)?\\s*,\\s*`, 'g'), `await bridge.${ns}.$2(`)
			.replace(new RegExp(`remote\\.${ns}(\\s*)\\.\\s*callSync\\(\\s*'(\\w+)'\\s*(?:as any)?\\s*\\)`, 'g'), `await bridge.${ns}.$2()`)
			.replace(new RegExp(`remote\\.${ns}(\\s*)\\.\\s*call\\(\\s*'(\\w+)'\\s*(?:as any)?\\s*,\\s*`, 'g'), `bridge.${ns}.$2(`)
			.replace(new RegExp(`remote\\.${ns}(\\s*)\\.\\s*call\\(\\s*'(\\w+)'\\s*(?:as any)?\\s*\\)`, 'g'), `bridge.${ns}.$2()`);
	}
	// 去重 import { bridge }（保留第一次出现）
	const importRe = /^import \{ bridge \} from '([^']*bridge)';$/gm;
	const seen = new Set();
	out = out.replace(importRe, (m, spec) => {
		if (seen.has(spec)) return '';
		seen.add(spec);
		return m;
	});
	// 清理去重可能产生的连续空行
	out = out.replace(/\n{3,}/g, '\n\n');
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
console.log(`codemod-2 touched ${changed.length} files`);
