import * as THREE from "three";

export class GroundRaycaster {
  constructor(camera, groundSize) {
    this.camera = camera;
    this.halfSize = groundSize * 0.495;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }

  getGroundPoint(normalizedX, normalizedY, target) {
    this.pointer.set(normalizedX, normalizedY);
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, target);
    if (!hit) {
      return false;
    }

    return Math.abs(target.x) <= this.halfSize && Math.abs(target.z) <= this.halfSize;
  }

  getGroundPointFromPixel(pixelX, pixelY, viewportWidth, viewportHeight, target) {
    const normalizedX = (pixelX / viewportWidth) * 2 - 1;
    const normalizedY = -(pixelY / viewportHeight) * 2 + 1;
    return this.getGroundPoint(normalizedX, normalizedY, target);
  }
}
