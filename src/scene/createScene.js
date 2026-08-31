import * as THREE from "three";
import { CONFIG } from "../config.js";

export function createScene(config = CONFIG) {
  const scene = new THREE.Scene();
  const fogColor = new THREE.Color(config.FOG.color);

  scene.background = fogColor;
  scene.fog = new THREE.Fog(fogColor, config.FOG.near, config.FOG.far);

  return scene;
}
