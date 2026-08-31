import * as THREE from "three";

export function createLights(scene, config = {}) {
  const lighting = config.LIGHTING ?? {};
  const hemisphere = new THREE.HemisphereLight(
    lighting.hemisphereSky ?? 0xe9f2ff,
    lighting.hemisphereGround ?? 0x405236,
    lighting.hemisphereIntensity ?? 2.45,
  );
  scene.add(hemisphere);

  const sunlight = new THREE.DirectionalLight(
    lighting.directionalColor ?? 0xfff2d6,
    lighting.directionalIntensity ?? 2.2,
  );
  const directionalPosition = lighting.directionalPosition ?? {
    x: -7,
    y: 10,
    z: 5,
  };
  const directionalTarget = lighting.directionalTarget ?? {
    x: 0,
    y: 0,
    z: -6,
  };
  sunlight.position.set(
    directionalPosition.x,
    directionalPosition.y,
    directionalPosition.z,
  );
  sunlight.target.position.set(
    directionalTarget.x,
    directionalTarget.y,
    directionalTarget.z,
  );
  scene.add(sunlight, sunlight.target);

  let overheadGlow = null;
  if (lighting.overheadGlow?.enabled) {
    const glowConfig = lighting.overheadGlow;
    overheadGlow = new THREE.SpotLight(
      glowConfig.color,
      glowConfig.intensity,
      glowConfig.distance,
      glowConfig.angle,
      glowConfig.penumbra,
      glowConfig.decay,
    );
    overheadGlow.name = "MemoryOverheadGlow";
    overheadGlow.castShadow = false;
    overheadGlow.position.set(
      glowConfig.position.x,
      glowConfig.position.y,
      glowConfig.position.z,
    );
    overheadGlow.target.position.set(
      glowConfig.target.x,
      glowConfig.target.y,
      glowConfig.target.z,
    );
    scene.add(overheadGlow, overheadGlow.target);
  }

  return { hemisphere, sunlight, overheadGlow };
}
