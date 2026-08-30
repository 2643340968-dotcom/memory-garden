# 紫金草 · Flower Trace

一个使用 Vite、Vanilla JavaScript 和 Three.js 搭建的可运行鼠标交互花田 Demo。按住鼠标左键拖动，屏幕坐标会通过 `GroundRaycaster` 转成地面世界坐标，再沿连续路径生成带多个不规则子簇的花丛。

## 启动

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

## 无需服务器的离线版

直接双击项目根目录中的 `紫金草花田-离线版.html` 即可打开。该文件已经内联 Three.js 程序、页面样式和当前所需资源，不依赖 `node_modules`，也不需要运行任何命令。

源码发生修改后，可用下面的命令重新生成离线文件：

```bash
npm run build:offline
```

容量与全场种植回归测试：

```bash
npm test
```

## 核心数据流

```text
MouseInput
    ↓ normalized x / y / active
PointerController
    ↓
GroundRaycaster
    ↓ Three.js world position
FlowerSpawner
    ↓ distance threshold + cooldown + capped BloomEvent anchors
FlowerSystem
    ↓ precomputed screen-space bloom + wave growth + sway
InstancedMesh
```

`MouseInput` 只负责把鼠标转成统一指针状态。`FlowerSystem` 不知道输入来自鼠标，因此未来接入 MediaPipe 时不需要重写种花、路径插值或花朵动画。

## 目录

```text
src/
  main.js
  config.js
  styles.css
  scene/
    createScene.js
    createCamera.js
    createRenderer.js
    createLights.js
    createGround.js
    createGrass.js
    createHitMarker.js
  input/
    PointerController.js
    MouseInput.js
  interaction/
    GroundRaycaster.js
  flowers/
    BloomEvent.js
    FlowerAssetLoader.js
    FlowerSystem.js
    FlowerSpawner.js
    FlowerAnimation.js
  utils/
    random.js
public/
  assets/
    flowers/
      zijincao.glb
    grass/
```

## 调整参数

所有关键参数集中在 `src/config.js`：

- 地面、相机、雾：`GROUND_SIZE`、`CAMERA_*`、`FOG`
- 爆发节奏：`BLOOM_TRIGGER_DISTANCE`、`BLOOM_TRIGGER_COOLDOWN`
- 爆发面积：`BLOOM_RADIUS_MIN/MAX`、`BLOOM_RADIUS_PX_SCALE`
- 花量与形状：`FLOWERS_PER_BLOOM_MIN/MAX`、`BLOOM_LOBE_MIN/MAX`
- 波状生长：`BLOOM_DURATION_*`、`BLOOM_DELAY_MAX`、`BLOOM_OUTWARD_DELAY`
- 膨出手感：`BLOOM_OVERSHOOT`、`BLOOM_START_SCALE`、`BLOOM_START_Y_OFFSET`
- 花朵：`MAX_FLOWERS`、`FLOWER_*`
- 生长和风：`BLOOM_*`、`SWAY_*`、`SETTLED_SWAY_UPDATES_PER_FRAME`
- 草地：`GRASS_*`

当前总容量为 20,000 株。现有 GLB 包含一个网格和一个材质，因此花朵只增加一个 `InstancedMesh` 绘制批次，并为该批次分配 20,000 个实例槽位；成熟花朵的风摆矩阵采用分帧轮询更新，以限制高密度状态下的每帧 CPU 工作量。

## 替换正式 GLB

把新模型放到 `public/assets/flowers/zijincao.glb`，或修改 `src/config.js` 中的 `FLOWER_MODEL_PATH`。`FlowerAssetLoader.js` 会在启动时只加载一次模型，并完成：

- 遍历真实 Mesh、材质和贴图；
- 烘焙子节点世界变换；
- 依据包围盒把最低点校正到地面；
- 按 `FLOWER_BASE_HEIGHT` 计算统一归一化比例；
- 为每个源网格建立共享材质的 `InstancedMesh`。

## 未来接入 MediaPipe HandInput

新增 `src/input/HandInput.js`，把 `indexFingerTip.x/y` 转为 Three.js NDC，然后调用：

```js
pointerController.updatePointer(ndcX, ndcY, isPlanting, true);
```

切换输入模式时只在 `main.js` 中实例化 `MouseInput` 或 `HandInput`。以下模块无需修改：

- `GroundRaycaster`
- `FlowerSpawner`
- `FlowerSystem`
- `FlowerAnimation`

鼠标输入应继续保留，作为摄像头不可用时的 fallback。

## 当前临时部分

- 草叶是低面数程序化 `InstancedMesh`，无草地贴图和 Shader Wind。
- 风摆使用 CPU 端轻量正弦旋转，未来可替换成 Shader Wind。
- 暂无 MediaPipe、摄像头、后端、复杂后期、Bloom 或 DOF。
