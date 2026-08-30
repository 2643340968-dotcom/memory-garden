import * as THREE from "three";
import { CONFIG } from "../config.js";

function createGroundTexture(renderer) {
  const size = 256;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });
  canvas.width = size;
  canvas.height = size;

  // Keep the generated map close to neutral so GROUND_COLOR remains the
  // single source of truth instead of being multiplied into a dark texture.
  context.fillStyle = "#d7dfd0";
  context.fillRect(0, 0, size, size);

  const image = context.getImageData(0, 0, size, size);
  for (let index = 0; index < image.data.length; index += 4) {
    const noise = (Math.random() - 0.5) * 20;
    image.data[index] = Math.max(0, Math.min(255, image.data[index] + noise * 0.55));
    image.data[index + 1] = Math.max(0, Math.min(255, image.data[index + 1] + noise));
    image.data[index + 2] = Math.max(0, Math.min(255, image.data[index + 2] + noise * 0.4));
  }
  context.putImageData(image, 0, 0);

  context.globalAlpha = 0.12;
  context.strokeStyle = "#74886a";
  context.lineWidth = 1;
  for (let index = 0; index < 90; index += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + (Math.random() - 0.5) * 4, y - Math.random() * 7);
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(10, 10);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());

  return texture;
}

export function createGround(scene, renderer) {
  const geometry = new THREE.PlaneGeometry(CONFIG.GROUND_SIZE, CONFIG.GROUND_SIZE);
  const texture = createGroundTexture(renderer);
  const material = new THREE.MeshStandardMaterial({
    color: CONFIG.GROUND_COLOR,
    map: texture,
    roughness: 1,
    metalness: 0,
  });
  const ground = new THREE.Mesh(geometry, material);

  ground.name = "PlantingGround";
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = false;
  scene.add(ground);

  return ground;
}
