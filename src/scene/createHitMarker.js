import * as THREE from "three";
import { CONFIG } from "../config.js";

export function createHitMarker(scene) {
  const group = new THREE.Group();
  const fillMaterial = new THREE.MeshBasicMaterial({
    color: CONFIG.HIT_MARKER_IDLE_COLOR,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  });
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: CONFIG.HIT_MARKER_IDLE_COLOR,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const fill = new THREE.Mesh(new THREE.CircleGeometry(0.07, 24), fillMaterial);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.09, 0.105, 32), ringMaterial);
  fill.rotation.x = -Math.PI / 2;
  ring.rotation.x = -Math.PI / 2;
  group.add(fill, ring);
  group.visible = false;
  group.renderOrder = 2;
  scene.add(group);

  group.setPlanting = (active) => {
    const color = active
      ? CONFIG.HIT_MARKER_ACTIVE_COLOR
      : CONFIG.HIT_MARKER_IDLE_COLOR;
    fillMaterial.color.setHex(color);
    ringMaterial.color.setHex(color);
    group.scale.setScalar(active ? 1.22 : 1);
  };

  return group;
}

