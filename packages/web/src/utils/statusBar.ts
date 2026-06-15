import { reactive, readonly } from 'vue';

/** 状态栏类型 */
export type StatusBarType = 'info' | 'success' | 'warning' | 'error';

export interface StatusBarState {
	/** 当前显示的消息 */
	message: string;
	/** 消息图标（material icons 类型名） */
	icon: string;
	/** 状态类型 */
	type: StatusBarType;
	/** 是否显示 loading 动画 */
	loading: boolean;
	/** 自动消失时间（ms），0 表示不自动消失 */
	duration: number;
	/** 是否可见 */
	visible: boolean;
	/** 定时器 id */
	timerId: ReturnType<typeof setTimeout> | null;
}

export interface ShowStatusOptions {
	/** 消息图标（material icons 类型名），会根据 type 自动设置默认图标 */
	icon?: string;
	/** 是否显示 loading 动画，默认 false */
	loading?: boolean;
	/** 自动消失时间（ms），默认 3500，设为 0 表示不自动消失 */
	duration?: number;
}

/** 各类型的默认配置 */
const typeDefaults: Record<StatusBarType, { icon: string; color: string; bgColor: string; darkColor: string; darkBgColor: string }> = {
	info: {
		icon: 'info',
		color: '#1d2129',
		bgColor: '#e8f3ff',
		darkColor: '#e5e6eb',
		darkBgColor: '#1d2d44'
	},
	success: {
		icon: 'check_circle',
		color: '#0c8040',
		bgColor: '#e8f7ef',
		darkColor: '#7be0a2',
		darkBgColor: '#0d2818'
	},
	warning: {
		icon: 'warning',
		color: '#a06807',
		bgColor: '#fff7e8',
		darkColor: '#f5c243',
		darkBgColor: '#2d2006'
	},
	error: {
		icon: 'error',
		color: '#cb2634',
		bgColor: '#ffece8',
		darkColor: '#f76972',
		darkBgColor: '#2d1418'
	}
};

const state = reactive<StatusBarState>({
	message: '',
	icon: '',
	type: 'info',
	loading: false,
	duration: 3500,
	visible: false,
	timerId: null
});

/** 清除当前定时器 */
function clearTimer() {
	if (state.timerId !== null) {
		clearTimeout(state.timerId);
		state.timerId = null;
	}
}

/** 隐藏状态栏 */
function hide() {
	state.visible = false;
	clearTimer();
}

/** 内部：显示状态消息 */
function showStatus(type: StatusBarType, message: string, options?: ShowStatusOptions) {
	clearTimer();

	const defaults = typeDefaults[type];

	state.message = message;
	state.type = type;
	state.icon = options?.icon ?? defaults.icon;
	state.loading = options?.loading ?? false;
	state.duration = options?.duration ?? 3500;
	state.visible = true;

	if (state.duration > 0) {
		state.timerId = setTimeout(() => {
			hide();
		}, state.duration);
	}
}

export const Status = {
	/** 显示 info 类型消息 */
	info(message: string, options?: ShowStatusOptions) {
		showStatus('info', message, options);
	},
	/** 显示 success 类型消息 */
	success(message: string, options?: ShowStatusOptions) {
		showStatus('success', message, options);
	},
	/** 显示 warning 类型消息 */
	warning(message: string, options?: ShowStatusOptions) {
		showStatus('warning', message, options);
	},
	/** 显示 error 类型消息 */
	error(message: string, options?: ShowStatusOptions) {
		showStatus('error', message, options);
	},
	/** 显示带 loading 动画的状态消息，不自动消失 */
	loading(message: string, options?: Omit<ShowStatusOptions, 'loading' | 'duration'>) {
		showStatus('info', message, { ...options, loading: true, duration: 0 });
	},
	/** 手动清除当前消息 */
	clear: hide
};

/** 状态栏只读状态，供组件使用 */
export const statusBarState = readonly(state);

/** 获取类型对应的颜色配置（供组件动态样式使用） */
export function getTypeColors(type: StatusBarType) {
	return typeDefaults[type];
}
