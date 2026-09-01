# 记忆花园 / Memory Garden

基于 Vite、Vanilla JavaScript 和 Three.js 的互动纪念花田原型。当前主版本把五种透明 PNG 紫金草作为轮廓、颜色与花心采样蓝图，由一个固定容量的 `THREE.Points` 池绘制所有可见花体；很弱的 InstancedMesh 花卡只保留根部与轮廓连续性。页面上半幅保留缩小后的“记忆之场”标题，初始没有装饰粒子；只有花朵生长、记忆卡出现或花簇消散时，才会从对应花簇位置释放少量残缺花形碎片。访客先留下记忆，再通过鼠标拖拽让粒子以不规则花簇的形式聚合、生长，最后从花瓣边缘重新碎裂并释放实例槽。

完整的项目交接、技术规则、配置值和下一步计划见 [`AGENTS.md`](./AGENTS.md)。

## 新电脑 / 新会话启动

需要 Node.js `20.19+` 或 `22.12+`。

```bash
npm install
npm run dev
```

然后打开：

- 当前 PNG 主版本：`http://127.0.0.1:5173/memory-garden/png.html`
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
7. 分别打开 `/png.html` 和 `/model.html`，检查控制台。
8. 修改前先保留 Git checkpoint，尤其是粒子、MediaPipe 或渲染架构重构。

## 页面入口

| 页面 | 入口模块 | 用途 |
| --- | --- | --- |
| `/png.html` | `src/png-main.js` | 当前主版本；PNG 花朵、记忆入口、自动首次开花、Memory Echo |
| `/model.html` | `src/model-main.js` | 留存的旧 GLB 花朵版本；不再作为日常开发与验收目标 |
| `/` | `src/main.js` | 继续加载保留的 GLB 行为 |

两个页面分别创建自己的场景和运行时状态，种花与 Reset 不会互相影响。

当前后续开发、视觉验收和公开版本确认只针对 `/png.html`。模型版文件继续留存，但除非重新明确提出，不再为它安排每轮修改或回归检查。

## 当前 PNG 体验

```text
进入 /png.html
  → 记忆输入弹窗；种植锁定
  → 提交文字；记忆保存在本页 sessionMemories，同时由这次访客手势解锁声音
  → 弹窗淡出
  → 自动触发一个真实 BloomEvent
  → YOUR MEMORY 卡片出现在上半屏，并保持与花簇的水平关系
  → 花朵生长与卡片出现各释放一组短寿命花形碎片
  → 鼠标种植解锁
  → 每次拖拽可产生约 1–3 个 Memory Echo
  → 未来经核实的 Memory Echo 可以携带自身绑定的语音；当前 prototype 库保持静音
  → 光标附近花簇刷新 attention
  → 无人关注的旧花簇缓慢变暗、下沉，花瓣轮廓碎裂成粒子并消失
  → 花簇进入消散时再释放两组轻微上升、散开并淡出的碎片
  → 卡片淡出；Reset 不重开入口
```

Memory Echo 使用半透明深紫玻璃、`20px` 背景模糊、淡紫边框与低强度光晕。统一数据结构支持 `text` 和 `image` 两种记忆，并可附加 `audio`、`audioId`、`audioType`、`audioCaption`：文字卡保持轻量，图片卡包含一张图、短说明和可选的日期/地点/来源行，音频卡只增加克制的播放状态行。当前两张图片是明确标注的本地占位资源，并非真实史料。卡片保留 BloomEvent 世界坐标投影产生的水平关系，但顶部约束从视口高度 `20%` 开始，最迟结束在 `42%`，同时卡片底部不超过约 `58%`；之后再尝试四个候选位置并进行简单重叠检测。它们始终使用 `pointer-events: none`。

页面初始完全静音，只有第一次有效提交留言时才解锁 Web Audio。当前没有合适 BGM，因此 `BGM_URL` 有意保持为空，不会请求缺失资源；BGM 循环、淡入淡出和语音 ducking 接口已经保留。当前运行时数据库不包含历史语音，未核实 MP3 不进入公开页面。未来每一段经核实语音都必须和文字/图片、地点、时间、来源写在同一条 memory 记录里，由一个可复用的 `THREE.Audio` 通道播放；系统不会分别随机抽取图片与声音。

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

First memory submission
  → AudioManager unlock
  → optional BGM bus (currently unconfigured)
  → one reusable memory-voice channel
  → restrained bloom / card cues
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
  archive-placeholder-01.svg
  archive-placeholder-02.svg
  README.md
  images/
  audio/
  bgm/
```

## 关键配置

- 全局容量：`src/config.js` → `MAX_FLOWERS = 20000`
- PNG 花朵与暗夜场景：`src/flowers/renderers/PNGFlowerConfig.js`
- 记忆卡与单次拖拽节奏：`src/memory/MemoryExperience.js` → `MEMORY_UI_CONFIG`
- 音频混音、淡入淡出、ducking、语音卡片时长和提示音冷却：`src/audio/AudioConfig.js` → `AUDIO_CONFIG`
- 花簇注意力、消散和粒子：`src/flowers/BloomPatchConfig.js` → `BLOOM_PATCH_CONFIG`
- 事件驱动花形碎片：`src/effects/AirborneFlowerSystem.js` → `AIRBORNE_FLOWER_CONFIG`
- Vite 多入口：`vite.config.js`

当前记忆节奏：

- 单次拖拽最多 `3` 条记忆
- 同时最多 `3` 张卡片
- 第一条在本次拖拽的第 `1` 个 BloomEvent
- 后续每 `2–3` 个 BloomEvent，或移动 `1.75` 世界单位
- 卡片停留 `4200ms`，退场 `700ms`
- 文字卡宽 `270px`，图片卡宽 `286px`，视口安全边距 `30px`
- 卡片顶部从视口高度 `20%` 开始，最大为 `42%`，并附加 `58%` 的卡片底部上限；保留 `28%` 的花簇投影纵向影响，候选纵向间隔 `78px`，稳定随机偏移 `±22px`

当前声音节奏：

- 初始页不自动播放；第一次有效提交后状态从 `SOUND · WAITING` 变为 `SOUND ON`
- 当前没有 BGM 文件；未来 BGM 正常音量 `0.18`、语音期间 duck 到 `0.06`、淡入 `5s`、淡出 `1.4s`
- 语音音量 `0.72`，开始延迟 `480ms`，替换淡出 `280ms`，同一时间只保留一段
- 语音卡停留至音频结束后 `900ms`，最长 `24s`
- 音频 memory 的选择概率门槛为 `18%`；播放一条后至少经过 `2` 条静音 memory 才能再次选择音频
- 不在启动时批量加载音频；仅对已经选中的 memory 进行轻量预载。图片在浏览器空闲时最多预热 `2` 张，并在卡片排队时预载对应图片
- 开花提示音有 `850ms` 冷却和 `38%` 触发概率，记忆卡提示音冷却 `360ms`
- 页面左上角按钮控制全局声音；切页隐藏和恢复会渐变主音量，不直接破坏播放状态

正式 multimedia memory 数据位于 `src/data/memoryPool.js`，字段包括：

```text
id, type, kind, label, text, image, caption,
date, location, source, sourceUrl,
audio, audioId, audioType, audioCaption, audioSource, audioSourceUrl,
isQuote, verified, isPrototype
```

`verified: true` 与 `isPrototype: true` 不允许同时存在。资源放置和来源登记规范见 `public/assets/memories/README.md`。缺失图片显示安静的中性占位，缺失音频则保持普通静音卡片；不会出现破图图标或把声音改配给其他记忆。

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
- 首页留言弹窗恢复为几何居中：桌面和手机都使用 `place-items: center`。这一规则只影响入口大面板；后续小记忆卡使用上半屏带状布局

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

当前自动化套件共 `19` 项，并额外覆盖统一多媒体 memory schema、文字/图片/音频卡视图模型、verified/prototype 安全约束、音频选择冷却、非阻塞图片预载、音频混音与卡片时长配置、解析式粒子路径、槽位代际复用和 Bloom 资源预算门槛。

生产构建目前有一个非致命的 `>500 kB` 共享 chunk 提示，不影响运行。

## 资产与离线文件

运行所需的五张 PNG 和 GLB 都已经保存在 `public/assets/flowers/`。源素材和 Blender 文件也保存在项目中的 `图片素材/`、`模型/`。

根目录的 `紫金草花田-离线版.html` 是较早的独立版本，不代表当前 PNG 记忆交互。当前功能应以 Vite 的 `/png.html` 为准。不要在未重新设计、生成并完整验证离线构建脚本前，把旧离线文件当作主版本。

## 下一步

1. 按真实展览节奏微调 attention 半径、寿命和粒子密度，不改现有花簇形状。
2. 接入 MediaPipe 手部识别，并让手部地面投影驱动同一个 attention field。
3. 保留 MouseInput 作为 fallback。
4. 每次大改前保留当前稳定 PNG 版本的 Git checkpoint。
