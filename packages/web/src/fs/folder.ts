import { Browser } from './browser';
import { router } from '../route';
import { store } from '../store';
import { resetSearch } from '../utils/entity';
import { Entity } from './entity';
import { FolderOptions, BrowserType, EntityTypes, FolderType, EntityOptions } from './interface';
import { reactive, watch } from 'vue';

export class Folder<T extends FolderType = FolderType> extends Entity implements FolderOptions<T, Browser | Folder> {
	type: T;
	parent: T extends 'root' ? undefined : string;
	children: Record<string, Browser | Folder> = {};

	constructor(opts: FolderOptions<T, Browser | Folder> & EntityOptions) {
		super(opts);
		this.type = opts.type;
		this.parent = opts.parent;
		this.children = opts.children;

		for (const key in this.children) {
			if (Object.prototype.hasOwnProperty.call(this.children, key)) {
				const child = this.children[key];
				if (child.type === 'browser') {
					this.children[key] = new Browser(child);
				} else {
					this.children[key] = new Folder(child);
				}
			}
		}
	}

	listChildren(): (Browser | Folder)[] {
		return Object.values(this.children);
	}

	/**
	 *	获取文件夹
	 */
	static from(uid: string) {
		return uid === root().uid ? root() : root().find('folder', uid);
	}

	/** 递归查找 */
	find<T extends BrowserType | FolderType>(type: T, uid: string): T extends BrowserType ? Browser : Folder {
		let target = this.children[uid];
		if (target && target.type === type) {
			return target as any;
		} else {
			for (const key in this.children) {
				if (Object.prototype.hasOwnProperty.call(this.children, key)) {
					const child = this.children[key];
					if (child.type === 'folder') {
						const res = child.find(type, uid);
						target = target || res;
					}
				}
			}
		}

		return target as any;
	}

	findAll<T extends EntityTypes, E = T extends BrowserType ? Browser : Folder>(handler: (entity: E) => boolean): E[] {
		const list: E[] = [];

		for (const key in this.children) {
			if (Object.prototype.hasOwnProperty.call(this.children, key)) {
				const child = this.children[key];
				if (handler(child as any)) {
					list.push(child as any);
				}
				if (child.type === 'folder') {
					list.push(...child.findAll(handler));
				}
			}
		}

		return list;
	}

	/** 返回当前以及所以父文件夹 */
	flatParents(): Folder[] {
		let parents;
		if (this.parent) {
			const parent = Folder.from(this.parent);
			if (parent) {
				parents = parent.flatParents();
			}
		}
		return [...(parents || []), this];
	}

	location(): void {
		// 进入列表页
		router.push('/');
		// 关闭搜索模式
		resetSearch();
		// 设置当前文件夹
		store.render.browser.currentFolderUid = this.uid;
	}

	select(): void {
		store.render.browser.currentFolderUid = this.uid;
	}

	remove(): void {
		if (this.parent) {
			const parent = Folder.from(this.parent);

			if (parent) {
				Reflect.deleteProperty(parent.children, this.uid);
			}
		}
	}

	rename(name: string): void {
		this.name = name;
		this.renaming = false;
	}

	/** 将子项移动到指定索引位置 */
	moveChildToIndex(childUid: string, targetIndex: number): void {
		const entries = Object.entries(this.children);
		const sourceIndex = entries.findIndex(([uid]) => uid === childUid);
		if (sourceIndex === -1) return;

		const [entry] = entries.splice(sourceIndex, 1);
		// 限制目标索引范围
		const clampedIndex = Math.min(targetIndex, entries.length);
		entries.splice(clampedIndex, 0, entry);

		// 重建 children 保持顺序
		this.children = {};
		for (const [uid, child] of entries) {
			this.children[uid] = child;
		}
	}

	/** 将多个实体移入目标文件夹 */
	moveEntitiesToFolder(entityUids: string[], targetFolder: Folder): void {
		for (const uid of entityUids) {
			const entity = this.children[uid];
			if (!entity) continue;

			// 不能将文件夹移入自身或其子文件夹
			if (entity.type === 'folder' && targetFolder.uid === entity.uid) continue;

			// 从当前文件夹移除
			Reflect.deleteProperty(this.children, uid);

			// 添加到目标文件夹
			targetFolder.children[uid] = entity;

			// 更新 parent
			if (entity.type === 'browser') {
				(entity as Browser).parent = targetFolder.uid;
			} else if (entity.type === 'folder') {
				(entity as Folder).parent = targetFolder.uid;
			}
		}
	}
}

let _root: Folder | undefined;

/** 根目录 */
export const root = () => {
	if (_root) {
		return _root;
	} else {
		return (_root = reactive(new Folder(store.render.browser.root)));
	}
};

/** 实时存储文件树 */
watch(
	() => _root,
	() => {
		store.render.browser.root = JSON.parse(JSON.stringify(root));
	}
);
