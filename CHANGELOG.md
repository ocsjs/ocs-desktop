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



