import * as THREE from "three";
import { CONFIG } from "../config.js";

export function createScene() {
  const scene = new THREE.Scene();
  const fogColor = new THREE.Color(CONFIG.FOG.color);

  scene.background = fogColor;
  scene.fog = new THREE.Fog(fogColor, CONFIG.FOG.near, CONFIG.FOG.far);

  return scene;
}

