import * as THREE from "three";

export function createLights(scene) {
  const hemisphere = new THREE.HemisphereLight(0xe9f2ff, 0x405236, 2.45);
  scene.add(hemisphere);

  const sunlight = new THREE.DirectionalLight(0xfff2d6, 2.2);
  sunlight.position.set(-7, 10, 5);
  sunlight.target.position.set(0, 0, -6);
  scene.add(sunlight, sunlight.target);

  return { hemisphere, sunlight };
}

