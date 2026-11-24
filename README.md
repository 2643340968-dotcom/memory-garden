# 记忆花园 / Memory Garden

《记忆之场》的全国地图以五座城市为入口，共收录 85 处地点。南京有 21 处，北京 22 处，敦煌 8 处，成都 18 处，泉州 16 处。每一处都可以进入花园、阅读当地资料、留下记忆。江东门完整演示留言化为一簇紫金草的过程，其余地点显示本次到访的保存回执。花园按需加载，共用 Three.js 渲染器，每处有独立的资料、留言和草稿。

完整的项目交接、技术规则、配置值和下一步计划见 [`AGENTS.md`](./AGENTS.md)。

## 双城互访原型

`codex/flow-next` 从稳定存档 `archive/flow-2026-11-24`（`e0d942d`）开始独立开发。运行 `npm run dev` 后打开 `/memory-garden/flow.html`。进入城市地图可以选择「双城互访」，首页的「我的互访」可以回看自己的申请、行程、记忆和评论。

以小安申请一条示例意向，然后通过面板上方的「体验身份」切换到意向发布者，回应申请。双方确认后可从地点地图添加行程站点，在行程中安排停留时间、补充研学问题，打开花园查阅有出处的历史资料。互访札记可关联多站，分别选择公开、仅双方或仅自己可见。

这是本浏览器内的交互原型。IndexedDB 保存申请、通知、评论、札记和附件，体验身份只在当前标签页切换。禁用存储时使用临时会话。真实登录、跨设备通信与人工审核需要接入服务端。交互状态与权限在 `src/flow/exchange/model.js`，存储在 `store.js`，互访面板和花园卡片分别在 `panel.js` 与 `journal.js`。

## 新电脑 / 新会话启动

需要 Node.js `20.19+` 或 `22.12+`。

```bash
npm install
npm run dev
```

然后打开：

- 当前 PNG 主版本：`http://127.0.0.1:5173/memory-garden/png.html`
- 流动地图：`http://127.0.0.1:5173/memory-garden/flow.html`
- 保留的 GLB 模型版本：`http://127.0.0.1:5173/memory-garden/model.html`

项目同时保留 `package-lock.json` 和 `pnpm-lock.yaml`。如果使用 pnpm，也可以运行：

```bash
pnpm install
pnpm run dev
```

不要直接双击 `png.html` 或 `model.html`：当前项目使用 ES modules 和 Vite 资源路径，需要本地开发服务器。

## GitHub Pages 部署

仓库按 GitHub project site `memory-garden` 配置，Vite 生产基路径为 `/memory-garden/`。根目录的 `index.html` 只做相对跳转，因此 Pages 根地址会打开 `./png.html`，同时继续保留直接访问 `png.html` 和 `model.html`。

`.github/workflows/deploy.yml` 在 `main` 分支更新时运行 `npm ci`、`npm run build`，上传 `dist` 并通过 GitHub 官方 Pages Actions 发布；也支持手动触发。仓库创建后应在 **Settings → Pages** 中把 Source 设为 **GitHub Actions**。

互访原型在 `codex/flow-next` 上测试、验收并推送。公开稳定版由 `main` 发布。原型合并上线需单独确认。

## 新 Codex 账号接手步骤

1. 打开项目根目录 `D:\记忆花园`。
2. 先完整阅读 `AGENTS.md`。
3. 运行 `git status`，确认没有未说明的修改。
4. 运行 `npm install`。
5. 运行 `npm test`。
6. 运行 `npm run dev`。
7. 打开 `/png.html`，检查地图、花园交互与控制台。
8. 修改前先保留 Git checkpoint，尤其是粒子、MediaPipe 或渲染架构重构。

## 页面入口

| 页面 | 入口模块 | 用途 |
| --- | --- | --- |
| `/png.html` | `src/png-main.js` | 全国花标地图、五城地点与按地点加载的 PNG 花园 |
| `/flow.html` | `src/flow/main.js` | 浅色矢量地图、水纹花丛与正侧面记忆花园 |
| `/model.html` | `src/model-main.js` | 留存的旧 GLB 花朵版本；不再作为日常开发与验收目标 |
| `/` | `src/main.js` | 由 index.html 相对跳转到 PNG 主入口 |

两个页面分别创建自己的场景和运行时状态，种花与 Reset 不会互相影响。

修改流动地图时同时验收 `/flow.html` 和原入口 `/png.html`，并核对两者的公开版本。

## 流动地图

全国、城市、街区和建筑近景使用同一套纸白底色。水系呈浅蓝，绿地呈浅灰绿，街巷和建筑以细线区分。快速推近或拉远时，外围补绘也使用这套配色。悬停或键盘聚焦会让小花放大，沿花瓣轮廓泛起涟漪。拖动花瓣会拨动渐变并激起更强的水纹，松手后逐渐消散。按住地图空白处可平移。

从首页下滚，依次进入全国、城市、具体地点、花园题页和花园。题页会停留，等下一次滚动、上滑或按键才开始生长。上滚沿原路逐层返回。指向城市或某处花丛，可以选择下一站。在花标、可见地名或附近的花丛上向下滚动，可沿该地点深入。鼠标停在空白处时，地图保持当前层级。手机用竖划切换层级，横划可平移地图或拨动花瓣。数字标记可展开附近地点列表。

直接打开 `flow.html` 会看到当前语言的项目标题，标题下有一句介绍。花瓣形的下滑按钮位于介绍下方。两侧最靠边的花先开，两列依次朝中央展开。每朵花从花心一圈圈向外送出水纹，外缘逐渐淡去。花瓣从奶黄色的内圈过渡到杏粉、雾紫或薄荷色的外缘。指针轻移时，花瓣的亮部随之偏移。按住鼠标拖过花丛，或在触屏上横划，经过的花和邻近的花会泛起更强的水纹。松手后亮部缓慢归位，余波继续向外散开。花谱保留相同花形的静态样本。两朵花的外缘相遇时才晕色，轮廓在湿润处短暂缺开，随后复原。减少动态效果时保留盛开的静帧，进入地图后停止绘制花影。下滚或上滑一次，镜头从远处推近全国地图。底图先静止片刻，十八朵花随后像雨滴错落地落在各自的城市，落地时散开两圈水纹。花瓣的渐变边缘晕开，表面覆以细颗粒。各层花标交错舒展，全国花标的起伏最大。悬停后的余波可以与下一朵花的水纹重叠。十八座城市都可以进入。新增的十三座城市各收录四处地点，每处都有独立的花园。开启减少动态效果时直接显示静态花形。

首页顶部和地图导览中的「城市花谱」收录十八种城市花，可切换俯视、正面、侧面，阅读选花理由和出处，或打开单张矢量图。[打开城市花谱](https://2643340968-dotcom.github.io/memory-garden/flow.html?flowers)。俯视花图由 `node scripts/build-flow-flowers.mjs` 生成，三十六张正侧面花冠由 `node scripts/build-upright-flowers.mjs` 生成。

顶部工具栏常驻「首页」和「城市花谱」。首次抵达城市层级时，地图边会展开当地代表花的一页花谱。继续浏览即可收起，也可点开完整的十八城花谱。`#atlas` 及城市、地点、花园的深层链接都可以直接打开。每座城市的地点沿用同一种花。城市层显示地点花标，相邻地点共用带数字的花标。镜头到达具体地点后，坐标周围的花丛淡入，每丛 46 至 54 朵。退回城市时立即收起花丛。相邻花缘交换颜色，花心保持清楚。横拖会加强沿途的水纹。这些绘制的花丛与花园中真实可读的条目分别计数。

入园后，弯曲的花茎从屏幕底边长起，枝叶展开，正面与侧面的花冠在枝头开放。指针掠过或手指横扫时，近处的花枝顺着手势摇动，再慢慢回正。137 处地点共收录 287 段有日期和出处的精选往事。每段往事有一株独立的花，花瓣稍大，边缘的柔光扩散得更频繁。点花可读标题、时间、经过和出处。远近三层花丛延伸到屏幕两侧，同簇的花指向同一段可读记忆。第一次看完花茎生长、花冠展开后，屏幕中央才出现邀请卡。可以点击「先逛花园」，也可以直接留下文字、图片、音频或视频。在同一浏览器出现一次后，刷新网页或更换地点都会直接进入花园。「留下记忆」位于主工具栏下方正中。有更多可读内容时，「换一批记忆」与它并排显示。每次换批都会从上次停下的位置继续，返回地点或切换语言会保留当前的花。各地点的中英文写作提示取材于当地。草、叶、花茎与花冠共享细颗粒的纸面质感。留言表单只由显式操作打开，卡片内可自然滚动。提交后新的一株从底部抽茎。每个地点分别保存本次到访的留言与草稿。

### 流动地图的页面与资源

| 环节 | 代码入口 | 资源与交互 |
| --- | --- | --- |
| 首页 | `landing.js`、`coverFlowers.js`、`coverPlates.js` | 首帧用同一组矢量花图从两侧开放，湿边与涟漪准备好后接手。绘图线程超时会切换至本地画布。离开首页释放整屏的色层。 |
| 全国、城市、地点 | `levels.js`、`atlas.js`、`FlowBasemap.js` | 路由确定目标，镜头只负责呈现。清晰图幅绘制期间用已配准的地图铺满视口。地面花丛、涟漪按需分配画布；进入花园时释放图幅、缓存与绘图线程。 |
| 花园题页与入园 | `main.js`、`flowerForms.js`、`standingGarden.js` | 题页等用户继续。选中城市的正侧面花图就绪后，花茎从屏幕底部生长。重复花冠共用预印的透明 WebP；加载失败会读取对应的原始 SVG。 |
| 初访、阅读与留言 | `gardenInvitation.js`、`garden.js`、`gardenSelection.js` | 邀请跟随实际生长动画结束。切走或打开花谱会取消或推迟邀请。其显示记录存入 `localStorage`。记忆、附件、草稿、换批进度只在当前页面按地点保存。 |

上述场景模块位于 `src/flow/`。加入地点时，在 `places.js` 对应的目录中登记坐标、名称和城市，在 `gardenEvents.js` 与 `writingPrompts.js` 对接事件和双语提示。新增层级动作从 `levels.js` 进入，由 `main.js` 统一处理滚轮、触摸、按钮和浏览器历史。重绘时沿用布局的 CSS 坐标，位图的像素预算由 `renderBudget.js` 限制。

中文版的「记忆之场」「记忆花园」「城市花谱」使用项目原创的藤蔓装饰标题字。九个字用等宽圆头线、弧形转角、卷须与叶片逐笔构成，在 `scripts/vine_lettering.py` 中绘制并编译成可选择的文字。城市与地点名称、工具栏、按钮和正文使用 Noto Sans SC。两份 WOFF2 随站点加载，访客输入中的额外字形由设备的中文无衬线字体补齐。界面字库的来源与许可证见 [Noto Sans SC](https://github.com/google/fonts/tree/main/ofl/notosanssc) 和 `public/assets/fonts/`。

更新花图后可运行 `node scripts/print-upright-flowers.cjs` 从正侧面 SVG 重新印制 WebP（制图环境需有 sharp）。调整中文字库时，运行 `python scripts/build-flow-fonts.py <NotoSansSC-VF.ttf>`（需 fontTools、Brotli 和 skia-pathops）。日常构建直接使用仓库内的成品。`npm test` 检查各层图幅覆盖、花图尺寸、像素预算和邀请生命周期。

## 当前 PNG 体验

从 `/png.html` 进入暖纸色的全国地图，五朵花标记五座城市。悬停或用键盘聚焦花标时，地图轻轻向该位置靠近，坐标旁浮出代表花的粒子花影、花名与选花短文。移开鼠标会回到原来的视野。进入城市后，相邻地点共用一朵带数字的花标，点击可展开。手机点选城市或地点即可阅读花卡。地点介绍旁有资料链接和「进入花园」入口。

全国、城市和地点各有一次短促的镜头定位。滚轮、缩放按钮和双指都可以在节点之间自由改变比例，反向操作就能中断镜头并拉回。标题、顶部路径、花标、地点计数与网址随层级同步更新。悬停只预览，点击当前路径名称可以重新居中。系统开启减少动态效果时，地图直接就位。

底图和圆形放大镜共用本地矢量图包。镜头移动时先移动已有图幅，后台绘制新比例的道路和建筑。85 处地点均有街区图幅。地点的墨色标记、粒子图案和名称优先占位，街名会避开它们。中文标题、地图地名和留言使用随网页加载的 Noto Serif SC 宋体子集，并按中文字形调整行距与字距。

首页标题是「记忆之场」。进入任一地点时，地图淡入当地色调，颗粒聚成该地的代表花，中央显出「记忆花园」和地名，再淡入花田。可以点击「跳过过场」或按 Esc，开启减少动态效果时会显示静态题页。

每个花园最初开放三簇花。点击花簇可阅读当地资料，拖动可唤出更多花簇和卡片，键盘聚焦花田后也可按回车探索。「留下记忆」随时可以打开或取消。85 处地点共用一张留言卡，可以只写文字，只选一张图片、一段音频或一段视频，也可以给文件配上文字。选好后可在卡内预览、更换或移除。提交后可在卡内的「我在这里留下的记忆」重看或播放，点击带附件的花簇也能打开这张卡。留言和草稿按地点保存在当前页面，文件只在浏览器本地读取，刷新后清除。返回地图会恢复地点、平移位置及缩放比例，花园停止绘制并淡出声音。

### 地图与场所内容

城市和地图路由在 `src/atlas/places.js`。桌面、触屏和悬停放大镜共用 Web Mercator 投影与 Canvas 矢量绘制。全国图的地形刻线、海岸、省界与河流取自 Natural Earth。五城街区沿用 2026-11-15 的 OpenFreeMap 数据，覆盖第 6 至 14 级。拉近每个地点时，道路、建筑和水岸都会按当前比例和屏幕像素密度重新绘制。江东门标记取纪念馆代表点 32.03759°N、118.73659°E。[Natural Earth](https://www.naturalearthdata.com/) · [OpenFreeMap](https://openfreemap.org/) · [OpenMapTiles](https://openmaptiles.org/) · [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) · [Wikidata Q32391](https://www.wikidata.org/wiki/Q32391)

`scripts/build-atlas-vectors.py` 从原始地理数据生成 `src/atlas/maps/vector-index.json` 与 `public/assets/atlas-vectors/` 下带内容摘要的压缩路径。流动地图另用 `scripts/build-flow-vectors.py --fetch` 生成新增十三城的矢量图包，地点坐标与双语札记在 `src/flow/extraPlaces.json`。页面按当前视野向本站请求数据，细节加载期间沿用相同坐标的上一级图幅。

江东门的两条编辑摘要及各自的出处在 `src/data/jiangdongmen.js`，分别对应纪念馆开放和南京大屠杀档案。对应花簇的单株尺寸暂定为普通花簇的 1.16 倍。四条原型文字显示为「示例留言」，访客原文保留换行与首尾空格。图片和声音继续使用独立记录。[纪念馆开放资料](https://visitnanjing.net/venues-detail/6) · [UNESCO 南京大屠杀档案](https://www.unesco.org/en/memory-world/documents-nanjing-massacre)

85 个地点各有一条中英文选花说明，收录在 `src/data/placeFlowers.js`。五城入口分别取江东门的紫金草、景山万春亭的牡丹、莫高窟的荷花、都江堰鱼嘴的鸢尾和洛阳桥的刺桐花。有特定花事、地方象征或艺术图像依据的选花可在地点页查看资料。其余配对说明花形与地点的策展联想。18 幅花影由 `scripts/build-flower-studies.py` 生成，全国地图和入园过场共用同一套粒子图。其余 80 处的坐标、地名与双语地点短文在 `src/data/atlasCatalogue.js`。

Memory Echo 使用半透明深紫玻璃、`20px` 背景模糊、淡紫边框与低强度光晕。统一数据结构分别支持文字、独立图片档案和独立声音档案：文字卡保持轻量，图片卡只显示已提供的真实图片与已核实的可选元数据，声音卡使用克制的独立播放指示。当前接入 `21` 张用户提供的南京记忆图片与 `10` 条用户提供的档案声音；因为尚未提供完整可核实元数据，公开卡片不添加人物、时间、地点、说明或来源。文字/图片卡保留 BloomEvent 世界坐标投影关系，并分散在视口顶部约 `17%–64%` 的天空范围内；每次放置从 `128` 个低差异候选位置中进行碰撞评分，避让现有卡片、标题、状态和声音控件。桌面端同时最多 `6` 张视觉卡，窄屏会自适应降至 `4` 或 `2` 张；卡片始终使用 `pointer-events: none`。

右上角语言按钮在入口弹窗显示期间也可以操作。首次访问默认英文；选择通过 `localStorage` 的 `memory-garden-language-v1` 保存，刷新后继续使用上次语言。标题、弹窗、状态、声音控件、HUD、辅助文本和当前可见的 Memory Echo 标签会同步切换。观众输入的留言、历史图片、声音与未核实档案信息始终保留原文，不做自动翻译；项目内四条示例和两条署名编辑摘要各有明确的中英文版本。

页面初始完全静音，主动开启声音、播放自己选择的音视频或提交留言时解锁 Web Audio。运行时使用单独的 `-25 LUFS` BGM 副本；档案声音出现时 BGM 按观众所选音量的 `72%` 轻度 duck，结束后恢复。同一时间只有一条档案声音。归档声音使用不覆盖原件的 `-23 LUFS / -3 dBTP` 标准化副本，运行时增益 `0.38`，以 `650ms` 渐入、`750ms` 渐出。最终混音经过保留余量的轻量 master limiter。花朵生长和记忆卡出现均不播放提示音，所有程序化 cue 已移除。

## 核心数据流

```text
MouseInput
  → PointerController
  → GroundRaycaster
  → FlowerSpawner
  → FlowerSystem
  → BloomEvent
  → FlowerRenderer
      ├─ PNGFlowerRenderer
      └─ ModelFlowerRenderer

BloomEvent
  → BloomPatchSystem
      ├─ cursor attention field
      ├─ patch-level growth / alive / decay state
      ├─ PNG alpha / color sample library
      ├─ BloomParticleSystem (primary stable-slot flower renderer)
      └─ PNGBloomPipeline (high-threshold full-scene HDR bloom)

BloomEvent
  → MemoryExperience
  → Memory Echo DOM UI

Sound toggle or memory submission
  → AudioManager unlock
  → looping BGM bus
  → one reusable archive-voice channel
  → BGM duck / restore during archive voice
```

输入层与花朵系统解耦。未来的 `HandInput` 应与 `MouseInput` 一样，只更新 `PointerController`；鼠标模式需要继续作为摄像头不可用时的 fallback。

## 重要目录

```text
src/
  app/createFlowerFieldApp.js
  data/memoryPool.js
  audio/
    AudioConfig.js
    AudioManager.js
  memory/
    MemoryAssetPreloader.js
    MemoryExperience.js
    MemoryCardRenderer.js
  flowers/
    BloomEvent.js
    BloomPatchConfig.js
    BloomPatchSystem.js
    FlowerSystem.js
    FlowerSpawner.js
    FlowerAnimation.js
    renderers/
      FlowerRenderer.js
      PNGFlowerConfig.js
      PNGFlowerRenderer.js
      PNGFlowerParticleSampler.js
      ModelFlowerRenderer.js
  effects/
    AirborneFlowerSystem.js
    BloomParticleSystem.js
    PNGBloomPipeline.js
  input/
    PointerController.js
    MouseInput.js
  interaction/GroundRaycaster.js
  scene/
    createScene.js
    createCamera.js
    createRenderer.js
    createLights.js
    createGround.js
    createGrass.js
    createHitMarker.js
  config.js
  styles.css
public/assets/flowers/
  zijincao.glb
  png/zijincao_01.png … zijincao_05.png
public/assets/memories/
  README.md
  images/nanjing-memory-283.jpg … nanjing-memory-303.jpg
  audio/archive-voice-01.mp3 … archive-voice-10.mp3
  audio-normalized/archive-voice-01.mp3 … archive-voice-10.mp3
  audio-normalized/loudness-report.json
  bgm/bgm.mp3
  bgm-normalized/bgm.mp3
  bgm-normalized/loudness-report.json
```

## 关键配置

- 全局容量：`src/config.js` → `MAX_FLOWERS = 20000`
- PNG 花朵与暗夜场景：`src/flowers/renderers/PNGFlowerConfig.js`
- 记忆卡与单次拖拽节奏：`src/memory/MemoryExperience.js` → `MEMORY_UI_CONFIG`
- 中英文文案、原型留言译文与语言持久化：`src/i18n/LanguageController.js`
- 音频混音、淡入淡出、ducking 与语音卡片时长：`src/audio/AudioConfig.js` → `AUDIO_CONFIG`
- 花簇注意力、消散和粒子：`src/flowers/BloomPatchConfig.js` → `BLOOM_PATCH_CONFIG`
- 事件驱动花形碎片：`src/effects/AirborneFlowerSystem.js` → `AIRBORNE_FLOWER_CONFIG`
- Vite 多入口：`vite.config.js`

当前记忆节奏：

- 单次拖拽最多 `7` 条文字/图片记忆；短、普通、长手势目标约为 `2–3 / 4–5 / 5–7`
- 视觉卡桌面同时最多 `6` 张，`≤1100px` 为 `4` 张，`≤520px` 为 `2` 张；独立声音指示始终最多 `1` 张
- 视觉记忆从第 `1` 个 BloomEvent 开始，之后按花簇事件与移动距离阈值逐条触发，每个 BloomEvent 最多增加一张
- 视觉卡在触发后随机错开 `280–650ms` 出现，停留 `4400–6600ms`，退场 `700ms`
- 文字卡宽 `270px`，图片卡宽 `286px`，视口安全边距 `30px`
- 视觉卡顶部从视口高度 `17%` 开始，最大为 `54%`，卡片底部不超过 `64%`；保留 `24%` 的花簇投影横向/纵向影响，以 `128` 个非网格候选位置进行避让，目标重叠比例不超过 `2%`

当前声音节奏：

- 初始页不自动播放；公开状态显示 `SOUND OFF`，主动开启声音或有效提交后变为 `SOUND ON`
- 原 BGM 实测约 `-44.22 LUFS`，因此保留原件并生成 `-25.27 LUFS / -9.91 dBTP` 的运行时副本；默认基准增益由 `0.28` 提高至 `0.52`，左上角独立滑杆可调至 `0–0.64`，当前会话通过新版 `sessionStorage` key 保留
- 档案声音出现时，BGM 仅 duck 至观众当前基准音量的 `72%`，结束后回到该基准音量；滑杆不改变档案声音音量
- 档案语音运行时增益由 `0.72` 降为 `0.38`，开始延迟 `480ms`，渐入 `650ms`，自然/停止渐出 `750ms`，替换渐出 `650ms`，同一时间只保留一段
- 10 段运行时归档声音来自独立标准化副本，目标由 `-18 LUFS / -1.5 dBTP` 降至 `-23 LUFS / -3 dBTP`
- 最终 BGM 与语音共用轻量 master limiter：阈值 `-18 dB`、knee `6 dB`、ratio `4:1`、attack `10ms`、release `220ms`；其后 master output gain 为 `0.82`
- 语音卡停留至音频结束后 `900ms`，最长 `24s`
- 文字与图片使用独立的 `1:1` shuffle-bag，在可用素材间交替并保护近期条目，避免同一句文字或同一张图片同时/连续重复
- TEXT 类别内部由两条有出处的编辑摘要、四条原型留言和访客留言共同组成；首次提交仍直接显示 `YOUR MEMORY`，后续 TEXT 抽取约为 `70%` 预设 / `30%` 访客，并优先回避刚出现过的同一句
- 档案声音与视觉卡完全分开调度，沿用首个检查点及之后每 `2–3` 个 BloomEvent 或 `1.75` 世界单位的低频节奏；每次手势最多一次声音机会，正在加载/播放时直接放弃该机会，不排队也不打断当前声音
- 不在启动时批量加载音频；仅对已经选中的 memory 进行轻量预载。图片在浏览器空闲时最多预热 `2` 张，并在卡片排队时预载对应图片
- 花朵生长与记忆卡出现保持静音；没有预录或程序化提示音，声音仅来自 BGM 与偶发独立档案声音
- 页面左上角按钮控制全局声音；切页隐藏和恢复会渐变主音量，不直接破坏播放状态

正式 multimedia memory 数据位于 `src/data/memoryPool.js`，字段包括：

```text
id, type, kind, label, text, image, caption,
date, location, source, sourceUrl,
audio, audioId, audioType, audioCaption, audioSource, audioSourceUrl,
isQuote, verified, isPrototype, relationship
```

`kind` 支持 `TEXT_MEMORY`、`IMAGE_ARCHIVE`、`AUDIO_ARCHIVE`、`PAIRED_MEMORY`；`relationship` 支持 `independent` 与 `verified-pair`。独立类型在数据构造阶段禁止混入其他媒体，verified pair 则必须显式声明关系并通过核实。`verified: true` 与 `isPrototype: true` 不允许同时存在。资源放置和来源登记规范见 `public/assets/memories/README.md`。缺失图片显示安静的中性占位，缺失音频则让独立声音指示器快速淡出；不会出现破图图标或把声音改配给其他记忆。

当前 PNG 场景：

- 每个 BloomEvent 生成 `22–34` 个 PNG 实例
- 草叶 `7600`
- 可视草场 `44`，视觉地面 `52`，射线交互范围仍为 `32`
- 雾色 `0x2b2335`，范围 `9.5–31`
- PNG 花朵色调 `0xececf5`，透明度 `0.96`
- 注意力半径 `2.65` 世界单位；最低完整寿命 `8s`
- 无关注时 attention 每秒衰减 `0.075`，阈值 `0.2`
- 消散持续 `4.6s`
- 每个 PNG 变体只预采样一次：缓存 `1024` 个带 alpha、原图线性色彩、花心与边缘权重的轮廓点；每株花稳定使用约 `113` 个花体点和 `1` 个花心点
- 每个 BloomPatch 的全部花朵都使用粒子主体；PNG InstancedMesh 花卡最高只显示 `11%`，不再作为主要花面
- 花体点与花心微光共用 `262144` 槽的单个稳定槽位 `THREE.Points` 对象；patch 光晕由整簇花心共同贡献，不再绘制独立的大圆形 glow。池压力过高时按整簇统一降低每株采样数，不随机丢掉整朵花
- 稳定粒子的花形、出生位置、边缘权重和漂移方向只在生命周期节点写入；逐帧只上传花矩阵纹理和每个 patch 的四浮点状态，聚合、呼吸、注视和碎裂在顶点着色器中解析计算，不再逐粒子进行 CPU 动画更新
- 粒子从根部附近聚合约 `0.95s`，短暂停留 `0.32s`，再用 `0.72s` 沉静为稳定花面；关注时亮度与凝聚度轻微提高
- 花心 glow 强度/半径 `0.15 / 6.5`；patch glow 强度/时长 `0.006 / 0.85s`
- 消散按花瓣边缘权重先后碎裂，breakup `0.42`，轻微表面漂移 `0.003`
- PNG 页面启用 `EffectComposer + UnrealBloomPass + OutputPass` 的高阈值全场 HDR bloom；普通草地和花卡保持在提取阈值以下。没有体积光或 DOF
- 花形碎片使用独立的 `512` 槽稳定环形池：初始活跃粒子为 `0`，BloomEvent 生长触发 `1` 组、记忆卡出现触发 `1` 组、BloomPatch 消散触发 `2` 组，1 次 draw call、每帧 0 次逐粒子 CPU 更新
- 碎片复用原 PNG 的 alpha/颜色采样，以残缺花冠轮廓从对应世界坐标向上轻轻漂移、散开和淡出；生长寿命 `3.4–4.7s`，卡片寿命 `4.1–5.6s`，消散寿命 `4.5–6.2s`
- 花园内的可选留言弹窗几何居中：桌面和手机都使用 `place-items: center`。这一规则只影响入口大面板；后续小记忆卡使用上半屏带状布局

## 测试与构建

```bash
npm test
npm run build
```

测试覆盖：

- 非线性 BloomEvent 花簇生成
- 20,000 实例容量与 Reset
- 五批 PNG InstancedMesh
- PNG alpha 轮廓采样、中心检测和实例矩阵读取
- 底部锚点与相机朝向
- PNG 场景配置与 GLB 默认值隔离
- BloomEvent `memoryId` 和订阅
- BloomPatch 最低寿命、注意力维持、消散清理与实例槽复用
- PNG renderer 的局部实例槽回收
- 本地 memoryPool
- 记忆手势配置上限
- 事件花碎片的初始空状态、三类触发、稳定槽位、透明深度与解析式寿命

当前自动化套件共 `71` 项，覆盖访客媒体类型识别、纯附件及配文提交、访客媒体与档案声音分开调度，也含原版自由缩放与流动地图三级滚动切换、原版 85 处及流动地图 137 处地点的地图路由、矢量图幅校验及街区的多级坐标覆盖、点位分组、双语选花、花卡避让和记忆来源测试，也覆盖中英文界面文案、原型留言译文与访客原文保护、统一多媒体 memory schema、文字/图片/音频卡视图模型、verified/prototype 安全约束、视觉 `1:1` shuffle-bag、视觉/声音分离调度、TEXT 内部来源配比与近期重复保护、LUFS 报告、相对 ducking、非阻塞图片预载、音频混音与卡片时长配置、解析式粒子路径、槽位代际复用和 Bloom 资源预算门槛。

生产构建目前有一个非致命的 `>500 kB` 共享 chunk 提示，不影响运行。

## 资产与离线文件

运行所需的五张 PNG 和 GLB 都已经保存在 `public/assets/flowers/`。源素材和 Blender 文件也保存在项目中的 `图片素材/`、`模型/`。

根目录的 `紫金草花田-离线版.html` 是较早的独立版本，不代表当前 PNG 记忆交互。当前功能应以 Vite 的 `/png.html` 为准。不要在未重新设计、生成并完整验证离线构建脚本前，把旧离线文件当作主版本。

## 下一步

1. 按真实展览节奏微调 attention 半径、寿命和粒子密度，不改现有花簇形状。
2. 接入 MediaPipe 手部识别，并让手部地面投影驱动同一个 attention field。
3. 保留 MouseInput 作为 fallback。
4. 每次大改前保留当前稳定 PNG 版本的 Git checkpoint。
