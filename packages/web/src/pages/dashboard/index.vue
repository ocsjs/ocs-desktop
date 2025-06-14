<template>
	<div class="col-12 p-2 m-auto">
		<div class="text-secondary markdown mb-2">
			<div>
				浏览器多开的数量取决于电脑的配置，自行根据实际情况尝试。建议全部浏览器加载完成后再开启监控。<br />
				监控需要占用内存和CPU，配置不好的建议不要监控。
			</div>
		</div>

		<div class="d-flex mb-1 align-items-center">
			<a-space :size="0">
				<template #split>
					<a-divider
						class="ms-1 me-1"
						direction="vertical"
					/>
				</template>

				<a-tooltip
					:content="
						launchedProcesses.length === 0
							? '暂无运行浏览器，无法开始监控'
							: '显示每个浏览器的图像，如果太多浏览器可能会造成电脑卡顿'
					"
					position="bl"
				>
					<div>
						<a-button
							size="mini"
							type="outline"
							:disabled="launchedProcesses.length === 0 || state.loading"
							@click="state.show = !state.show"
						>
							<template v-if="state.loading"> 加载中... </template>
							<template v-else> {{ state.show ? '暂停' : '开始' }}监控 </template>
						</a-button>
					</div>
				</a-tooltip>

				<a-switch v-model="store.render.dashboard.details.tags">
					<template #checked> 显示标签 </template>
					<template #unchecked> 显示标签 </template>
				</a-switch>

				<a-switch v-model="store.render.dashboard.details.notes">
					<template #checked> 显示备注 </template>
					<template #unchecked> 显示备注 </template>
				</a-switch>

				<a-select
					v-model="store.render.dashboard.num"
					size="mini"
					style="width: 96px"
					:options="[1, 2, 4, 6, 8].map((i) => ({ value: i, label: `显示${i}列` }))"
				>
				</a-select>

				<a-select
					v-model="store.render.dashboard.video.aspectRatio"
					size="mini"
					style="width: 130px"
					:options="aspectRatio"
				>
					<template #prefix> 横纵比 </template>
				</a-select>

				<a-select
					v-model="store.app.video_frame_rate"
					size="mini"
					style="width: 140px"
					:options="[
						{ label: '节能', value: 1 },
						{ label: '流畅', value: 4 },
						{ label: '高帧（消耗CPU）', value: 20 },
						{ label: '最高（很耗CPU）', value: 100 }
					]"
				>
					<template #prefix> 帧率 </template>
				</a-select>
			</a-space>
		</div>

		<template v-if="processes.length === 0">
			<div
				class="d-flex"
				style="height: 50vh"
			>
				<a-empty
					class="m-auto"
					description="没有运行中的浏览器"
				></a-empty>
			</div>
		</template>
		<template v-else-if="state.show === false">
			<a-empty
				class="pt-5"
				description="当前监控已暂停，请点击监控按钮重新监控"
			></a-empty>
		</template>
		<template v-else>
			<a-empty
				v-show="state.loading === true"
				class="pt-5"
				description="加载中..."
			></a-empty>
			<div
				v-show="state.loading === false"
				class="dashboard mt-2"
				:style="{
					'grid-template-columns': `repeat(${store.render.dashboard.num}, 1fr)`
				}"
			>
				<template
					v-for="pro of launchedProcesses"
					:key="pro.uid"
				>
					<div class="browser">
						<!-- 头部操作按钮 -->
						<div class="browser-title">
							<a-row>
								<a-col flex="100px">
									<span
										class="text-secondary"
										style="font-size: 12px"
									>
										{{ pro.browser.name }}
									</span>
								</a-col>
								<a-col
									flex="auto"
									class="d-flex align-content-center justify-content-end text-end"
								>
									<a-space
										:size="0"
										class="justify-content-end"
									>
										<template #split>
											<a-divider
												direction="vertical"
												class="ms-1 me-1"
											/>
										</template>

										<BrowserOperators
											:space="false"
											:browser="pro.browser"
										>
											<template #split>
												<a-divider
													direction="vertical"
													class="ms-1 me-1"
												/>
											</template>
										</BrowserOperators>

										<EntityOperator
											type="browser"
											:entity="pro.browser"
											:permissions="['location', 'edit']"
										></EntityOperator>
									</a-space>
								</a-col>
							</a-row>
						</div>

						<!-- 影像区域 -->
						<div
							class="browser-video"
							@click="openBrowser(pro.uid)"
						>
							<a-tooltip content="点击操控浏览器">
								<!-- 浏览器影像投屏占位符 -->
								<div :id="'video-' + pro.uid"></div>
							</a-tooltip>

							<span v-if="pro.video === undefined">
								<a-empty
									v-if="pro.status === 'launching'"
									description="等待浏览器启动..."
								>
								</a-empty>
								<a-empty
									v-else-if="pro.status === 'launched'"
									description="等待图像初始化..."
								>
								</a-empty>
							</span>
						</div>

						<!-- 显示浏览器信息 -->

						<a-row
							v-if="store.render.dashboard.details.notes || store.render.dashboard.details.tags"
							class="align-items-center"
						>
							<!-- 标签 -->
							<a-col
								v-if="store.render.dashboard.details.tags"
								style="width: 100px"
								flex="100px"
							>
								<Tags
									:tags="pro.browser.tags"
									:read-only="true"
									size="small"
								></Tags>
							</a-col>
							<!-- 备注 -->
							<a-col
								v-if="store.render.dashboard.details.notes"
								style="width: 100px"
								flex="100px"
								class="text-secondary notes"
							>
								<a-tooltip
									content="备注描述"
									position="tl"
								>
									<template #content>
										<div>备注描述</div>
										<a-divider class="mt-1 mb-1" />
										<div>
											{{ pro.browser.notes }}
										</div>
									</template>
									<span> {{ pro.browser.notes }} </span>
								</a-tooltip>
							</a-col>
						</a-row>
					</div>
				</template>
			</div>
		</template>
	</div>
</template>

<script setup lang="ts">
import { onDeactivated, watch, reactive, computed, onActivated, onMounted } from 'vue';
import { Process, processes } from '../../utils/process';
import BrowserOperators from '../../components/browsers/BrowserOperators.vue';
import { store } from '../../store';

import Tags from '../../components/Tags.vue';
import { DesktopCapturerSource } from 'electron';
import { remote } from '../../utils/remote';
import { Modal, SelectOptionData } from '@arco-design/web-vue';
import EntityOperator from '../../components/EntityOperator.vue';

const state = reactive({
	show: false,
	loading: false
});

const launchedProcesses = computed(() => processes.filter((p) => p.status === 'launched'));

const aspectRatio = [
	[0, '默认'],
	[4 / 3, '4:3'],
	[16 / 9, '16:9']
].map(
	(i) => ({ selected: i[0] === store.render.dashboard.video.aspectRatio, value: i[0], label: i[1] } as SelectOptionData)
);

// 监听已启动的浏览器，如果全部关闭，则关闭视频显示
watch(
	() => launchedProcesses.value.length,
	(curr, pre) => {
		// 如果全部关闭，则关闭视频显示
		if (launchedProcesses.value.length === 0) {
			// 触发 watch，关闭视频
			state.show = false;
		} else {
			// 如果有新的进程加入，则刷新视频
			if (state.show && curr > pre) {
				refreshVideo();
			}
		}
	}
);

watch(
	() => store.app.video_frame_rate,
	() => {
		Modal.info({
			content: '修改帧率后请 重启软件 才可生效。'
		});
	}
);

// 当横纵比改变时，延迟更新视频
watch(() => [store.render.dashboard.video.aspectRatio], refreshVideo);
// 当show改变时，即时更新
watch(
	() => state.show,
	() => {
		state.show ? refreshVideo() : closeVideo();
	}
);

/** 离开时视频可能会暂停，所以这里进行一下处理 */
onActivated(() => {
	for (const process of launchedProcesses.value) {
		process.video?.play();
	}
});

/** 离开时暂停视频播放 ，好像离开时原生事件也会自动暂停。 */
onDeactivated(() => {
	for (const process of launchedProcesses.value) {
		process.video?.pause();
	}
});

onMounted(() => {
	// 持续挂载视频，防止丢失
	setInterval(() => {
		for (const process of processes) {
			mountVideo(process);
		}
	}, 3000);
});

/**
 * 关闭视频显示
 */
async function closeVideo() {
	for (const process of processes) {
		process.stream?.getTracks().forEach((track) => {
			track.stop();
		});
	}
}

/**
 * 刷新视频显示
 */
async function refreshVideo() {
	try {
		state.loading = true;

		// 将所有浏览器跳转至 webrtc 对接页面

		await Promise.all(
			processes.map(
				(process) =>
					new Promise<void>((resolve) => {
						process.once('webrtc-page-loaded', resolve);
						process.worker?.('gotoWebRTCPage');
					})
			)
		);

		const processStatus: Map<string, boolean> = new Map();
		for (const process of processes) {
			processStatus.set(process.uid, false);
		}

		let retryCount = 20;

		async function loop() {
			retryCount--;
			console.log('looping', retryCount);

			// 抓取屏幕
			const sources: DesktopCapturerSource[] = await remote.desktopCapturer.call('getSources', { types: ['window'] });

			// 未完成的进程抓取屏幕
			await Promise.all(
				processes
					.filter((p) => processStatus.get(p.uid) === false)
					.map((process) => {
						return new Promise<void>((resolve, reject) => {
							getBrowserVideo(process.uid, sources)
								.then((res) => {
									if (!res) {
										return resolve();
									}

									process.stream = res.stream;

									process.stream?.getTracks().forEach((track) => {
										track.applyConstraints({
											/** 尽量减低帧率不占用高内存 */
											frameRate: store.app.video_frame_rate ?? 1,
											/** 横纵比 */
											aspectRatio:
												store.render.dashboard.video.aspectRatio === 0
													? undefined
													: store.render.dashboard.video.aspectRatio
										});
									});
									process.video = res.video;

									// 挂载视频
									mountVideo(process);

									processStatus.set(process.uid, true);

									resolve();
								})
								.catch((err) => {
									console.error(err);
									resolve();
								});
						});
					})
			);

			// 已完成的进程关闭 webrtc 对接页面
			await Promise.all(
				processes
					.filter((p) => processStatus.get(p.uid) === true)
					.map(
						(process) =>
							new Promise<void>((resolve) => {
								process.once('webrtc-page-closed', resolve);
								process.worker?.('closeWebRTCPage');
							})
					)
			);

			// 如果还有未完成的进程，则等待 3s 后再次执行
			if (processes.filter((p) => processStatus.get(p.uid) === false).length !== 0 && retryCount > 0) {
				await new Promise((resolve) => setTimeout(resolve, 3000));
				await loop();
			}
		}

		await loop();
	} catch (e) {
		Modal.error({
			content: '获取数据错误，请检查软件是否有录制应用权限：' + e,
			title: '错误'
		});
	}

	state.loading = false;
}

async function getBrowserVideo(uid: string, sources: DesktopCapturerSource[]) {
	for (const source of sources) {
		if (RegExp(uid).test(source.name)) {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({
					audio: false,
					video: {
						// @ts-ignore
						mandatory: {
							chromeMediaSource: 'desktop',
							chromeMediaSourceId: source.id
						}
					}
				});

				const video = document.createElement('video');
				video.srcObject = stream;
				video.style.display = 'block';
				video.style.width = '100%';
				video.poster = source.thumbnail.toDataURL();

				video.onloadedmetadata = (e) => video.play();

				return { video, stream };
			} catch (e) {
				console.log(e);
			}
		}
	}
}
//   挂载视频
function mountVideo(process: Process) {
	const slot = document.querySelector(`#video-${process.uid}`);
	// 如果 slot.children.length === 0 说明没有挂载视频
	if (slot && slot.children.length === 0 && process.video) {
		slot.replaceChildren(process.video);
	}
}

function openBrowser(uid: string) {
	Process.from(uid)?.bringToFront();
}
</script>

<style scoped lang="less">
.dashboard {
	display: grid;
	gap: 10px;
	grid-template-columns: repeat(6, 1fr);
}

.screenshot-item-title {
	padding: 0px 4px;
	white-space: nowrap;
}

.browser {
	background-color: #f2f5f8;
	padding: 4px;
	border-radius: 4px;

	&:hover {
		box-shadow: 0px 0px 4px -1px #2e98fc;
	}
}

.browser-video {
	overflow: hidden;
	cursor: pointer;
	border-radius: 4px;
}

.browser-title {
	height: 26px;
}

.browser-entity {
	padding: 4px;
}

.notes {
	font-size: 12px;
	text-overflow: ellipsis;
	white-space: nowrap;
	overflow: hidden;
}
</style>
