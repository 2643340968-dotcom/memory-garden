# 记忆花园 / Memory Garden

《记忆之场》的全国地图以五座城市为入口，共收录 85 处地点。南京有 21 处，北京 22 处，敦煌 8 处，成都 18 处，泉州 16 处。每一处都可以进入花园、阅读当地资料、留下记忆。江东门完整演示留言化为一簇紫金草的过程，其余地点显示本次到访的保存回执。花园按需加载，共用 Three.js 渲染器，每处有独立的资料、留言和草稿。

完整的项目交接、技术规则、配置值和下一步计划见 [`AGENTS.md`](./AGENTS.md)。

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

本项目约定每一轮修改完成后都必须：测试与浏览器验收、提交、推送 `main`、等待 Pages 工作流成功，并确认公开 `/memory-garden/png.html` 返回 HTTP 200 且包含最新版本。不要只停留在本地版本。

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
| `/flow.html` | `src/flow/main.js` | 网点印刷地图、水波悬停与俯视记忆花园 |
| `/model.html` | `src/model-main.js` | 留存的旧 GLB 花朵版本；不再作为日常开发与验收目标 |
| `/` | `src/main.js` | 由 index.html 相对跳转到 PNG 主入口 |

两个页面分别创建自己的场景和运行时状态，种花与 Reset 不会互相影响。

修改流动地图时同时验收 `/flow.html` 和原入口 `/png.html`，并核对两者的公开版本。

## 流动地图

全国、城市和街区使用同一组四色网点。网点登记在地理坐标上，放大时逐级细分，河道、绿地、建筑和街巷的矢量形状决定每颗点的位置、墨色和大小。鼠标掠过能拨动网点。悬停或键盘聚焦某个地点会释放水纹，邻近水纹相遇时会共同改变网点的运动，移开后逐渐平息。WebGL 和 Canvas 2D 使用同一组点和位移计算。

点选单一地点时，镜头先抵达近景，水色随后过渡到该地的俯视花园。通过缩放和平移可以一直在地图内浏览。

开场、城市和入园题页可跳过，导览按钮可重看题页或展开图例。俯视花园中，带光的印记打开精选资料，小印记打开个人或档案片段。访客可以自由浏览，也可以在同一卡片提交文字、图片、音频或视频。每个地点分别保存本次页面打开期间的留言与草稿。

## 当前 PNG 体验

从 `/png.html` 进入暖纸色的全国地图，五朵花标记五座城市。悬停或用键盘聚焦花标时，地图轻轻向该位置靠近，坐标旁浮出代表花的粒子花影、花名与选花短文。移开鼠标会回到原来的视野。进入城市后，相邻地点共用一朵带数字的花标，点击可展开。手机点选城市或地点即可阅读花卡。地点介绍旁有资料链接和「进入花园」入口。

全国、城市和地点各有一次短促的镜头定位。滚轮、缩放按钮和双指都可以在节点之间自由改变比例，反向操作就能中断镜头并拉回。标题、顶部路径、花标、地点计数与网址随层级同步更新。悬停只预览，点击当前路径名称可以重新居中。系统开启减少动态效果时，地图直接就位。

底图和圆形放大镜共用本地矢量图包。镜头移动时先移动已有图幅，后台绘制新比例的道路和建筑。85 处地点均有街区图幅。地点的墨色标记、粒子图案和名称优先占位，街名会避开它们。中文标题、地图地名和留言使用随网页加载的 Noto Serif SC 宋体子集，并按中文字形调整行距与字距。

首页标题是「记忆之场」。进入任一地点时，地图淡入当地色调，颗粒聚成该地的代表花，中央显出「记忆花园」和地名，再淡入花田。可以点击「跳过过场」或按 Esc，开启减少动态效果时会显示静态题页。

每个花园最初开放三簇花。点击花簇可阅读当地资料，拖动可唤出更多花簇和卡片，键盘聚焦花田后也可按回车探索。「留下记忆」随时可以打开或取消。85 处地点共用一张留言卡，可以只写文字，只选一张图片、一段音频或一段视频，也可以给文件配上文字。选好后可在卡内预览、更换或移除。提交后可在卡内的「我在这里留下的记忆」重看或播放，点击带附件的花簇也能打开这张卡。留言和草稿按地点保存在当前页面，文件只在浏览器本地读取，刷新后清除。返回地图会恢复地点、平移位置及缩放比例，花园停止绘制并淡出声音。

### 地图与场所内容

城市和地图路由在 `src/atlas/places.js`。桌面、触屏和悬停放大镜共用 Web Mercator 投影与 Canvas 矢量绘制。全国图的地形刻线、海岸、省界与河流取自 Natural Earth。五城街区沿用 2026-11-15 的 OpenFreeMap 数据，覆盖第 6 至 14 级。拉近每个地点时，道路、建筑和水岸都会按当前比例和屏幕像素密度重新绘制。江东门标记取纪念馆代表点 32.03759°N、118.73659°E。[Natural Earth](https://www.naturalearthdata.com/) · [OpenFreeMap](https://openfreemap.org/) · [OpenMapTiles](https://openmaptiles.org/) · [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) · [Wikidata Q32391](https://www.wikidata.org/wiki/Q32391)

`scripts/build-atlas-vectors.py` 从原始地理数据生成 `src/atlas/maps/vector-index.json` 与 `public/assets/atlas-vectors/` 下带内容摘要的压缩路径。页面按当前视野向本站请求数据，细节加载期间沿用相同坐标的上一级图幅。

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

当前自动化套件共 `37` 项，覆盖访客媒体类型识别、纯附件及配文提交、访客媒体与档案声音分开调度，也含自由缩放和跨级手势、85 处地点的地图路由、矢量图幅校验及街区的多级坐标覆盖、点位分组、双语选花、花卡避让和记忆来源测试，也覆盖中英文界面文案、原型留言译文与访客原文保护、统一多媒体 memory schema、文字/图片/音频卡视图模型、verified/prototype 安全约束、视觉 `1:1` shuffle-bag、视觉/声音分离调度、TEXT 内部来源配比与近期重复保护、LUFS 报告、相对 ducking、非阻塞图片预载、音频混音与卡片时长配置、解析式粒子路径、槽位代际复用和 Bloom 资源预算门槛。

生产构建目前有一个非致命的 `>500 kB` 共享 chunk 提示，不影响运行。

## 资产与离线文件

运行所需的五张 PNG 和 GLB 都已经保存在 `public/assets/flowers/`。源素材和 Blender 文件也保存在项目中的 `图片素材/`、`模型/`。

根目录的 `紫金草花田-离线版.html` 是较早的独立版本，不代表当前 PNG 记忆交互。当前功能应以 Vite 的 `/png.html` 为准。不要在未重新设计、生成并完整验证离线构建脚本前，把旧离线文件当作主版本。

## 下一步

1. 按真实展览节奏微调 attention 半径、寿命和粒子密度，不改现有花簇形状。
2. 接入 MediaPipe 手部识别，并让手部地面投影驱动同一个 attention field。
3. 保留 MouseInput 作为 fallback。
4. 每次大改前保留当前稳定 PNG 版本的 Git checkpoint。
