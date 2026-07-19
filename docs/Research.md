# OCSplus Research 鐮旂┒璁板綍

## 鐮旂┒鐩爣

鏈枃浠剁敤浜庤褰?Research Agent 瀵圭浉鍏冲紑婧愰」鐩拰鐜版湁浠ｇ爜鐨勭爺绌剁粨璁恒€?
閲嶇偣鐮旂┒瀵硅薄锛?
1. `ocs-desktop`
2. `ZError`
3. 褰撳墠鏈湴鏂板鐨?`packages/web/src/plus/` 妯″潡

## 蹇呴』璁板綍鐨勪俊鎭?
姣忎釜缁撹蹇呴』鍐欐竻妤氭潵婧愶細

- 鏂囦欢璺緞
- 鍑芥暟鍚?/ 缁勪欢鍚?- 鏂囨。浣嶇疆
- README 浣嶇疆
- GitHub issue / commit / changelog 浣嶇疆

## 宸茬煡鍒濇淇℃伅

### ocs-desktop

鏉ユ簮锛歚README.md`

鑳藉姏锛?
- 涓€閿埛璇?- 澶氳处鍙峰埛璇?- 娴忚鍣ㄥ寮€/鍒嗚韩
- 娴忚鍣ㄧ鐞?- 鑷姩鐧诲綍
- 鏀寔 Windows / Linux / Mac

鎶€鏈爤鏉ユ簮锛歚package.json`

- Electron
- Vue 3
- Vite
- TypeScript
- pnpm workspace

### ZError

鏉ユ簮锛歚../ZError/README.md`

瀹氫綅锛?
- 鏀寔 OCS 缃戣鍔╂墜鐨?AI 棰樺簱绠＄悊杞欢
- 鏀寔 OCS 棰樺簱閰嶇疆
- 鏀寔鑷畾涔?AI 渚涘簲鍟嗗拰妯″瀷
- 鏀寔鏈湴棰樺簱绠＄悊涓庣紦瀛?
## 寰呯爺绌堕棶棰?
1. 褰撳墠 Plus 妯″潡鏄惁宸茬粡鎺ュ叆鐪熷疄鏁版嵁锛岃繕鏄富瑕佹槸 UI 鍜屽崰浣嶆暟鎹紵
2. OCS 鍘熺増娴忚鍣ㄧ鐞嗚兘鍔涘浣曡 Plus 璋冪敤锛?3. ZError 鏄惁閫傚悎鐩存帴鎺ュ叆锛岃繕鏄彧浣滀负鍙傝€冿紵
4. 閰嶇疆淇濆瓨鐩墠璧?`electron-store`銆乴ocalStorage锛岃繕鏄叾浠栨柟寮忥紵
5. 褰撳墠鏈彁浜ゆ敼鍔ㄤ腑鍝簺浼氬奖鍝嶅師 OCS 绋冲畾鎬э紵

## T014锛氬彸渚ф帶鍒跺彴鑴氭湰杩愯鐘舵€佺爺绌剁粨璁?
### 鐮旂┒鐩爣

鐢ㄦ埛瑕佹眰鍙充晶鈥滅綉璇炬帶鍒跺彴鈥濇樉绀虹湡瀹炶剼鏈繍琛岀姸鎬侊紝渚嬪寮€濮嬪埛璇俱€佸垏鎹笅涓€绔犺妭绛夈€傜爺绌剁粨璁猴細鍙互鍙傝€冨師鐗?OCS/ocsjs 鐨勭姸鎬佸惈涔夛紝浣?OCSplus 涓嶅簲澶嶅埗鍘熺増瀹炵幇浠ｇ爜锛屽簲鎶借薄涓?OCSplus 鍘熺敓鐘舵€佹ā鍨嬨€?
### 褰撳墠 OCSplus 宸叉湁鐘舵€佹潵婧?
1. 鑴氭湰瀹夎 / 鍚敤鐘舵€?
   鏉ユ簮锛歚packages/web/src/plus/components/OcsControlPanel.vue`
   缁勪欢锛歚OcsControlPanel`
   鍑芥暟 / 瀛楁锛歚scriptCount`銆乣enabledScriptCount`
   褰撳墠鍚箟锛氬彧鑳借鏄庤剼鏈凡淇濆瓨 / 宸插惎鐢紝涓嶈兘璇佹槑姝ｅ湪鍒疯銆?
2. 鍐呭祵 webview 椤甸潰鐘舵€?
   鏉ユ簮锛歚packages/web/src/plus/components/EmbeddedCourseBrowser.vue`
   缁勪欢锛歚EmbeddedCourseBrowser`
   鍑芥暟锛歚handleStartLoading`銆乣handleStopLoading`銆乣handleFailLoad`銆乣syncUrl`
   鍙〃绀猴細椤甸潰鍔犺浇涓€佸姞杞藉畬鎴愩€佸姞杞藉け璐ャ€佸綋鍓?URL / 鏍囬銆?
3. 鍐呭祵鑴氭湰娉ㄥ叆鐘舵€?
   鏉ユ簮锛歚packages/web/src/plus/components/EmbeddedCourseBrowser.vue`
   鍑芥暟锛歚injectEnabledScripts`銆乣createUserscriptRunner`銆乣createOcsRuntimeProbeCode`
   鍙〃绀猴細娉ㄥ叆涓€佹敞鍏ユ垚鍔熴€佹娴嬪埌 OCS銆佸尮閰嶅埌鑴氭湰銆佹湭鍖归厤鑴氭湰銆佹敞鍏ュけ璐ャ€?
   娉ㄦ剰锛氬綋鍓嶅彧閫氳繃 `Message` 鎻愮ず锛屾病鏈夋矇娣€涓哄彸渚ф帶鍒跺彴鍙寔缁樉绀虹殑鐘舵€併€?
4. 璇剧▼杩涘害蹇収
   鏉ユ簮锛歚packages/web/src/plus/components/EmbeddedCourseBrowser.vue`
   鍑芥暟锛歚syncStudyProgressFromWebview`銆乣createStudyProgressCollectorCode`
   鍙〃绀猴細璇剧▼鍚嶃€佸钩鍙般€佽繘搴︺€佸畬鎴愬崟鍏冩暟銆佹€诲崟鍏冩暟銆?
   娉ㄦ剰锛氳繖鏄惎鍙戝紡璇嗗埆锛屼笉绛変簬鍘?OCS 鑴氭湰鍐呴儴鐪熷疄鐘舵€併€?
5. 鍘?OCS 鐙珛娴忚鍣ㄧ姸鎬?
   鏉ユ簮锛歚packages/web/src/utils/process.ts`銆乣packages/web/src/fs/browser.ts`
   绫?/ 鍑芥暟锛歚Process.status`銆乣Process.launch`銆乣Process.close`銆乣Browser.launch`
   鍙〃绀猴細`closed`銆乣launching`銆乣launched`銆乣closing`銆?
   娉ㄦ剰锛氳繖鏄祻瑙堝櫒杩涚▼鐘舵€侊紝涓嶇瓑浜庤绋嬭剼鏈繍琛岀姸鎬併€?
### 鍘熺増 OCS/ocsjs 鍙弬鑰冪姸鎬佸惈涔?
1. 寮€濮嬪涔?/ 姝ｅ湪瀛︿範
   鏉ユ簮锛歚ocsjs/ocsjs/packages/scripts/src/projects/cx.ts`
   宸ョ▼锛歚CXProject`
   鍑芥暟锛歚study`銆乣searchJob`銆乣JobRunner.media`
   鍏稿瀷鍚箟锛氬凡杩涘叆瀛︿範椤点€佹娴嬩换鍔＄偣銆佸嵆灏嗘挱鏀俱€佽棰戝紑濮嬫挱鏀俱€佷换鍔″畬鎴愬悗鍑嗗璺宠浆銆?
2. 绔犺妭鍒囨崲
   鏉ユ簮锛歚ocsjs/ocsjs/packages/scripts/src/projects/cx.ts`
   鍑芥暟锛歚study` 鍐呴儴 `next`銆乣CXAnalyses.isInFinalTab`銆乣CXAnalyses.isInFinalChapter`銆乣CXAnalyses.isFinishedAllChapters`
   鍏稿瀷鍚箟锛氫换鍔＄偣瀹屾垚鍚庤烦杞笅涓€鑺傦紱鏈€鍚庣珷鑺傛椂鎻愮ず鍏ㄩ儴瀹屾垚鎴栭渶瑕佷汉宸ュ垏鎹€?
3. 鏅烘収鏍戠珷鑺?/ 瑙嗛鍒囨崲
   鏉ユ簮锛歚ocsjs/ocsjs/packages/scripts/src/projects/zhs.ts`
   宸ョ▼锛歚ZHSProject`
   绫?/ 鍑芥暟锛歚StudyVideoH5.getNext`銆乣StudyPlusH5.getNext`銆乣WishdomH5.getNext`銆乣Hike.getNext`銆乣watch`銆乣doWork`
   鍏稿瀷鍚箟锛氬嵆灏嗗涔犮€佹鍦ㄥ涔犮€佽棰戠粨鏉熷悗鑷姩涓嬩竴鑺傘€佸叏閮ㄥ畬鎴愩€?
4. 鑱屾暀浜戜换鍔″涔?
   鏉ユ簮锛歚ocsjs/ocsjs/packages/scripts/src/projects/zjy.ts`
   宸ョ▼锛歚ZJYProject`
   鍑芥暟锛歚watchMedia`銆乣watchFile`銆乣next`
   鍏稿瀷鍚箟锛氬紑濮嬪涔犱换鍔＄偣銆佽棰?/ PPT / 鏂囨。澶勭悊銆佷换鍔＄偣缁撴潫鍚庝簲绉掍笅涓€绔犮€?
5. 绛旈鎺у埗鍜屾殏鍋?
   鏉ユ簮锛歚ocsjs/ocsjs/packages/scripts/src/utils/work.ts`
   鍑芥暟锛歚commonWork`銆乣createWorkerControl`
   鐘舵€侊細寮€濮嬬瓟棰樸€佹殏鍋溿€佺户缁€侀噸鏂扮瓟棰樸€佸畬鎴愩€?
   娉ㄦ剰锛歍014 MVP 涓嶅簲鎺ュ叆瀹屾暣鑷姩绛旈锛屽彧鑳藉睍绀洪鐩娴?/ 鏆傛湭鎺ュ叆 AI / 闇€瑕佷汉宸ュ鐞嗐€?
### 寤鸿 OCSplus 鍘熺敓鐘舵€佺被鍨?
寤鸿瀹氫箟涓€涓?OCSplus 鑷繁鐨勮繍琛岀姸鎬佸璞★紝瀛楁鍖呮嫭锛?
- `source`锛歚plus-webview` / `legacy-browser` / `manual` / `unknown`
- `script.phase`锛歚no_script` / `script_disabled` / `script_ready` / `injecting` / `injected` / `running` / `paused` / `error`
- `page`锛歚url` / `title` / `platform` / `loading` / `error`
- `course`锛歚name` / `chapter` / `task` / `taskType` / `progress` / `completedUnits` / `totalUnits`
- `flow.phase`锛歚idle` / `opening_page` / `detecting_platform` / `detecting_task` / `start_study` / `media_waiting` / `media_playing` / `media_finished` / `question_detecting` / `question_need_manual` / `next_pending` / `next_switching` / `course_finished` / `manual_required` / `error`
- `actions`锛歚open_legacy_browser` / `open_legacy_scripts` / `retry_inject` / `sync_progress` / `manual_next`
- `error`锛歚code` / `message` / `recoverable`

### MVP 閫傞厤寤鸿

1. 绗竴闃舵鍙仛鈥滅姸鎬佸睍绀?+ 浜嬩欢娴?+ 澶辫触鎻愮ず鈥濄€?2. 浼樺厛澶嶇敤褰撳墠 OCSplus 宸叉湁鐪熷疄鏉ユ簮锛?   - `store.render.scripts`
   - `EmbeddedCourseBrowser.vue` 鐨?webview 鍔犺浇鐘舵€?   - `injectEnabledScripts` 鐨勬敞鍏ョ粨鏋?   - `createStudyProgressCollectorCode` 鐨勮绋嬭繘搴﹀揩鐓?   - `Process.status` 鐨勭嫭绔嬫祻瑙堝櫒鐘舵€?3. 鍙充晶鎺у埗鍙板簲鏄庣‘鐘舵€佹潵婧愶紝渚嬪锛?   - `鐘舵€佹潵婧愶細Plus 鍐呭祵娴忚鍣╜
   - `鐘舵€佹潵婧愶細鍘?OCS 鐙珛娴忚鍣╜
   - `鐘舵€佹潵婧愶細鑴氭湰閰嶇疆`
4. 鈥滃紑濮嬪埛璇锯€濃€滃垏鎹笅涓€绔犺妭鈥濆湪 MVP 涓簲浣滀负娴佺▼鐘舵€佸睍绀猴紝涓嶅簲鐩存帴瀹炵幇瀹屾暣鑷姩鍒疯闂幆銆?5. 棰樼洰鐩稿叧鐘舵€佸彧灞曠ず锛歚棰樼洰妫€娴嬩腑` / `闇€瑕佷汉宸ュ鐞哷 / `鏆傛湭鎺ュ叆 AI`锛屼笉鎺ュ叆瀹屾暣鑷姩绛旈鍜岃嚜鍔ㄦ彁浜ゃ€?
### 椋庨櫓涓庤竟鐣?
1. 鍘熺増 OCS/ocsjs 鐘舵€佷笉鏄粺涓€浜嬩欢鎺ュ彛锛屼富瑕佹暎钀藉湪鍚勫钩鍙拌剼鏈?`$message`銆乣$console`銆丏OM 鍒ゆ柇鍜屽眬閮ㄦ祦绋嬩腑锛屼笉鑳界洿鎺ュ鍒躲€?2. 褰撳墠 OCSplus 鍐呭祵 webview 娉ㄥ叆娑夊強楂橀闄╄兘鍔涳紝MVP 涓嶅簲榛樿渚濊禆瀹冨畬鎴愯嚜鍔ㄥ埛璇俱€?3. `宸叉敞鍏 涓嶇瓑浜?`姝ｅ湪鍒疯`锛屾帶鍒跺彴鏂囨蹇呴』閬垮厤璇銆?4. 璺ㄥ钩鍙拌绋?/ 绔犺妭 / 浠诲姟鐐硅瘑鍒樊寮傚緢澶э紝MVP 涓嶅簲閲嶅啓鍘熺増骞冲彴閫傞厤閫昏緫銆?5. 鐙珛娴忚鍣ㄧ姸鎬佸拰璇剧▼鑴氭湰鐘舵€佷笉鍚岋紝蹇呴』鍖哄垎灞曠ず銆?6. 绛旈銆丄I銆佽嚜鍔ㄦ彁浜ゅ睘浜?P2 鎴栦笓椤硅瘎瀹★紝涓嶈繘鍏?T014 绗竴闃舵銆?
## T001 褰撳墠鏈彁浜ゆ敼鍔ㄧ爺绌剁粨璁?
鏉ユ簮锛?
- `git status --short`
- `git diff --stat`
- `packages/web/src/plus/`
- `packages/web/src/config/index.ts`
- `packages/web/src/pages/index.vue`
- `packages/web/src/store/index.ts`
- `packages/app/src/window.ts`
- `packages/app/src/tasks/remote.register.ts`
- `packages/app/src/tasks/startup.server.ts`

### 浜嬪疄缁撹

1. 褰撳墠鏈彁浜ゆ敼鍔ㄥ垎涓轰笁绫伙細
   - 椤圭洰鍗忎綔鏂囨。锛歚docs/*`
   - Plus 宸ヤ綔鍙颁笌璺敱锛歚packages/web/src/plus/*`銆乣packages/web/src/pages/index.vue`銆乣packages/web/src/config/index.ts`
   - Electron/娴忚鍣ㄨ繍琛岃兘鍔涙敼鍔細`packages/app/*`銆乣packages/common/*`
2. `packages/web/src/plus/` 褰撳墠鏃㈠寘鍚?MVP 鐩稿叧鍏ュ彛锛屼篃鍖呭惈瓒呰繃 MVP 鐨勬帰绱㈠姛鑳斤細
   - MVP 鐩稿叧锛歅lus 棣栭〉銆佹ā鍧楀鑸€佸師鐗堝叆鍙ｃ€佹祻瑙堝櫒璺緞閰嶇疆銆佸師娴忚鍣ㄨ兘鍔涘叆鍙ｃ€?   - 瓒呭嚭 MVP锛氬唴宓?webview 娉ㄥ叆鑴氭湰銆丄I 棰樼洰鍔╂墜銆佽祫鏂欏簱銆侀敊棰樻湰銆佹ā鍨嬮厤缃€佷换鍔℃彁閱掑畬鏁村叆鍙ｃ€?3. 褰撳墠瀛︿範杩涘害銆佷换鍔°€丄I 闈㈡澘瀛樺湪闈欐€?婕旂ず鏁版嵁锛?   - `packages/web/src/store/index.ts`
   - `packages/web/src/plus/data/dashboard.ts`
   - `packages/web/src/plus/components/AiQuestionPanel.vue`
4. 鍘?OCS 椤甸潰琚縼绉诲埌 `/legacy/*`锛?   - 鍘熸祻瑙堝櫒锛歚/legacy/browsers`
   - 鍘熻剼鏈細`/legacy/user-scripts`
   - 鍘熻祫婧愶細`/legacy/resources`
   - 鍘熺洃鎺э細`/legacy/dashboard`
   - 鍘熻缃細`/legacy/setting`
5. Electron 涓昏繘绋嬪凡鏂板鍐呯疆娴忚鍣ㄤ笅杞芥柟娉曪細
   - `getBundledBrowserInfo`
   - `installBundledBrowser`
   璇ヨ兘鍔涘浐瀹氫笅杞?Chrome for Testing Windows 鐗堟湰锛岄渶瑕佺‘璁ゆ槸鍚﹀睘浜?MVP銆?