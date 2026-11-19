#!/usr/bin/env node
/**
 * RemoteMethods / OcsBridge 契约产物生成器（实现即真相源管线）。
 *
 * 流程：
 * 1. tsc -p tsconfig.contract.json（仅含 remote.methods.ts 与 bridge-types.entry.ts 的最小工程）
 *    --emitDeclarationOnly 发射类型声明；
 * 2. 产物文本后处理（包标识符改写：@ocs-desktop/common → ./index）后写入：
 *    - common/src/remote-methods.generated.ts
 *    - common/src/bridge.generated.ts
 * 3. --check 模式：生成到临时目录与已提交产物 diff，不一致退出码 1（CI 防漂移）。
 *
 * 产物为 .ts（非 .d.ts）：`export declare const` / `export type` 在 .ts 中为合法 ambient
 * 声明，common 的 tsc 可正常编译并产出 lib 类型；若直接放 .d.ts 则不会进入 lib 产物。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, watch } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMMON_SRC = path.resolve(APP_ROOT, '../common/src');
const CHECK_MODE = process.argv.includes('--check');
const WATCH_MODE = process.argv.includes('--watch');

const HEADER = `/**
 * ⚠️ 本文件由 packages/app/scripts/gen-remote-contract.mjs 自动生成，请勿手工编辑。
 * 真相源：packages/app/src/ipc/methods.ts 的 methods 实现对象
 * 与 packages/common/src/remote.whitelists.ts 的白名单数组。
 * 修改实现后执行 pnpm gen:contract；CI 经 gen:contract:check 防漂移。
 */
/* eslint-disable */
`;

/**
 * 产物后处理：仅做头注拼接 + 逃逸检查（app 内部相对路径出现即报错——该类型须先下沉 common）。
 * 不做任何路径改写：common 侧 tsconfig paths 自映射使 '@ocs-desktop/common' 标识符
 * 在包内可直接编译（见 common/tsconfig.json），白名单为 common 源码（src/remote.whitelists.ts），
 * 文件改名/移动零维护成本。
 */
function postProcess(content, sourceName) {
	// app 内部相对路径逃逸检查：出现即报错（该类型须先下沉 common，ExtensionIntegrityResult 先例）
	const escapeMatch = content.match(/from '\.(\.\/|\.\.\/)|import\("\.(\.\/|\.\.\/)/);
	if (escapeMatch) {
		console.error(`[gen:contract] ${sourceName} 的产物引用了 app 内部类型（${escapeMatch[0]}），请先将对应类型下沉到 packages/common。`);
		process.exit(1);
	}
	return HEADER + content;
}

// 产物清单（target 位于 common/src/types/ 子目录）
const emitted = [
	{
		source: 'app/src/ipc/methods.d.ts',
		target: path.join(COMMON_SRC, 'types', 'remote-methods.generated.ts'),
		name: 'RemoteMethods',
		// 冷启动占位桩：产物缺失时 types.ts 的 re-export 会让 emit 程序报解析错误，
		// 先写占位保证可编译，生成后覆盖（自举）
		stub: `export declare const methods: any;\nexport type RemoteMethods = any;\n`
	},
	{
		source: 'app/src/ipc/bridge-types.entry.d.ts',
		target: path.join(COMMON_SRC, 'types', 'bridge.generated.ts'),
		name: 'OcsBridge',
		stub: `export type OcsBridge = any;\n`
	}
];

/** 执行一次完整生成（发射 + 后处理 + 写出/校验），返回是否有漂移（仅 check 模式有意义） */
function runGeneration() {
	const workDir = mkdtempSync(path.join(tmpdir(), 'ocs-contract-'));
	try {
		// 1) 冷启动自举：目标产物不存在时先写占位桩（含 re-export 所需的具名导出），再进入 emit
		for (const { target, stub } of emitted) {
			if (!existsSync(target)) {
				mkdirSync(path.dirname(target), { recursive: true });
				writeFileSync(target, stub);
				console.log(`[gen:contract] 冷启动占位：${path.relative(APP_ROOT, target)}`);
			}
		}

		// 2) 声明发射（tsc 公开稳定行为，无编译器内部 API）；
		// 经 require.resolve 定位 tsc 入口（pnpm 布局下 node_modules/typescript 不在包目录）
		const tscJs = createRequire(APP_ROOT + '/').resolve('typescript/bin/tsc');
		execFileSync(process.execPath, [tscJs, '-p', 'tsconfig.contract.json', '--outDir', workDir], {
			cwd: APP_ROOT,
			stdio: 'inherit'
		});

		// 3) 读取产物并后处理
		// （paths 别名把 common 源码拉入编译，rootDir 上溯到仓库根，产物位于 <outDir>/app/src/ 下）
		let drift = false;
		for (const { source, target, name } of emitted) {
			// tsc 在 Windows 发射 CRLF，统一归一化为 LF（产物跨平台一致，--check diff 稳定）
			const raw = readFileSync(path.join(workDir, source), 'utf-8').replace(/\r\n/g, '\n');
			const content = postProcess(raw, name);
			if (CHECK_MODE) {
				const committed = existsSync(target) ? readFileSync(target, 'utf-8') : '';
				if (committed !== content) {
					console.error(`[gen:contract] ${name} 产物已过期：${path.relative(APP_ROOT, target)}`);
					drift = true;
				}
			} else {
				mkdirSync(path.dirname(target), { recursive: true });
				writeFileSync(target, content);
				console.log(`[gen:contract] 已生成 ${path.relative(APP_ROOT, target)}`);
			}
		}
		return drift;
	} finally {
		rmSync(workDir, { recursive: true, force: true });
	}
}

if (CHECK_MODE) {
	if (runGeneration()) {
		console.error('[gen:contract] 契约产物与实现不一致，请执行 pnpm gen:contract 重新生成并提交。');
		process.exit(1);
	}
	console.log('[gen:contract] 契约产物与实现一致。');
} else if (WATCH_MODE) {
	// watch 模式：监听真相源文件变化，防抖后自动重新生成（fs.watch 内置，零新依赖）
	const WATCH_FILES = [
		path.join(APP_ROOT, 'src/ipc/methods.ts'),
		path.join(COMMON_SRC, 'remote.whitelists.ts'),
		path.join(APP_ROOT, 'src/ipc/bridge-types.entry.ts'),
		path.join(APP_ROOT, 'tsconfig.contract.json')
	];

	let timer = null;
	let running = false;
	let queued = false;

	const regenerate = () => {
		if (running) {
			queued = true;
			return;
		}
		running = true;
		try {
			console.log(`[gen:contract:watch] 检测到变更，重新生成（${new Date().toLocaleTimeString()}）`);
			runGeneration();
		} catch (e) {
			// 生成失败不退出 watch（编辑中间态可恢复）
			console.error('[gen:contract:watch] 生成失败（将继续监听）：', e.message);
		} finally {
			running = false;
			if (queued) {
				queued = false;
				regenerate();
			}
		}
	};

	runGeneration();
	console.log(`[gen:contract:watch] 监听中（${WATCH_FILES.length} 个文件），Ctrl+C 退出`);
	for (const file of WATCH_FILES) {
		watch(file, () => {
			clearTimeout(timer);
			timer = setTimeout(regenerate, 300);
		});
	}
} else {
	runGeneration();
}
