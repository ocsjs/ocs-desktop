import { reactive, readonly } from 'vue';

export interface StatusBarState {
	/** 当前显示的消息 */
	message: string;
	/** 消息图标（material icons 类型名） */
	icon: string;
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
	/** 消息图标（material icons 类型名） */
	icon?: string;
	/** 是否显示 loading 动画，默认 false */
	loading?: boolean;
	/** 自动消失时间（ms），默认 3500，设为 0 表示不自动消失 */
	duration?: number;
}

const state = reactive<StatusBarState>({
	message: '',
	icon: '',
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

/** 显示状态消息 */
export function showStatus(message: string, options?: ShowStatusOptions) {
	clearTimer();

	state.message = message;
	state.icon = options?.icon || '';
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
	/** 显示状态消息 */
	show: showStatus,
	/** 显示带 loading 动画的状态消息，不自动消失 */
	loading(message: string, options?: Omit<ShowStatusOptions, 'loading' | 'duration'>) {
		showStatus(message, { ...options, loading: true, duration: 0 });
	},
	/** 手动清除当前消息 */
	clear: hide
};

/** 状态栏只读状态，供组件使用 */
export const statusBarState = readonly(state);
