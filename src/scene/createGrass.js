import * as THREE from "three";
import { CONFIG } from "../config.js";
import { createSeededRandom, randomRange } from "../utils/random.js";

function createGrassGeometry(tapered) {
  if (!tapered) {
    const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
    geometry.translate(0, 0.5, 0);
    return geometry;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        -0.5, 0, 0,
        0.5, 0, 0,
        0.18, 0.7, 0,
        0, 1, 0,
        -0.18, 0.7, 0,
      ],
      3,
    ),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 4, 4, 2, 3]);
  geometry.computeVertexNormals();
  return geometry;
}

export function createGrass(scene, config = CONFIG) {
  if (!config.GRASS_ENABLED || config.GRASS_COUNT <= 0) {
    return null;
  }

  const random = createSeededRandom(0x91c7a53);
  const geometry = createGrassGeometry(config.GRASS_TAPERED ?? false);

  const grassOpacity = config.GRASS_OPACITY ?? 1;
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    vertexColors: true,
    fog: true,
    transparent: grassOpacity < 1,
    opacity: grassOpacity,
  });

  const grass = new THREE.InstancedMesh(geometry, material, config.GRASS_COUNT);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const palette = config.GRASS_COLORS.map((value) => new THREE.Color(value));
  const fieldSize = config.GRASS_FIELD_SIZE ?? config.GROUND_SIZE;
  const halfSize = fieldSize * 0.5;
  const fieldCenterX = config.GRASS_FIELD_CENTER_X ?? 0;
  const fieldCenterZ = config.GRASS_FIELD_CENTER_Z ?? 0;
  const densityVariation = config.GRASS_DENSITY_VARIATION ?? 0;
  const edgeFadeWidth = config.GRASS_EDGE_FADE_WIDTH ?? 0;
  const edgeJitter = config.GRASS_EDGE_JITTER ?? 0;
  const distanceFadeStart = config.GRASS_DISTANCE_FADE_START ?? -Infinity;
  const distanceFadeEnd = config.GRASS_DISTANCE_FADE_END ?? -Infinity;
  const distanceMinScale = config.GRASS_DISTANCE_MIN_SCALE ?? 1;

  for (let index = 0; index < config.GRASS_COUNT; index += 1) {
    const height = randomRange(random, config.GRASS_HEIGHT_MIN, config.GRASS_HEIGHT_MAX);
    const width = randomRange(random, config.GRASS_WIDTH_MIN, config.GRASS_WIDTH_MAX);

    let x;
    let z;
    if (densityVariation <= 0) {
      x = fieldCenterX + randomRange(random, -halfSize, halfSize);
      z = fieldCenterZ + randomRange(random, -halfSize, halfSize);
    } else {
      let accepted = false;
      for (let attempt = 0; attempt < 10 && !accepted; attempt += 1) {
        x = fieldCenterX + randomRange(random, -halfSize, halfSize);
        z = fieldCenterZ + randomRange(random, -halfSize, halfSize);
        const patchSignal =
          (Math.sin(x * 0.63 + z * 0.17) +
            Math.sin(z * 0.47 - x * 0.21) +
            2) *
          0.25;
        const acceptance = 1 - densityVariation + densityVariation * patchSignal;
        accepted = random() <= acceptance;
      }
    }

    const edgeDistance = Math.min(
      halfSize - Math.abs(x - fieldCenterX),
      halfSize - Math.abs(z - fieldCenterZ),
    );
    const edgeVisibility =
      edgeFadeWidth > 0
        ? THREE.MathUtils.smoothstep(
            edgeDistance + randomRange(random, -edgeJitter, edgeJitter),
            0,
            edgeFadeWidth,
          )
        : 1;
    const distanceVisibility = Number.isFinite(distanceFadeStart)
      ? THREE.MathUtils.smoothstep(z, distanceFadeEnd, distanceFadeStart)
      : 1;
    const visibility = Math.min(edgeVisibility, distanceVisibility);
    const heightFade = THREE.MathUtils.lerp(
      distanceMinScale,
      1,
      visibility,
    );
    const widthFade = THREE.MathUtils.lerp(0.45, 1, visibility);

    dummy.position.set(
      x,
      0.006,
      z,
    );
    dummy.rotation.set(
      randomRange(random, -0.06, 0.06),
      randomRange(random, 0, Math.PI * 2),
      randomRange(random, -0.08, 0.08),
    );
    dummy.scale.set(width * widthFade, height * heightFade, 1);
    dummy.updateMatrix();

    grass.setMatrixAt(index, dummy.matrix);
    color.copy(palette[Math.floor(random() * palette.length)]);
    color.offsetHSL(randomRange(random, -0.015, 0.015), 0, randomRange(random, -0.035, 0.035));
    grass.setColorAt(index, color);
  }

  grass.name = "InstancedGrass";
  grass.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  grass.instanceMatrix.needsUpdate = true;
  grass.instanceColor.needsUpdate = true;
  grass.frustumCulled = false;
  scene.add(grass);

  return grass;
}
