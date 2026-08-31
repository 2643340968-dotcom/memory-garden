# 记忆花园 / Memory Garden

基于 Vite、Vanilla JavaScript 和 Three.js 的互动纪念花田原型。当前主版本把五种透明 PNG 紫金草作为轮廓、颜色与花心采样蓝图，由一个固定容量的 `THREE.Points` 池绘制所有可见花体；很弱的 InstancedMesh 花卡只保留根部与轮廓连续性。访客先留下记忆，再通过鼠标拖拽让粒子以不规则花簇的形式聚合、生长，最后从花瓣边缘重新碎裂并释放实例槽。

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
| `/model.html` | `src/model-main.js` | 保留的 GLB 花朵版本 |
| `/` | `src/main.js` | 继续加载保留的 GLB 行为 |

两个页面分别创建自己的场景和运行时状态，种花与 Reset 不会互相影响。

## 当前 PNG 体验

```text
进入 /png.html
  → 记忆输入弹窗；种植锁定
  → 提交文字；记忆保存在本页 sessionMemories
  → 弹窗淡出
  → 自动触发一个真实 BloomEvent
  → YOUR MEMORY 卡片出现在花簇附近
  → 鼠标种植解锁
  → 每次拖拽可产生约 1–3 个 Memory Echo
  → 光标附近花簇刷新 attention
  → 无人关注的旧花簇缓慢变暗、下沉，花瓣轮廓碎裂成粒子并消失
  → 卡片淡出；Reset 不重开入口
```

Memory Echo 使用半透明深紫玻璃、`20px` 背景模糊、淡紫边框与低强度光晕。卡片通过 BloomEvent 世界坐标投影到屏幕，尝试四个相邻方向并进行简单重叠检测；它们始终使用 `pointer-events: none`。

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
```

输入层与花朵系统解耦。未来的 `HandInput` 应与 `MouseInput` 一样，只更新 `PointerController`；鼠标模式需要继续作为摄像头不可用时的 fallback。

## 重要目录

```text
src/
  app/createFlowerFieldApp.js
  data/memoryPool.js
  memory/MemoryExperience.js
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
```

## 关键配置

- 全局容量：`src/config.js` → `MAX_FLOWERS = 20000`
- PNG 花朵与暗夜场景：`src/flowers/renderers/PNGFlowerConfig.js`
- 记忆卡与单次拖拽节奏：`src/memory/MemoryExperience.js` → `MEMORY_UI_CONFIG`
- 花簇注意力、消散和粒子：`src/flowers/BloomPatchConfig.js` → `BLOOM_PATCH_CONFIG`
- Vite 多入口：`vite.config.js`

当前记忆节奏：

- 单次拖拽最多 `3` 条记忆
- 同时最多 `3` 张卡片
- 第一条在本次拖拽的第 `1` 个 BloomEvent
- 后续每 `2–3` 个 BloomEvent，或移动 `1.75` 世界单位
- 卡片停留 `4200ms`，退场 `700ms`
- 卡片宽 `330px`，视口安全边距 `30px`

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

当前自动化套件共 `14` 项，并额外覆盖解析式粒子路径、槽位代际复用和 Bloom 资源预算门槛。

生产构建目前有一个非致命的 `>500 kB` 共享 chunk 提示，不影响运行。

## 资产与离线文件

运行所需的五张 PNG 和 GLB 都已经保存在 `public/assets/flowers/`。源素材和 Blender 文件也保存在项目中的 `图片素材/`、`模型/`。

根目录的 `紫金草花田-离线版.html` 是较早的独立版本，不代表当前 PNG 记忆交互。当前功能应以 Vite 的 `/png.html` 为准。不要在未重新设计、生成并完整验证离线构建脚本前，把旧离线文件当作主版本。

## 下一步

1. 按真实展览节奏微调 attention 半径、寿命和粒子密度，不改现有花簇形状。
2. 接入 MediaPipe 手部识别，并让手部地面投影驱动同一个 attention field。
3. 保留 MouseInput 作为 fallback。
4. 每次大改前保留当前稳定 PNG 版本的 Git checkpoint。
