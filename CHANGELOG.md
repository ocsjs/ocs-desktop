## [2.9.33](https://github.com/ocsjs/ocs-desktop/compare/2.9.31...2.9.33) (2026-05-10)


### Bug Fixes

* **web:** 使用实时easy-us库，同步最新版本 ([2d122a8](https://github.com/ocsjs/ocs-desktop/commit/2d122a8c4193f2ba8259678d622edd88e7f75976))
* **web:** 移除初始化浏览器启动测试 ([da36a8d](https://github.com/ocsjs/ocs-desktop/commit/da36a8d3cee8f1904d207802ca2946b714998582))



## [2.13.0](https://github.com/ocsjs/ocs-desktop/compare/v2.12.0...v2.13.0) (2026-07-19)


### ✨ Features

* 新增全局Banner通知显示 ([9e0859f](https://github.com/ocsjs/ocs-desktop/commit/9e0859fa8eb69acd7ed221159a642377cfcb3253))
* 新增加密解密算法，并适配原方案。 ([4660b9e](https://github.com/ocsjs/ocs-desktop/commit/4660b9e7908e2a6b723256f14fcbc11d26379357))
* 新增脚本使用meta.js更新检测功能，如果版本不需要更新则直接跳过 ([4ca3147](https://github.com/ocsjs/ocs-desktop/commit/4ca3147607631733546e4cab66195f9c3d7f433e))
* 添加简洁模式 ([029a961](https://github.com/ocsjs/ocs-desktop/commit/029a961f55e64509d2da5a756d3e3db8525a1cb9))


### 🐛 Bug Fixes

* 修复开发环境下内容浏览器无法初始化的问题 ([04427aa](https://github.com/ocsjs/ocs-desktop/commit/04427aa1e5a8c14184bdfb3389744041decedd79))
* 修复批量创建浏览器出现多余配置的问题 ([2c7a54c](https://github.com/ocsjs/ocs-desktop/commit/2c7a54cee21b41a9893119b409d1bcf15697b8b1))
* 修复脚本meta.js更新检查功能，在指定版本时无法正确处理的问题 ([8186db7](https://github.com/ocsjs/ocs-desktop/commit/8186db7d098f00c1f942697bfc1d6bed7f0ce6fb))
* 修复软件无限关闭的BUG ([0fef8b8](https://github.com/ocsjs/ocs-desktop/commit/0fef8b8b2e344e5b15c59c2834cc93eab074fc53))
* 修复部分脚本作者头像无法显示的BUG ([9044a5c](https://github.com/ocsjs/ocs-desktop/commit/9044a5ca8e3befb70307d60e05eefc00552125a2))
* 分离环境检测功能、新增 AppInBrowser.vue 组件、修复浏览器中书签界面显示软件提示弹窗以及自动切换简洁模式的BUG ([7a86a66](https://github.com/ocsjs/ocs-desktop/commit/7a86a66b8b69ff1740156793509951ea790e3e5b))
* 更新 pnpm-lock.yaml 以包含 highlight.js 依赖 ([5ee825d](https://github.com/ocsjs/ocs-desktop/commit/5ee825d0f67614cc64a8c6fdaa94f141aa057f9f))


### ⚡ Performance

* 优化PR工作流、添加 separate-pull-requests 参数 ([4f6c730](https://github.com/ocsjs/ocs-desktop/commit/4f6c730a61ff0bcf77ac9c7a1efff95ef5e2bc58))
* 优化双模式下的环境检测功能 ([6e83254](https://github.com/ocsjs/ocs-desktop/commit/6e832545e3fa2a6ebb70a44b5c6c1479bed76c0a))
* 优化滑动框样式 ([8f03be8](https://github.com/ocsjs/ocs-desktop/commit/8f03be8aff06159e30bf56e05df1e6f38e95920a))
* 优化滚动条样式 ([f74a327](https://github.com/ocsjs/ocs-desktop/commit/f74a327fc59e1ca0c25bd58cbadfde131542ee6d))
* 优化用户脚本和浏览器的使用提示 ([dda0a42](https://github.com/ocsjs/ocs-desktop/commit/dda0a42ef7412381b1cf85ffc9dc1b223fe32cb2))
* 优化简洁模式Tab栏夜间模式显示、修复简洁模式点击启动会触发编辑功能的问题 ([44687a2](https://github.com/ocsjs/ocs-desktop/commit/44687a25e8c58b2ee884644eed8266c379c9470b))
* 优化自动化程序选择窗口 ([836be61](https://github.com/ocsjs/ocs-desktop/commit/836be61ff8bfbbc1eaf8aa8117bcb6ce9759e39e))
* 优化自动程序选择器，优化样式 ([2d2f07f](https://github.com/ocsjs/ocs-desktop/commit/2d2f07f66aba70fb5472b6b296c802b544ac3f38))
* 优化设置界面文案 ([f28d3e6](https://github.com/ocsjs/ocs-desktop/commit/f28d3e65a9b05a5ac5b6b5a70b9a1728256d859b))
* 修复项目类型报错 ([9739ddb](https://github.com/ocsjs/ocs-desktop/commit/9739ddb190f722945a9b9b54ddd968d83543eb8f))
* 分离环境检测、优化列表选择器、简洁模式设置可查看路径 ([b00fba3](https://github.com/ocsjs/ocs-desktop/commit/b00fba3c5c86829d4cbee515532a60c5d2b6d647))
* 创建浏览器时自动弹出命名步骤和自动程序设置步骤 ([8cd59a7](https://github.com/ocsjs/ocs-desktop/commit/8cd59a75114e9ecf478d7e9f92b2179b1a3f0581))
* 增加圆角、阴影、背景颜色、优化各种组件样式 ([3d9a4ed](https://github.com/ocsjs/ocs-desktop/commit/3d9a4edb9ef26d822472d9f8b2bdfd71ad42f2b7))
* 增加本地图标接口的缓存功能 ([ce360d4](https://github.com/ocsjs/ocs-desktop/commit/ce360d4d68ab6ccb158c2a524a6708129aa5c890))
* 增加自动化程序的输入类型、属性等 ([1b03a8a](https://github.com/ocsjs/ocs-desktop/commit/1b03a8a63c752c9e40bf3adbfc38c0260a3ba1cf))
* 将脚本搜索功能集成在按钮上，不再使用Tab栏展示，并且添加脚本列表分页功能 ([ca001ae](https://github.com/ocsjs/ocs-desktop/commit/ca001aecfd7ed5652834d2625fde18d4e094fdda))
* 将自动化脚本文案更改：自动化程序，防止歧义 ([f6269e8](https://github.com/ocsjs/ocs-desktop/commit/f6269e897380e613f8e614f449b02c4c0207236b))
* 新增 markdown 代码高亮显示功能 ([0bb7782](https://github.com/ocsjs/ocs-desktop/commit/0bb77826c3f9456cb278a5d1954acc13e9f4c509))
* 新增使用提示Alert关闭功能、新增简洁模式Tab栏置顶功能 ([6dfd16f](https://github.com/ocsjs/ocs-desktop/commit/6dfd16f2860babd8f010140bb99af03143d03b25))
* 新增软件设置到简洁模式中、并且优化样式和代码 ([1bccbc0](https://github.com/ocsjs/ocs-desktop/commit/1bccbc02a428bfb1faa0b8b29df86619d851eb2c))
* 新增项目 SKILL ([dcffc5c](https://github.com/ocsjs/ocs-desktop/commit/dcffc5c611aa8fee6420e2623ceb08eb11c53133))
* 浏览器操作抽屉改成弹窗界面，并且优化样式主次分明 ([fb4305c](https://github.com/ocsjs/ocs-desktop/commit/fb4305cc2f65c2086bdb3650e0f5ef0889fa8230))
* 添加简洁模式的右键菜单提示 ([c3e7c1e](https://github.com/ocsjs/ocs-desktop/commit/c3e7c1e96ba6481625b8fee42f817744e034329d))
* 添加网络脚本弹窗中现实官方脚本列表的功能 ([5119a33](https://github.com/ocsjs/ocs-desktop/commit/5119a330ed1eb59e4f3658ad5f5dca767398bdc4))
* 添加脚本信息间隔检测、防止频繁检测 ([9b46fd9](https://github.com/ocsjs/ocs-desktop/commit/9b46fd9efd075637051aa3a0c3d54f78af9ebc89))
* 添加自动化程序的网站图标显示 ([add17dd](https://github.com/ocsjs/ocs-desktop/commit/add17dd965b90ffdd9d4d944e6a66b1bcc174a44))

## [2.12.0](https://github.com/ocsjs/ocs-desktop/compare/v2.11.1...v2.12.0) (2026-06-17)


### ✨ Features

* 新增鼠标拖拽排序以及移入移出文件夹功能 ([cdcd0e5](https://github.com/ocsjs/ocs-desktop/commit/cdcd0e5d061eb4cef3941f1f0ae9ee2f9f91fe8d))
* 添加新 API StatusBar 可为当前状态操作提供状态栏显示 ([eddbec0](https://github.com/ocsjs/ocs-desktop/commit/eddbec03b14da2b7aa9568b81fd41e62f3b028f7))


### 🐛 Bug Fixes

* 修复导航界面无法看到备注的BUG ([72bdf3b](https://github.com/ocsjs/ocs-desktop/commit/72bdf3b40ab725e17d7770a619ef61d8bd43505e))
* 修复拖拽移动浏览器后数据错误BUG ([c3df609](https://github.com/ocsjs/ocs-desktop/commit/c3df609780655b001a3d8e2095b0aea9c9101dfd))
* 修复本地开发时自动启动网页调试的BUG ([af9e21b](https://github.com/ocsjs/ocs-desktop/commit/af9e21b55ad120f9dda9fb0802f0f3ce5e6e53be))
* 修复点击启动按钮会触发编辑的BUG ([2544236](https://github.com/ocsjs/ocs-desktop/commit/2544236379d12795d992e567f1dc8cf127d2cbdb))


### ⚡ Performance

* 优化OCS弹窗配置里的样式，懒加载配置信息 ([e7c60d6](https://github.com/ocsjs/ocs-desktop/commit/e7c60d6d8fdc0b856ca62dcc5aab1a578c4bf464))
* 优化OCS弹窗配置里的样式，添加配置使用说明 ([594a582](https://github.com/ocsjs/ocs-desktop/commit/594a5825119ad09bdb3f4b8105c855dba3673a96))
* 优化新建浏览器和文件夹名字重复的问题，额外新增序号 ([eedf2ab](https://github.com/ocsjs/ocs-desktop/commit/eedf2ab081cc3e86b1b6173e0ca8c9afa33c11cd))
* 优化浏览器环境异常检测样式 ([e6c392b](https://github.com/ocsjs/ocs-desktop/commit/e6c392b68839148af1a4513df6c90645b3dd9345))
* 优化状态栏API，添加多种不同类型 ([7c80f27](https://github.com/ocsjs/ocs-desktop/commit/7c80f27b495f87babcf00ea540d3b94c76377eee))
* 优化界面显示，添加动画，优化操作添加更多下拉菜单选项 ([63abfcc](https://github.com/ocsjs/ocs-desktop/commit/63abfcc67775ddd27f53d753973f2ab13cbc6a54))
* 修改浏览器基础信息获取方式，新增接口获取方法 ([8065f47](https://github.com/ocsjs/ocs-desktop/commit/8065f47f8b7aba705e42fec1fb6353e0b3c9f049))
* 修改状态栏位置到 Ttile 顶部栏 ([1baf40e](https://github.com/ocsjs/ocs-desktop/commit/1baf40e5a0565ed3c8078f1f1f187c8602eb044e))
* 将操作和列表区域区分开 ([f735f5f](https://github.com/ocsjs/ocs-desktop/commit/f735f5f285900e9a09113a8dc8eb3654623d611a))
* 当路径栏隐藏时，显示信息统计栏包括浏览器总数，标签总数，脚本总数等等 ([d73bf14](https://github.com/ocsjs/ocs-desktop/commit/d73bf14ba415cad7c3483376825987b1a35b05d2))
* 添加右键菜单的操作图标 ([dede775](https://github.com/ocsjs/ocs-desktop/commit/dede775f32295af0716b3b28addef793c9a3bce9))
* 添加鼠标右键选中浏览器特殊样式 ([b6b6172](https://github.com/ocsjs/ocs-desktop/commit/b6b6172029cc7d9a677f44a2081ad6b43b8c3192))
* 给批量操作选项添加特定图标 ([5faf5d0](https://github.com/ocsjs/ocs-desktop/commit/5faf5d0ee0f071fb1c6bf88d42cdd8755ae5b69b))

## [2.11.1](https://github.com/ocsjs/ocs-desktop/compare/v2.11.0...v2.11.1) (2026-06-10)


### 🐛 Bug Fixes

* 修复导航界面无法显示网站图标的问题 ([1bdd2d7](https://github.com/ocsjs/ocs-desktop/commit/1bdd2d7e4d3838192c5c8bb3f8de6ce6a01839d3))

## [2.11.0](https://github.com/ocsjs/ocs-desktop/compare/v2.10.0...v2.11.0) (2026-06-10)


### ✨ Features

* **ci:** 添加 CI 和安全检查工作流 ([5321b94](https://github.com/ocsjs/ocs-desktop/commit/5321b94172a17cf742ee298e30082eef45f4453a))
* **web:** 使用现代暗色主题重新设计书签页面 ([e083b99](https://github.com/ocsjs/ocs-desktop/commit/e083b99a612bf4b12e711e0320da8ace01567159))
* 项目更新与 CI 工作流添加 ([b21a67a](https://github.com/ocsjs/ocs-desktop/commit/b21a67af520eae938d91f6bc98dfe57ecee6e4f8))


### 🐛 Bug Fixes

* **app:** 修复本地脚本安装死循环及开发环境内置浏览器不可用 ([c4fd159](https://github.com/ocsjs/ocs-desktop/commit/c4fd1594f1b73dcff7d0f7dc40587d93dffc0ad9))
* **app:** 修复本地脚本安装死循环及开发环境内置浏览器不可用 ([fd2e0da](https://github.com/ocsjs/ocs-desktop/commit/fd2e0da6a508e5e01855c668be2e66b202ce1e6e))
* **ci:** 添加 issues 和 pull-requests 写权限修复 label 移除错误 ([796621e](https://github.com/ocsjs/ocs-desktop/commit/796621e1b3b33440f5dd9eb09d2a1df42dc3207b))
* **web:** 使用实时easy-us库，同步最新版本 ([2d122a8](https://github.com/ocsjs/ocs-desktop/commit/2d122a8c4193f2ba8259678d622edd88e7f75976))
* **web:** 修复 Mac 系统 favicon 图标显示问题 ([adee497](https://github.com/ocsjs/ocs-desktop/commit/adee49783dfd518507a48eb866ce2b5af8be6d0a))
* **web:** 修复书签页面安装后无法访问的问题 ([291938f](https://github.com/ocsjs/ocs-desktop/commit/291938f50d94ac4077f44e0db6636fa9031c8c1c))
* **web:** 移除初始化浏览器启动测试 ([da36a8d](https://github.com/ocsjs/ocs-desktop/commit/da36a8d3cee8f1904d207802ca2946b714998582))
* 修复监控和开发脚本相关问题 ([3e344e9](https://github.com/ocsjs/ocs-desktop/commit/3e344e985b6b01fb122ea8ee62be34c33a6779b3))


### 📝 Documentation

* 更新 README 以反映当前开发工作流 ([84072cb](https://github.com/ocsjs/ocs-desktop/commit/84072cb09026690ebdce9fe6aeccaab92473b7ff))


### ♻️ Refactoring

* **ci:** 分离 Release PR 创建和 Release 发布流程 ([c78fc6b](https://github.com/ocsjs/ocs-desktop/commit/c78fc6b3cb93574c8c35326f0bdb6626b2b8b82b))
* 重构项目架构 ([0db2ae6](https://github.com/ocsjs/ocs-desktop/commit/0db2ae6481f362fa6c799fa08c2767e7aa9ae7f1))

## [2.9.31](https://github.com/ocsjs/ocs-desktop/compare/2.9.30...2.9.31) (2025-11-18)



## [2.10.0](https://github.com/ShyButHandsome/ocs-desktop/compare/v2.9.31...v2.10.0) (2026-03-02)


### ✨ Features

* **ci:** 添加 CI 和安全检查工作流 ([5321b94](https://github.com/ShyButHandsome/ocs-desktop/commit/5321b94172a17cf742ee298e30082eef45f4453a))
* **web:** 使用现代暗色主题重新设计书签页面 ([e083b99](https://github.com/ShyButHandsome/ocs-desktop/commit/e083b99a612bf4b12e711e0320da8ace01567159))
* 项目更新与 CI 工作流添加 ([b21a67a](https://github.com/ShyButHandsome/ocs-desktop/commit/b21a67af520eae938d91f6bc98dfe57ecee6e4f8))


### 🐛 Bug Fixes

* **ci:** 添加 issues 和 pull-requests 写权限修复 label 移除错误 ([796621e](https://github.com/ShyButHandsome/ocs-desktop/commit/796621e1b3b33440f5dd9eb09d2a1df42dc3207b))
* **web:** 修复 Mac 系统 favicon 图标显示问题 ([adee497](https://github.com/ShyButHandsome/ocs-desktop/commit/adee49783dfd518507a48eb866ce2b5af8be6d0a))
* **web:** 修复书签页面安装后无法访问的问题 ([291938f](https://github.com/ShyButHandsome/ocs-desktop/commit/291938f50d94ac4077f44e0db6636fa9031c8c1c))
* 修复监控和开发脚本相关问题 ([3e344e9](https://github.com/ShyButHandsome/ocs-desktop/commit/3e344e985b6b01fb122ea8ee62be34c33a6779b3))


### 📝 Documentation

* 更新 README 以反映当前开发工作流 ([84072cb](https://github.com/ShyButHandsome/ocs-desktop/commit/84072cb09026690ebdce9fe6aeccaab92473b7ff))


### ♻️ Refactoring

* **ci:** 分离 Release PR 创建和 Release 发布流程 ([c78fc6b](https://github.com/ShyButHandsome/ocs-desktop/commit/c78fc6b3cb93574c8c35326f0bdb6626b2b8b82b))
* 重构项目架构 ([0db2ae6](https://github.com/ShyButHandsome/ocs-desktop/commit/0db2ae6481f362fa6c799fa08c2767e7aa9ae7f1))

## [2.9.30](https://github.com/ocsjs/ocs-desktop/compare/2.9.28...2.9.30) (2025-11-16)



## [2.9.28](https://github.com/ocsjs/ocs-desktop/compare/2.9.27...2.9.28) (2025-10-25)



## [2.9.27](https://github.com/ocsjs/ocs-desktop/compare/2.9.26...2.9.27) (2025-10-25)



## [2.9.26](https://github.com/ocsjs/ocs-desktop/compare/2.9.25...2.9.26) (2025-10-24)


### Bug Fixes

* 修复git release txt 下载路径不正确的BUG ([f5fdbf2](https://github.com/ocsjs/ocs-desktop/commit/f5fdbf2fdd740eaa54f9e0247c3d478a82120a09))



## [2.9.25](https://github.com/ocsjs/ocs-desktop/compare/2.9.24...2.9.25) (2025-10-24)


### Bug Fixes

* 修复文件未上传到github release 的BUG ([b5f5ffe](https://github.com/ocsjs/ocs-desktop/commit/b5f5ffeb762ed6e74bb9338c6fcfd714e269891b))



## [2.9.24](https://github.com/ocsjs/ocs-desktop/compare/2.9.23...2.9.24) (2025-10-24)



## [2.9.23](https://github.com/ocsjs/ocs-desktop/compare/2.9.22...2.9.23) (2025-10-24)



## [2.9.22](https://github.com/ocsjs/ocs-desktop/compare/2.9.21...2.9.22) (2025-10-24)



## [2.9.21](https://github.com/ocsjs/ocs-desktop/compare/2.9.20...2.9.21) (2025-10-24)



## [2.9.20](https://github.com/ocsjs/ocs-desktop/compare/2.9.19...2.9.20) (2025-10-24)



## [2.9.19](https://github.com/ocsjs/ocs-desktop/compare/2.9.18...2.9.19) (2025-10-24)



## [2.9.18](https://github.com/ocsjs/ocs-desktop/compare/2.9.10...2.9.18) (2025-10-23)


### Bug Fixes

* 尝试修复监控无法使用的BUG ([731c9f3](https://github.com/ocsjs/ocs-desktop/commit/731c9f39b87b16ace5ddd68b379a6dce2b8bdcca))
* 修复软件关闭前数据无法正常保存的BUG ([fdcca3c](https://github.com/ocsjs/ocs-desktop/commit/fdcca3c3d3d87742900ab733a10630d252be2bfd))
* 修复OCS配置开关数据不同步的BUG ([b22cb83](https://github.com/ocsjs/ocs-desktop/commit/b22cb83d0eda8ce560a2017fc0c789d6cc5e1834))
* 修改全部页面为懒加载，修复vue修改无法立即显现的BUG ([566ae9c](https://github.com/ocsjs/ocs-desktop/commit/566ae9ce8fee0070241b20bb847b2e1d7a71371e))


### Performance Improvements

* 添加监控窗口提示动态显示 ([e69977a](https://github.com/ocsjs/ocs-desktop/commit/e69977af7746165c0bbd1e21abe79eaf55c42ed4))



## [2.9.10](https://github.com/ocsjs/ocs-desktop/compare/2.9.9...2.9.10) (2025-10-14)


### Bug Fixes

* 取消安装位置修改功能，防止用户随意修改安装位置导致的一系列问题 ([dad972d](https://github.com/ocsjs/ocs-desktop/commit/dad972de87a2a18f2f287cfa8a682c05ea991835))



## [2.9.9](https://github.com/ocsjs/ocs-desktop/compare/2.9.8...2.9.9) (2025-10-12)



## [2.9.8](https://github.com/ocsjs/ocs-desktop/compare/2.9.6...2.9.8) (2025-10-12)


### Bug Fixes

* 修复英文环境下无法安装脚本的BUG ([2abb065](https://github.com/ocsjs/ocs-desktop/commit/2abb065ea9f30e2d960dc4a43d448813cc046622))
* 修复MAC无法解析本地浏览器版本，以及解压内置浏览器错误的BUG ([17e039b](https://github.com/ocsjs/ocs-desktop/commit/17e039bf02a0d1bbf19ce194b1ded0804657c1b7))



## [2.9.6](https://github.com/ocsjs/ocs-desktop/compare/2.9.5...2.9.6) (2025-10-10)


### Bug Fixes

* 持续修复mac和linux版本无法读取到内置浏览器的BUG ([97e7489](https://github.com/ocsjs/ocs-desktop/commit/97e7489913a3aa3da2d0fd9e2613cacfb121f663))



## [2.9.5](https://github.com/ocsjs/ocs-desktop/compare/2.9.4...2.9.5) (2025-10-10)


### Bug Fixes

* 持续修复mac和linux版本无法读取到内置浏览器的BUG ([05ccfa9](https://github.com/ocsjs/ocs-desktop/commit/05ccfa9fa0a6ed72024eb6fbb6c0cdd116fe3393))



## [2.9.4](https://github.com/ocsjs/ocs-desktop/compare/2.9.3...2.9.4) (2025-10-10)


### Bug Fixes

* 修复mac和linux版本无法读取到内置浏览器的BUG ([f59b172](https://github.com/ocsjs/ocs-desktop/commit/f59b17262a560c2d74f01b04c98fa379fbd62818))



## [2.9.3](https://github.com/ocsjs/ocs-desktop/compare/2.9.2...2.9.3) (2025-10-09)


### Bug Fixes

* 修复环境监测时读取本地路径为空报错的BUG ([27d7f20](https://github.com/ocsjs/ocs-desktop/commit/27d7f208d14feff9e0786166a30f1262903f1a42))



## [2.9.2](https://github.com/ocsjs/ocs-desktop/compare/2.9.0...2.9.2) (2025-10-08)


### Bug Fixes

* 修复软件更新文件无法访问，导致软件被删除的BUG ([8f9eb62](https://github.com/ocsjs/ocs-desktop/commit/8f9eb629796d6131273a9ff168ceeb3111689fc8))
* 修复软件无法同步的BUG，优化OCS配置文案 ([4fde7c7](https://github.com/ocsjs/ocs-desktop/commit/4fde7c7454c52b63c54071045528a9d750b38318))



# [2.9.0](https://github.com/ocsjs/ocs-desktop/compare/2.8.21...2.9.0) (2025-10-07)


### Bug Fixes

* 添加应用中心界面其他拓展加载方法动态文案 ([d013408](https://github.com/ocsjs/ocs-desktop/commit/d0134083159bc02ca2d1a9db92b6b422aadc0ca5))
* 修复切换版本后依然无法安装指定版本的BUG ([9cf85e4](https://github.com/ocsjs/ocs-desktop/commit/9cf85e4520f1a5aa3c2d9917063b821021a8be1f))
* 修复油猴拓展无法降级的BUG ([2abcf6a](https://github.com/ocsjs/ocs-desktop/commit/2abcf6a6599ca53eb70e6318bfbaabf1b7775354))
* 修复资源下载器文件判断问题 ([e8fae55](https://github.com/ocsjs/ocs-desktop/commit/e8fae5576b7b57c2225ea485e93df909111b97f0))
* 修改监控教程文案 ([8d65e47](https://github.com/ocsjs/ocs-desktop/commit/8d65e47acff88e038bce6628f0c198da593372de))
* 优化资源加载接口的缓存功能，防止多次重复加载 ([4e9a1f9](https://github.com/ocsjs/ocs-desktop/commit/4e9a1f941a8d7d3da872998117abb2af9b8bf54d))


### Features

* 添加各个页面的动态说明信息更新/显示功能 ([564b9b8](https://github.com/ocsjs/ocs-desktop/commit/564b9b8b79d9da96ba715812d9327f48fdc491ec))
* 添加环境监测功能，一键修复功能 ([54b47c4](https://github.com/ocsjs/ocs-desktop/commit/54b47c4a661f951e00a8368ffe9f791f075aa212))
* 添加同步开关读取接口，防止非软件辅助页面OCS脚本同步配置 ([9d9b4f1](https://github.com/ocsjs/ocs-desktop/commit/9d9b4f12d4cf8aa9783a10469d4a16f9dfed6016))
* 重构初始化设置功能，提供一键修复各种问题的功能，包括浏览器版本和拓展版本自动修复 ([2277c04](https://github.com/ocsjs/ocs-desktop/commit/2277c04169e4edba79ee0302641f63582d235a31))


### Performance Improvements

* 添加浏览器路径自定义开关按钮，防止小白误修改 ([df2b952](https://github.com/ocsjs/ocs-desktop/commit/df2b9529bb21fa3633821a01ba7af545cbf827dc))



## [2.8.21](https://github.com/ocsjs/ocs-desktop/compare/2.8.19...2.8.21) (2025-09-30)


### Bug Fixes

* 优化脚本主页和链接打开方式 ([e7903de](https://github.com/ocsjs/ocs-desktop/commit/e7903ded373eed467445d8fa665eb1f6c6290ea2))



## [2.8.19](https://github.com/ocsjs/ocs-desktop/compare/2.8.14...2.8.19) (2025-09-30)


### Bug Fixes

* 添加更多错误信息 ([6fa9d59](https://github.com/ocsjs/ocs-desktop/commit/6fa9d5970f8da4b8833d6651437139228926ea95))
* 修复MAC和Linux版本没有内置浏览器的BUG ([90cd314](https://github.com/ocsjs/ocs-desktop/commit/90cd314ab5a0ea65e00be78dff39e9a1b4caef41))


### Features

* 优化用户脚本列表页面 ([e8a1de4](https://github.com/ocsjs/ocs-desktop/commit/e8a1de48dff1d97fbedf52e04c8b759983415665))


### Performance Improvements

* 添加元素查找超时错误翻译 ([76812e0](https://github.com/ocsjs/ocs-desktop/commit/76812e0bbfdd85d1ed239c0d4d3d40a4e0216dcb))
* 优化本地脚本不存在提示 ([1483618](https://github.com/ocsjs/ocs-desktop/commit/14836187d746243ba009d750807ea4dc011d1567))



## [2.8.14](https://github.com/ocsjs/ocs-desktop/compare/2.8.12...2.8.14) (2025-09-26)


### Bug Fixes

* 修复导航页全部图标无法显示的BUG ([fa53c26](https://github.com/ocsjs/ocs-desktop/commit/fa53c26135efeed7b25f2ab5617f29b972dc9e59))


### Features

* 添加批量删除浏览器标签功能 ([4ab79a1](https://github.com/ocsjs/ocs-desktop/commit/4ab79a1dc34c6887efd6134580ef3d30e3b069c9))



## [2.8.12](https://github.com/ocsjs/ocs-desktop/compare/2.8.10...2.8.12) (2025-09-26)


### Bug Fixes

* 添加拓展版本检测，版本低于MV2强制退出 ([608e482](https://github.com/ocsjs/ocs-desktop/commit/608e482ace23c914b14751b175da3e9459fb235f))
* 修复拓展在开启开发者后无法使用的BUG，优化插件安装流程 ([b7b329a](https://github.com/ocsjs/ocs-desktop/commit/b7b329a41fb563f27d7a01439a6f03a659737992))



## [2.8.10](https://github.com/ocsjs/ocs-desktop/compare/2.8.9...2.8.10) (2025-09-26)



## [2.8.9](https://github.com/ocsjs/ocs-desktop/compare/2.8.8...2.8.9) (2025-09-25)



## [2.8.8](https://github.com/ocsjs/ocs-desktop/compare/2.8.7...2.8.8) (2025-09-25)



## [2.8.7](https://github.com/ocsjs/ocs-desktop/compare/2.8.5...2.8.7) (2025-09-25)


### Bug Fixes

* 优化脚本安装逻辑，兼容油猴英文安装按钮 ([1457f0f](https://github.com/ocsjs/ocs-desktop/commit/1457f0fb44d094ada421ef517be59812a3d30561))


### Performance Improvements

* 添加错误信息动态修改功能 ([1e83f94](https://github.com/ocsjs/ocs-desktop/commit/1e83f94c92afb3a4bc434afb1ad3355756a67de2))



## [2.8.5](https://github.com/ocsjs/ocs-desktop/compare/2.8.4...2.8.5) (2025-06-15)


### Bug Fixes

* 添加 lock 文本进行版本控制 ([dde388f](https://github.com/ocsjs/ocs-desktop/commit/dde388fc4f186aeab0f3293259148cca790597f8))
* **script:** 修复存储监听变化自动保存功能 ([498e444](https://github.com/ocsjs/ocs-desktop/commit/498e44444e3cd5cded2de653f2c81e2c1e39dccb))



## [2.8.4](https://github.com/ocsjs/ocs-desktop/compare/2.8.3...2.8.4) (2025-06-07)


### Features

* 对数据加密功能添加开启按钮，不强制加密 ([3215878](https://github.com/ocsjs/ocs-desktop/commit/3215878298ab70c6a94f3a87fd7d1a07c5dfc10b))



## [2.8.3](https://github.com/ocsjs/ocs-desktop/compare/2.8.2...2.8.3) (2025-06-03)


### Performance Improvements

* 浏览器路径添加更明显的下拉框提示 ([ebffd24](https://github.com/ocsjs/ocs-desktop/commit/ebffd249550e5d3c9ab1faf31add5be2bea3c36e))



## [2.8.2](https://github.com/ocsjs/ocs-desktop/compare/2.8.1...2.8.2) (2025-06-03)



## [2.8.1](https://github.com/ocsjs/ocs-desktop/compare/2.8.0...2.8.1) (2025-06-03)


### Bug Fixes

* 尝试修复 MacOS 在 github ci 中的错误 ([626b8e6](https://github.com/ocsjs/ocs-desktop/commit/626b8e697805b8ab10bb0e503dd7bc97c6a70931))



# [2.8.0](https://github.com/ocsjs/ocs-desktop/compare/2.7.20...2.8.0) (2025-06-03)


### Bug Fixes

* 兼容mac监控功能使用提示 ([1bbf3bf](https://github.com/ocsjs/ocs-desktop/commit/1bbf3bfad8c297d797754f529f60a9cba21a95cc))
* 添加异常报错捕获 ([9eb1e30](https://github.com/ocsjs/ocs-desktop/commit/9eb1e30969b037e9acca33f60db5abc9eac952de))
* 修复选择浏览器路径后无法自动清理缓存的BUG ([0174baa](https://github.com/ocsjs/ocs-desktop/commit/0174baab42ef71bcc88a685913677c58fdee3801))
* 优化浏览器路径配置后移除缓存逻辑 ([79c9978](https://github.com/ocsjs/ocs-desktop/commit/79c997856319f3696b8c2047b04c9b35e1b5c193))


### Features

* 添加自动构建内置浏览器功能 ([c1cdc5f](https://github.com/ocsjs/ocs-desktop/commit/c1cdc5fd128c0bef8ae68ff2f155fe63fe89c930))
* 新增软件内置谷歌浏览器-ChromeForTest ([a38b8b3](https://github.com/ocsjs/ocs-desktop/commit/a38b8b3c8e67f148a4a0beb14397e3c5773a4839))


### Performance Improvements

* 解决浏览器路径缓存清空有弹窗闪过,将适当延迟弹窗显示时间 ([41c0067](https://github.com/ocsjs/ocs-desktop/commit/41c0067d0ede741707398512e93f82c11f64161a))



## [2.7.20](https://github.com/ocsjs/ocs-desktop/compare/2.7.18...2.7.20) (2025-05-12)


### Performance Improvements

* 优化Edge异常启动解决方法 ([df2442c](https://github.com/ocsjs/ocs-desktop/commit/df2442c8e5a2228a8b0429e617c7793e46ef26b1))
* 在软件设置浏览器路径中添加自动浏览器路径填写提示菜单 ([665826a](https://github.com/ocsjs/ocs-desktop/commit/665826ad84a02876bbb2847b4ea110ffeb8a7b33))



## [2.7.18](https://github.com/ocsjs/ocs-desktop/compare/2.7.17...2.7.18) (2025-05-12)


### Bug Fixes

* 修复OCS软件标签页无法访问的BUG ([c751c28](https://github.com/ocsjs/ocs-desktop/commit/c751c2861bdcc0a40bbdb46b087415d4deec30c5))



## [2.7.17](https://github.com/ocsjs/ocs-desktop/compare/2.7.5...2.7.17) (2025-05-11)


### Bug Fixes

* 持续优化错误处理 ([6555bcb](https://github.com/ocsjs/ocs-desktop/commit/6555bcb48497460c42e008c4cef248b38ddf4e82))
* 如果本地脚本被删除后启动时添加提示 ([f242225](https://github.com/ocsjs/ocs-desktop/commit/f24222546212f2771c63c35d20d7f6077d10f7c3))
* 修复浏览器标签添加的时候会报错的BUG ([5c0aa79](https://github.com/ocsjs/ocs-desktop/commit/5c0aa79d9be199e2d15194a820ab8a2f741677ee))
* 修复职教云新版无法自动登录的BUG ([c3248a0](https://github.com/ocsjs/ocs-desktop/commit/c3248a08b332a0261919fd939057e184ea8b8551))
* 移除多余的第三方依赖库 ([70c234f](https://github.com/ocsjs/ocs-desktop/commit/70c234f5eb21bd49b9549d614b14d1e634006ff4))
* 优化错误处理 ([c9399f9](https://github.com/ocsjs/ocs-desktop/commit/c9399f96f7b150a9e61457b87d282e88a1b3423f))
* 优化浏览器自动安装脚本逻辑 ([2a6bdb6](https://github.com/ocsjs/ocs-desktop/commit/2a6bdb633a93659ef2957048ac19b4822cdc625b))
* 优化应用列表内容样式，支持小尺寸页面 ([b74c4cd](https://github.com/ocsjs/ocs-desktop/commit/b74c4cd4a4432d0a62a8d3f27118551c4b16160a))


### Performance Improvements

* 持续对小尺寸界面进行优化，添加部分按钮的图标 ([aa6e8ce](https://github.com/ocsjs/ocs-desktop/commit/aa6e8ce5075d1ad327eae8edaf54716554976bac))
* 当浏览器异常关闭时提示解决方法 ([44a4dda](https://github.com/ocsjs/ocs-desktop/commit/44a4ddaedb115235d9eeae4de7c32542f6c8b919))
* 优化一键初始化提示 ([c4249a4](https://github.com/ocsjs/ocs-desktop/commit/c4249a4d86989af079b9b010c64c0380bed4f1da))



## [2.7.5](https://github.com/ocsjs/ocs-desktop/compare/2.7.4...2.7.5) (2025-05-06)


### Bug Fixes

* **script:** 更新底层依赖，修复大部分用户edge浏览器无法启动的BUG，移除多余依赖 ([daea8de](https://github.com/ocsjs/ocs-desktop/commit/daea8de501761e5afe6bfee1af850996fd2de259))



## [2.7.4](https://github.com/ocsjs/ocs-desktop/compare/2.7.1...2.7.4) (2025-05-05)


### Bug Fixes

* 修复监控帧率设置读取问题 ([056ac10](https://github.com/ocsjs/ocs-desktop/commit/056ac109f9dddec28c14300f2e94a8a2a50c83fc))
* 修复数据加密后主进程无法读取渲染进程数据问题 ([1e76983](https://github.com/ocsjs/ocs-desktop/commit/1e76983bf195ef3b64cb50740c1256801341ad42))
* 优化脚本自动更新逻辑，添加强制更新脚本开关 ([b6a00f5](https://github.com/ocsjs/ocs-desktop/commit/b6a00f50964b578df5dcba5cb1960be0035f7d61))



## [2.7.1](https://github.com/ocsjs/ocs-desktop/compare/2.7.0...2.7.1) (2025-04-30)


### Bug Fixes

* 修复上个版本软件无法自动更新的BUG ([75a4535](https://github.com/ocsjs/ocs-desktop/commit/75a45354d739af633eb8881ec3eda95fcd3663c9))



# [2.7.0](https://github.com/ocsjs/ocs-desktop/compare/2.6.25...2.7.0) (2025-04-30)



## [2.6.25](https://github.com/ocsjs/ocs-desktop/compare/2.6.24...2.6.25) (2025-04-30)


### Features

* 添加更新日志查看功能 ([3782223](https://github.com/ocsjs/ocs-desktop/commit/378222381ef61dad6ce40a98bec13d7685d2810f))



## [2.6.24](https://github.com/ocsjs/ocs-desktop/compare/2.6.23...2.6.24) (2025-03-12)


### Bug Fixes

* 继续优化浏览器缓存路径更换和缓存清空逻辑 ([1abf753](https://github.com/ocsjs/ocs-desktop/commit/1abf7533c9cf192f72bbfaa286834e837bf1f7d7))



## [2.6.23](https://github.com/ocsjs/ocs-desktop/compare/2.6.22...2.6.23) (2025-03-12)


### Features

* 添加自动打开浏览器拓展开发者模式功能 ([be503b8](https://github.com/ocsjs/ocs-desktop/commit/be503b8e7b988bbccf4ca2b7fcfe9ce7dff46df8))



## [2.6.22](https://github.com/ocsjs/ocs-desktop/compare/2.6.21...2.6.22) (2025-03-09)


### Bug Fixes

* 删除 mac ia32 打包 ([fec865d](https://github.com/ocsjs/ocs-desktop/commit/fec865d5a0254ca551d48f8d6af32058b8715834))



## [2.6.21](https://github.com/ocsjs/ocs-desktop/compare/2.6.20...2.6.21) (2025-03-09)


### Bug Fixes

* 移除 linux 和 mac ia32 打包 ([0fe948c](https://github.com/ocsjs/ocs-desktop/commit/0fe948c67d3e73ec017e4ce02e15752e60c3f6ca))



## [2.6.20](https://github.com/ocsjs/ocs-desktop/compare/2.6.10...2.6.20) (2025-03-09)


### Bug Fixes

* 添加浏览器置顶提示 ([cc71099](https://github.com/ocsjs/ocs-desktop/commit/cc710990cb63046d51fc667b6e8003601145fd54))
* 修复导航页报错，以及异常捕获优化 ([322ffd4](https://github.com/ocsjs/ocs-desktop/commit/322ffd45a32f78a0060e89ac8f92cae80b0bb9fd))
* 修复浏览器缓存更换路径时无法删除BUG ([4c62b1f](https://github.com/ocsjs/ocs-desktop/commit/4c62b1f11dedc1a36d06b2387f9ceb79289c51ca))
* 修复远程同步调用方法 ([c91cbbc](https://github.com/ocsjs/ocs-desktop/commit/c91cbbc68583c272f8c59e9a0537357339b197dc))
* 优化类型检测 ([a4a467e](https://github.com/ocsjs/ocs-desktop/commit/a4a467edf682bcb41f11f4aee162dffac14e94e2))


### Features

* 更新 Electron 23.0.0 => 35.0.0，并添加 window arm 版本以及其他版本支持 ([2c5ec09](https://github.com/ocsjs/ocs-desktop/commit/2c5ec0907b8252bb8d5cadecc54554129e085f4f))
* 添加本地用户数据加密功能 ([a745816](https://github.com/ocsjs/ocs-desktop/commit/a745816c720a6533d2b991113cbd74dcb434bc4f))
* 添加浏览器原版弹窗启用功能，解决浏览器弹窗无法弹出，只弹出一瞬间的BUG ([d24df18](https://github.com/ocsjs/ocs-desktop/commit/d24df180d4331f577b158e0ffe0ebd62e3dd01d6))
* 添加软件右键菜单 ([9c122ad](https://github.com/ocsjs/ocs-desktop/commit/9c122ad34cb1d2d8f233f91a6be2f45d73de81c7))


### Performance Improvements

* 调整软件最小尺寸限制 ([502358f](https://github.com/ocsjs/ocs-desktop/commit/502358f6f4e8993ff5243ab2ef824dd6e5c31906))



## [2.6.10](https://github.com/ocsjs/ocs-desktop/compare/2.6.9...2.6.10) (2024-11-14)


### Bug Fixes

* 修复智慧职教无法自动登录的BUG ([00d91e5](https://github.com/ocsjs/ocs-desktop/commit/00d91e5891ba7706dba94be663b3302950ae3acf))



## [2.6.9](https://github.com/ocsjs/ocs-desktop/compare/2.6.8...2.6.9) (2024-09-18)



## [2.6.8](https://github.com/ocsjs/ocs-desktop/compare/2.6.7...2.6.8) (2024-07-03)


### Bug Fixes

* **web:** 修复标签颜色问题 ([83b735f](https://github.com/ocsjs/ocs-desktop/commit/83b735ffc3dc1e559680a97767ccae76dff64b02))
* **web:** 优化自动化程序填写后自动去前后空格 ([70d3edb](https://github.com/ocsjs/ocs-desktop/commit/70d3edbec62958f9e537bb7048ad789cd1c69efd))



## [2.6.7](https://github.com/ocsjs/ocs-desktop/compare/2.6.6...2.6.7) (2024-05-04)



## [2.6.6](https://github.com/ocsjs/ocs-desktop/compare/2.6.5...2.6.6) (2024-05-04)


### Bug Fixes

* 适配最新版的OCS配置 ([66c6d44](https://github.com/ocsjs/ocs-desktop/commit/66c6d44a843c5f7deb7659d002828aea8928ef39))



## [2.6.5](https://github.com/ocsjs/ocs-desktop/compare/2.6.4...2.6.5) (2024-03-24)


### Bug Fixes

* 修改项目运行教程步骤 ([2003e44](https://github.com/ocsjs/ocs-desktop/commit/2003e4470df6d3443acc630ed71ce8d9f70dc706))
* **app:** 修复修改缓存后，缓存文件夹的浏览器缓存文件依然存在的BUG ([332f384](https://github.com/ocsjs/ocs-desktop/commit/332f384b80a2a8f30ba524193e6759f50357d945))
* **app:** 修改压缩库 ([1bf163a](https://github.com/ocsjs/ocs-desktop/commit/1bf163a829496085cb3e246ad99b4b9db94958de))
* **web:** 修复因为修改缓存文件导致的整个文件夹清空BUG ([18aba47](https://github.com/ocsjs/ocs-desktop/commit/18aba476bb263c65f1309d49acb4772b36c77611))



## [2.6.4](https://github.com/ocsjs/ocs-desktop/compare/2.6.3...2.6.4) (2024-02-28)


### Bug Fixes

* **app:** 持续修复软件辅助BUG ([6a8748d](https://github.com/ocsjs/ocs-desktop/commit/6a8748da24090eb32c2fe9348de20da98ba1c55c))



## [2.6.3](https://github.com/ocsjs/ocs-desktop/compare/2.6.2...2.6.3) (2024-02-28)


### Bug Fixes

* **app:** 优化软件辅助 screenshot 返回值 ([7d8b916](https://github.com/ocsjs/ocs-desktop/commit/7d8b916e6947eacb91366d104886b175272006e8))



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

* **app:** 新增职教云-账号密码登录自动化程序 ([685fcf5](https://github.com/ocsjs/ocs-desktop/commit/685fcf54feed8d5df09a557b6fa6e685a8a7e4a0))
* **app:** 新增智慧职教-账号密码登录自动化程序 ([96d2eb1](https://github.com/ocsjs/ocs-desktop/commit/96d2eb1bfe6befd65dd71e527758ed58d71cf0fe))
* **web:** 添加浏览器缓存清除功能 ([52431c3](https://github.com/ocsjs/ocs-desktop/commit/52431c3f41a7cbc2f7168bbeba4f70c0e2e4a438))
* **web:** 新增可添加网络脚本的功能 ([e2919fe](https://github.com/ocsjs/ocs-desktop/commit/e2919fe894df82f663936926f5205d6fae890c8a))
