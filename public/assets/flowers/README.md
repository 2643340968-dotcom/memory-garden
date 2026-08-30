# Flower assets

The current demo loads `zijincao.glb` once through `GLTFLoader` in `src/flowers/FlowerAssetLoader.js`. Its source transform is baked into reusable geometry, its lowest bounding-box point is moved to local ground level, and the prepared geometry/material is rendered through `InstancedMesh`.

The older `zijincao-01.png` is retained only as a source/reference asset and is not used by the current flower renderer.

Replace `zijincao.glb` with another optimized glTF 2.0 binary when updating the flower. Keep the root close to the plant base when practical; the loader still applies a centralized vertical ground correction from the model bounding box.
