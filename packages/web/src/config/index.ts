import { reactive, shallowRef } from 'vue';
import { RouteRecordRaw } from 'vue-router';

import page from '@/pages/index.vue';
import bookmarks from '@/pages/bookmarks.vue';
import { GreasyForkUserScript, ScriptCatUserScript, CommonUserScript } from '../types/user.script';
import { remote } from '../utils/remote';
import { ScriptSearchEngine } from '../types/search';
import { StoreUserScript } from '../store';

export const config = reactive({
	/**
	 * 路由设置
	 *
	 * why use shallowRef:
	 *
	 * Vue received a Component which was made a reactive object. This can lead to unnecessary performance overhead,
	 * and should be avoided by marking the component with `markRaw` or using `shallowRef` instead of `ref`.
	 */
	routes: [
		{
			name: 'index',
			path: '/',
			redirect: '/browsers',
			component: shallowRef(page),
			children: [
				{
					name: 'browsers',
					path: 'browsers',
					component: () => import('@/pages/browsers/index.vue'),
					meta: {
						icon: 'view_list',
						title: '浏览器列表'
					}
				},
				{
					name: 'user-scripts',
					path: 'user-scripts',
					component: () => import('@/pages/user-scripts/index.vue'),
					meta: {
						icon: 'code',
						title: '脚本列表'
					}
				},
				{
					name: 'resources',
					path: 'resources',
					component: () => import('@/pages/resources/index.vue'),
					meta: {
						icon: 'widgets',
						title: '应用中心'
					}
				},
				{
					name: 'dashboard',
					path: 'dashboard',
					component: () => import('@/pages/dashboard/index.vue'),
					meta: {
						icon: 'image',
						title: '监控列表'
					}
				},
				{
					name: 'setting',
					path: 'setting',
					component: () => import('@/pages/setting/index.vue'),
					meta: {
						icon: 'settings',
						title: '软件设置'
					}
				}
			]
		},
		{
			name: 'bookmarks',
			path: '/bookmarks',
			component: shallowRef(bookmarks),
			meta: {
				icon: 'view_list',
				title: '书签列表',
				/** 隐藏在左侧菜单栏 */
				hideInMenu: true
			}
		}
	] as RouteRecordRaw[],
	/** 主题预设 */
	themes: {
		dark: false
	},

	/** 用户脚本搜索引擎 */
	scriptSearchEngines: [
		(() => {
			const transformToCommonByInfo = (script: CommonUserScript, info: ScriptCatUserScript) => {
				script.version = info.script.version;
				script.code_url = `https://scriptcat.org/scripts/code/${info.script.script_id}/${info.name}.user.js`;
				script.url = `https://scriptcat.org/script-show-page/${info.script.script_id}`;
				script.authors = [
					{
						url: `https://scriptcat.org/users/${info.user_id}`,
						name: info.username,
						avatar: info.avatar ? `https://scriptcat.org${info.avatar}` : undefined
					}
				];
				script.description = info.description;
				script.name = info.name;
				script.ratings = info.score / (info.score_num ?? 1) / 10; // 5分制
				script.create_time = info.createtime * 1000;
				script.update_time = info.updatetime * 1000;
				script.daily_installs = info.today_install;
				script.total_installs = info.total_install;
				return script;
			};

			return {
				type: 'scriptcat',
				name: 'ScriptCat - 脚本猫',
				homepage: 'https://scriptcat.org',
				search: async (keyword: string, page: number, size: number) => {
					const data = await remote.methods.call(
						'get',
						'https://scriptcat.org/api/v2/scripts?' +
							new URLSearchParams({
								count: size.toString(),
								page: page <= 0 ? '1' : page.toString(),
								keyword
							})
					);

					let list = data.data.list as ScriptCatUserScript[];

					list = list.sort((a, b) => {
						return b.today_install - a.today_install;
					});

					return list.map((item) => {
						return {
							...transformToCommonByInfo({} as CommonUserScript, item),
							id: item.script.script_id,
							version: item.script.version
						} as CommonUserScript;
					});
				},
				infoGetter: async (script: CommonUserScript) => {
					return (await remote.methods.call('get', `https://scriptcat.org/api/v2/scripts/${script.id}`))
						.data as ScriptCatUserScript;
				},
				transformToCommonByInfo,
				versionProvider: async (script: StoreUserScript) => {
					const data = await remote.methods.call('get', `https://scriptcat.org/api/v2/scripts/${script.id}/versions`);

					const list: any[] = data.data.list;

					return list.map((item) => ({
						version: item.version,
						url: script.url,
						code_url:
							'https://scriptcat.org/scripts/code' +
							`/${item.script_id}/${script.info?.name}.user.js?version=${item.version}`,
						create_time: item.createtime * 1000
					}));
				}
			};
		})(),
		(() => {
			const transformToCommonByInfo = (script: CommonUserScript, info: GreasyForkUserScript) => {
				script.version = info.version;
				script.code_url = info.code_url;
				script.ratings =
					(info.good_ratings +
						info.ok_ratings +
						(info.good_ratings + info.ok_ratings + info.bad_ratings) *
							// 变成5分制
							0.5) *
					10;
				script.url = info.url;
				script.authors = info.users;
				script.license = info.license;
				script.description = info.description;
				script.name = info.name;
				script.create_time = new Date(info.created_at).getTime();
				script.update_time = new Date(info.code_updated_at).getTime();
				script.daily_installs = info.daily_installs;
				script.total_installs = info.total_installs;
				return script;
			};
			return {
				type: 'greasyfork',
				name: 'GreasyFork-油叉',
				homepage: 'https://greasyfork.org',
				search: async (keyword: string, page: number, size: number) => {
					const data = await remote.methods.call(
						'get',
						'https://greasyfork.org/zh-CN/scripts.json?' +
							new URLSearchParams({
								q: keyword,
								page: page <= 0 ? '1' : page.toString()
							}),
						{}
					);

					let list = data as GreasyForkUserScript[];

					list = list.sort((a, b) => {
						return b.daily_installs - a.daily_installs;
					});

					return list.map((item) => {
						return {
							...transformToCommonByInfo({} as CommonUserScript, item),
							id: item.id,
							version: item.version
						} as CommonUserScript;
					});
				},
				async infoGetter(script: CommonUserScript) {
					return (await remote.methods.call('get', `https://greasyfork.org/zh-CN/scripts/${script.id}.json`))
						.data as GreasyForkUserScript;
				},
				transformToCommonByInfo,
				versionProvider: async (script: StoreUserScript) => {
					const data: any[] = await remote.methods.call(
						'get',
						`https://greasyfork.org/zh-CN/scripts/${script.id}/versions.json`
					);
					return data.map((item) => ({
						version: item.version,
						url: item.url,
						code_url: item.code_url,
						create_time: new Date(item.created_at).getTime()
					}));
				}
			};
		})()
	] as ScriptSearchEngine[]
});
