# Flower assets

The model page loads `zijincao.glb` once through `GLTFLoader` in `src/flowers/FlowerAssetLoader.js`. Its source transform is baked into reusable geometry, its lowest bounding-box point is moved to local ground level, and the prepared geometry/material is rendered through `ModelFlowerRenderer` and `InstancedMesh`.

The PNG page loads `png/zijincao_01.png` through `zijincao_05.png` once through `TextureLoader`. `PNGFlowerRenderer` applies the sRGB color space and creates one camera-facing, bottom-anchored `InstancedMesh` batch per variant. The alpha-tested `MeshBasicMaterial` keeps transparent empty pixels from writing large rectangular masks. The older `zijincao-01.png` and `zijincao-card.png` remain as source/reference copies and are not loaded by `png.html`.

Replace `zijincao.glb` with another optimized glTF 2.0 binary when updating the flower. Keep the root close to the plant base when practical; the loader still applies a centralized vertical ground correction from the model bounding box.
