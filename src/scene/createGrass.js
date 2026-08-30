import * as THREE from "three";
import { CONFIG } from "../config.js";
import { createSeededRandom, randomRange } from "../utils/random.js";

export function createGrass(scene) {
  if (!CONFIG.GRASS_ENABLED || CONFIG.GRASS_COUNT <= 0) {
    return null;
  }

  const random = createSeededRandom(0x91c7a53);
  const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
  geometry.translate(0, 0.5, 0);

  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    vertexColors: true,
    fog: true,
  });

  const grass = new THREE.InstancedMesh(geometry, material, CONFIG.GRASS_COUNT);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const palette = CONFIG.GRASS_COLORS.map((value) => new THREE.Color(value));
  const halfSize = CONFIG.GROUND_SIZE * 0.49;

  for (let index = 0; index < CONFIG.GRASS_COUNT; index += 1) {
    const height = randomRange(random, CONFIG.GRASS_HEIGHT_MIN, CONFIG.GRASS_HEIGHT_MAX);
    const width = randomRange(random, CONFIG.GRASS_WIDTH_MIN, CONFIG.GRASS_WIDTH_MAX);

    dummy.position.set(
      randomRange(random, -halfSize, halfSize),
      0.006,
      randomRange(random, -halfSize, halfSize),
    );
    dummy.rotation.set(
      randomRange(random, -0.06, 0.06),
      randomRange(random, 0, Math.PI * 2),
      randomRange(random, -0.08, 0.08),
    );
    dummy.scale.set(width, height, 1);
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
