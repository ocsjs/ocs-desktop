## [2.6.2](https://github.com/ocsjs/ocs-desktop/compare/2.6.0...2.6.2) (2024-02-28)


### Bug Fixes

* **app:** 提高应用权限，解决无法操作更新文件的BUG ([c20d7b7](https://github.com/ocsjs/ocs-desktop/commit/c20d7b7c2c856378041d62ea0c285390a8021230))
* **app:** 优化软件辅助功能 ([e258af0](https://github.com/ocsjs/ocs-desktop/commit/e258af02185c52024cd1ce5878a8f308348a6f01))



# [2.6.0](https://github.com/ocsjs/ocs-desktop/compare/2.5.2...2.6.0) (2024-02-26)


### Bug Fixes

* **web:** 忽略更换浏览器时出现的删除错误 ([c930d8b](https://github.com/ocsjs/ocs-desktop/commit/c930d8b7eb971203fe768dd2e084ca053b4fce43))


### Features

* 将更新页面修改成软件内弹窗 ([5bab185](https://github.com/ocsjs/ocs-desktop/commit/5bab185cf22b41d4f741d31fe8ada24175d135f9))
* **all:** 添加浏览器与软件的双向识别系统 ([844091b](https://github.com/ocsjs/ocs-desktop/commit/844091b13d1b64fae03ece0842ad063372cc2e29))
* **web:** 新增监控帧率选择 ([751c84c](https://github.com/ocsjs/ocs-desktop/commit/751c84c2994b06ab41524a5d907f6246830c1049))
* **web:** 优化更新页面 ([a4cd72f](https://github.com/ocsjs/ocs-desktop/commit/a4cd72fdb45d23ba275155104bb53de5c1e6b6fd))
* **web:** 优化监控帧率选择，优化监控获取算法 ([2d656b0](https://github.com/ocsjs/ocs-desktop/commit/2d656b0884ee67914d0df40aab6a153769961b21))


### Performance Improvements

* **app:** 优化软件辅助类型提升以及代码，使用反射技术实现API一致 ([6a761f8](https://github.com/ocsjs/ocs-desktop/commit/6a761f87e911059b0e5916c56ff28694b2edc4b5))
* **web:** 当软件已经设置浏览器路径后，初始化功能自动读取软件设置的浏览器路径 ([5b4d1e0](https://github.com/ocsjs/ocs-desktop/commit/5b4d1e05dbe3712c49a599cbf19494c7850ca93f))
* **web:** 添加应用中心添加其他拓展的教程方法 ([3e7d616](https://github.com/ocsjs/ocs-desktop/commit/3e7d61628bba30226933fd207c02ffe80765dd65))
* **web:** 优化用户脚本关闭提示 ([e1b7641](https://github.com/ocsjs/ocs-desktop/commit/e1b764166804b51a38c41af79faccab4fe0931cb))



## [2.5.2](https://github.com/ocsjs/ocs-desktop/compare/2.5.0...2.5.2) (2023-11-10)


### Bug Fixes

* 修复当拓展页面无法加载时不自动安装脚本的BUG ([9766c4a](https://github.com/ocsjs/ocs-desktop/commit/9766c4a9af04e4515955f37ec64c2c6e68b0703b))
* 修改默认侧边栏文字为展开状态，并优化样式 ([34106a8](https://github.com/ocsjs/ocs-desktop/commit/34106a841e84f4d8227148d0c5649800ecd42146))
* **web:** 修改删除间隔为200毫秒 ([5110ebf](https://github.com/ocsjs/ocs-desktop/commit/5110ebfe757ae4b3bd89ef75e8f7d94d1146b1fb))
* **web:** 优化错误处理 ([97e782b](https://github.com/ocsjs/ocs-desktop/commit/97e782b5dc725a8e988a4a3d66659efd31a93ce8))


### Features

* **web:** 优化批量操作，使得批量操作途中可以进行暂停 ([8fbee99](https://github.com/ocsjs/ocs-desktop/commit/8fbee99f4bc94f8a689e86799252713a88f058fc))



# [2.5.0](https://github.com/ocsjs/ocs-desktop/compare/2.4.7...2.5.0) (2023-11-04)


### Bug Fixes

* 只打包 ubuntu 系统的软件 ([6f06ab6](https://github.com/ocsjs/ocs-desktop/commit/6f06ab6f385476159bc09c346786fa6edb3a00fa))
* **app:** 添加验证码识别模块安装提示 ([d5dc301](https://github.com/ocsjs/ocs-desktop/commit/d5dc301b777b54bdd4d03feab2629ae7a7deea4b))


### Features

* 添加Github Action 自动打包功能 ([932b6a1](https://github.com/ocsjs/ocs-desktop/commit/932b6a1b19c64c64b8affed09e862c0d01c22ed8))
* 添加Github Action 自动打包功能 ([bd1d74c](https://github.com/ocsjs/ocs-desktop/commit/bd1d74c8abc7f3e8e9d7332a95024d8653f3c555))
* 添加Github Action 自动打包功能 ([c2632df](https://github.com/ocsjs/ocs-desktop/commit/c2632df5ba976d52d66fed51932dff84de105db8))



## [2.4.7](https://github.com/ocsjs/ocs-desktop/compare/2.4.2...2.4.7) (2023-11-03)


### Bug Fixes

* 优化夜间模式的颜色 ([2166616](https://github.com/ocsjs/ocs-desktop/commit/21666167490d6a0f7be021eef3f7899c5b8c0bbf))
* **app:** 优化网络卡顿时无法安装脚本的BUG ([77adbf9](https://github.com/ocsjs/ocs-desktop/commit/77adbf950cbfc8f461d6a990049659f850e07a86))
* **web:** 修复mac资源下载BUG，优化夜间样式 ([a8aa70d](https://github.com/ocsjs/ocs-desktop/commit/a8aa70d459edf1e2a0e6dc76dc12fb702edb9c76))


### Features

* 新增OCS桌面版 MAC 版本适配 ([da2e91a](https://github.com/ocsjs/ocs-desktop/commit/da2e91ab76dbf5884e8e3aaf87f27e23e871168b))
* **all:** 添加软件浏览器缓存路径修改功能 ([739c05a](https://github.com/ocsjs/ocs-desktop/commit/739c05a098034a7105845d53be88ea8c75bbe7c0))
* **script:** 新增OCS 桌面版 MAC 版本的 OCR 适配 ([1b5f72a](https://github.com/ocsjs/ocs-desktop/commit/1b5f72a909d355cf51d162fcbdf04c4cd15cfa83))
* **web:** 在批量启动方法中新增顺序启动和延时启动功能 ([e6da600](https://github.com/ocsjs/ocs-desktop/commit/e6da600dd03158c83637b55fe942bc967eada705))



## [2.4.2](https://github.com/ocsjs/ocs-desktop/compare/2.4.1...2.4.2) (2023-10-15)


### Bug Fixes

* **app:** 优化窗口大小调整功能 ([8e9860d](https://github.com/ocsjs/ocs-desktop/commit/8e9860dc81ae3cc4783d90f530fbce127b957fd8))



## [2.4.1](https://github.com/ocsjs/ocs-desktop/compare/2.4.0...2.4.1) (2023-09-24)


### Features

* **app:** 添加设置窗口大小功能，配合脚本使用 ([1b8c207](https://github.com/ocsjs/ocs-desktop/commit/1b8c207b57229aa55779afd39e1f7b6f6fc79f61))



# [2.4.0](https://github.com/ocsjs/ocs-desktop/compare/2.3.1...2.4.0) (2023-09-22)



## [2.3.1](https://github.com/ocsjs/ocs-desktop/compare/2.2.5...2.3.1) (2023-08-17)


### Bug Fixes

* **app:** 优化软件自动登录脚本，使用 page.fill 代替 page.click 防止用户保存密码导致浏览器自动填充密码造成密码2次输入。 ([12c34ff](https://github.com/ocsjs/ocs-desktop/commit/12c34ffc98def627c52220f46b79e982ad8f67b2))


### Features

* 优化侧边栏样式，优化脚本列表样式，新增脚本版本切换功能，优化脚本详情信息显示 ([678a133](https://github.com/ocsjs/ocs-desktop/commit/678a1335179f51521eac29be71f47c2a6a6e73f8))



## [2.2.5](https://github.com/ocsjs/ocs-desktop/compare/2.2.4...2.2.5) (2023-06-12)


### Bug Fixes

* update apis ([03d09f2](https://github.com/ocsjs/ocs-desktop/commit/03d09f2f99e29fbf2d96aa648ced18a70d381da1))



## [2.2.4](https://github.com/ocsjs/ocs-desktop/compare/2.2.3...2.2.4) (2023-06-12)


### Bug Fixes

* **web:** 优化资源加载器，因为多个版本无法检测导致浏览器加载很多脚本管理器 ([d006b0c](https://github.com/ocsjs/ocs-desktop/commit/d006b0c0c059d2184fc16c94c646a7f287ed87cf))



## [2.2.3](https://github.com/ocsjs/ocs-desktop/compare/2.2.2...2.2.3) (2023-05-31)


### Bug Fixes

* **web:** 修复加载本地脚本时应该指定为只有 .user.js 才能加载 ([8cc7114](https://github.com/ocsjs/ocs-desktop/commit/8cc71149b2e97084d35bacf3f40d2dd543fee20e))



## [2.2.2](https://github.com/ocsjs/ocs-desktop/compare/2.2.1...2.2.2) (2023-05-31)



## [2.2.1](https://github.com/ocsjs/ocs-desktop/compare/911ede6cea9fc7f11d972d5cba0d75e24a46de1e...2.2.1) (2023-05-31)


### Bug Fixes

* **all:** 优化浏览器启动以及各种加载逻辑 ([b00e72a](https://github.com/ocsjs/ocs-desktop/commit/b00e72a03d4df544ccfdf9c33ecc5de9cf42b689))
* **app:** 优化加载 args ([911ede6](https://github.com/ocsjs/ocs-desktop/commit/911ede6cea9fc7f11d972d5cba0d75e24a46de1e))
* **app:** 优化浏览器启动 ([4ab7484](https://github.com/ocsjs/ocs-desktop/commit/4ab74845892a4cb74e963329089cb5d3c18e51a5))
* **web:** 更新脚本猫搜索 ([a69d095](https://github.com/ocsjs/ocs-desktop/commit/a69d0958890edeff65c60bb5ff58a8ffe0a8359f))
* **web:** 修复当用户修改浏览器路径时旧版缓存与新版浏览器无法兼容使用的BUG ([1613f2b](https://github.com/ocsjs/ocs-desktop/commit/1613f2b8aa08f51d18738a5e0995138fe9f277db))
* **web:** 修复导出数据中的缓存路径是绝对路径导致其他电脑无法使用 ([decba81](https://github.com/ocsjs/ocs-desktop/commit/decba81d83b5e4442781f338011cd5818847e531))
* **web:** 优化软件数据导入 ([edec0c1](https://github.com/ocsjs/ocs-desktop/commit/edec0c19a06c579c1318f43bd4d83b91ae8a1c8f))


### Features

* **app:** 新增职教云-账号密码登录自动化脚本 ([685fcf5](https://github.com/ocsjs/ocs-desktop/commit/685fcf54feed8d5df09a557b6fa6e685a8a7e4a0))
* **app:** 新增智慧职教-账号密码登录自动化脚本 ([96d2eb1](https://github.com/ocsjs/ocs-desktop/commit/96d2eb1bfe6befd65dd71e527758ed58d71cf0fe))
* **web:** 添加浏览器缓存清除功能 ([52431c3](https://github.com/ocsjs/ocs-desktop/commit/52431c3f41a7cbc2f7168bbeba4f70c0e2e4a438))
* **web:** 新增可添加网络脚本的功能 ([e2919fe](https://github.com/ocsjs/ocs-desktop/commit/e2919fe894df82f663936926f5205d6fae890c8a))



