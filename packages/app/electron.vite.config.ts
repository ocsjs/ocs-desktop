import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import vue from '@vitejs/plugin-vue';
import { visualizer } from 'rollup-plugin-visualizer';
import commonjs from 'vite-plugin-commonjs';
import path from 'path';

/**
 * common 源码别名：直接编译 workspace 源码，跳过 common 的 tsc 产物，
 * 保证类型与代码实时一致（与 web/vite.config.ts 的 common/web 别名同策略）。
 */
const commonAlias = [
	{ find: '@ocs-desktop/common/node', replacement: path.resolve(__dirname, '../common/node.ts') },
	{ find: '@ocs-desktop/common/web', replacement: path.resolve(__dirname, '../common/web.ts') },
	{ find: '@ocs-desktop/common', replacement: path.resolve(__dirname, '../common/index.ts') }
];

export default defineConfig({
	main: {
		// common 必须排除出外部化：否则产物保留 require('@ocs-desktop/common')，
		// 运行时去 node_modules 找 lib/index.js（lib 被 gitignore 且构建链不产出）导致启动崩溃；
		// 排除后 common 源码经下方 alias 直接打进 out/main bundle
		plugins: [externalizeDepsPlugin({ exclude: ['@ocs-desktop/common'] })],
		resolve: {
			alias: commonAlias
		},
		build: {
			outDir: 'out/main',
			rollupOptions: {
				input: {
					index: path.resolve(__dirname, 'index.ts'),
					// worker 子进程入口，打包为 out/main/script.js 供 fork
					script: path.resolve(__dirname, 'src/worker/entry.ts')
				}
			}
		}
	},
	renderer: {
		root: path.resolve(__dirname, '../web'),
		resolve: {
			alias: [
				...commonAlias,
				{ find: '@', replacement: path.resolve(__dirname, '../web/src') },
				{ find: 'root', replacement: path.resolve(__dirname, '../web') },
				{ find: 'app', replacement: path.resolve(__dirname, '../web/app') }
			]
		},
		build: {
			outDir: path.resolve(__dirname, 'out/renderer'),
			rollupOptions: {
				input: path.resolve(__dirname, '../web/index.html'),
				output: {
					manualChunks(id) {
						if (id.includes('node_modules')) {
							// 取最后一个 node_modules 后的第一段作为 chunk 名，兼容 pnpm isolated
							// 布局（.pnpm/pkg@version/node_modules/pkg/... 嵌套路径）
							return (id.toString().split('node_modules/').pop() || '').split('/')[0];
						}
					}
				}
			},
			/** 压缩代码但保留类名/函数名（automation 脚本依赖原始类名注册，不能被 mangling） */
			minify: 'esbuild'
		},
		// esbuild 为 vite 顶层选项（非 build 内），keepNames 保留类名/函数名
		esbuild: {
			keepNames: true
		},
		base: './',
		server: {
			port: 3000,
			open: false
		},
		plugins: [
			commonjs({ filter: (id) => (id.includes('xlsx') ? undefined : false) }) as any,
			vue(),
			visualizer() as any
		]
	}
});
