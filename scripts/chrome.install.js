const { series, src, dest } = require('gulp');
const { execOut } = require('./utils');
const zip = require('gulp-zip');

// 137 版本后谷歌禁止使用命令行加载插件，目前只能内置Chrome for Test测试浏览器，并且进行严格版本控制，手动更新
function downloadChrome() {
	return execOut('npx @puppeteer/browsers install chrome@137 --path ../.chrome-temp');
}

function pack() {
	return src('../.chrome-temp/chrome/**/*').pipe(zip(`chrome.zip`)).pipe(dest('../bin/chrome'));
}

exports.default = series(downloadChrome, pack);
