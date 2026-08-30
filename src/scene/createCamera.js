import * as THREE from "three";
import { CONFIG } from "../config.js";

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(
    CONFIG.CAMERA_FOV,
    window.innerWidth / window.innerHeight,
    CONFIG.CAMERA_NEAR,
    CONFIG.CAMERA_FAR,
  );

  camera.position.set(
    CONFIG.CAMERA_POSITION.x,
    CONFIG.CAMERA_POSITION.y,
    CONFIG.CAMERA_POSITION.z,
  );
  camera.lookAt(
    CONFIG.CAMERA_LOOK_AT.x,
    CONFIG.CAMERA_LOOK_AT.y,
    CONFIG.CAMERA_LOOK_AT.z,
  );

  return camera;
}

