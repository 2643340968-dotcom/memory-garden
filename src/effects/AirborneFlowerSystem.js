import * as THREE from "three";

const AIRBORNE_FLOWER_DISTANCE = 8;
const TEXTURE_WIDTH = 256;

export const AIRBORNE_FLOWER_CONFIG = Object.freeze({
  count: 5,
  distance: AIRBORNE_FLOWER_DISTANCE,
  accents: Object.freeze([
    Object.freeze({
      variantIndex: 0,
      ndcX: -0.72,
      ndcY: 0.38,
      height: 0.062,
      opacity: 0.2,
      phase: 0.25,
      speed: 0.22,
      driftX: 0.018,
      driftY: 0.014,
      rotation: -0.12,
      rotationAmount: 0.035,
      cropHeight: 0.34,
      mobileVisible: true,
    }),
    Object.freeze({
      variantIndex: 2,
      ndcX: -0.43,
      ndcY: 0.18,
      height: 0.045,
      opacity: 0.15,
      phase: 1.8,
      speed: 0.18,
      driftX: 0.012,
      driftY: 0.018,
      rotation: 0.09,
      rotationAmount: 0.028,
      cropHeight: 0.31,
      mobileVisible: false,
    }),
    Object.freeze({
      variantIndex: 4,
      ndcX: 0.08,
      ndcY: 0.48,
      height: 0.038,
      opacity: 0.12,
      phase: 3.15,
      speed: 0.16,
      driftX: 0.01,
      driftY: 0.013,
      rotation: -0.04,
      rotationAmount: 0.025,
      cropHeight: 0.29,
      mobileVisible: false,
    }),
    Object.freeze({
      variantIndex: 3,
      ndcX: 0.45,
      ndcY: 0.24,
      height: 0.052,
      opacity: 0.17,
      phase: 4.4,
      speed: 0.2,
      driftX: 0.016,
      driftY: 0.014,
      rotation: 0.12,
      rotationAmount: 0.032,
      cropHeight: 0.33,
      mobileVisible: true,
    }),
    Object.freeze({
      variantIndex: 1,
      ndcX: 0.76,
      ndcY: 0.4,
      height: 0.056,
      opacity: 0.18,
      phase: 5.65,
      speed: 0.17,
      driftX: 0.014,
      driftY: 0.019,
      rotation: -0.08,
      rotationAmount: 0.03,
      cropHeight: 0.32,
      mobileVisible: true,
    }),
  ]),
});

function createDetachedBlossomTexture(sourceTexture, cropHeight, index) {
  const image = sourceTexture?.image ?? sourceTexture?.source?.data;
  const sourceWidth = image?.naturalWidth ?? image?.width ?? 0;
  const sourceHeight = image?.naturalHeight ?? image?.height ?? 0;

  if (!image || sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error(`Airborne flower source ${index + 1} is unavailable.`);
  }

  const sourceCropHeight = Math.max(1, Math.floor(sourceHeight * cropHeight));
  const cropAspect = sourceWidth / sourceCropHeight;
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_WIDTH;
  canvas.height = Math.max(1, Math.round(TEXTURE_WIDTH / cropAspect));
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Airborne flower canvas is unavailable.");
  }

  context.drawImage(
    image,
    0,
    0,
    sourceWidth,
    sourceCropHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const texture = new THREE.CanvasTexture(canvas);
  texture.name = `AirborneZijincaoTexture-${index + 1}`;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  return { texture, aspect: cropAspect };
}

export class AirborneFlowerSystem {
  constructor({
    scene,
    camera,
    flowerRenderer,
    config = AIRBORNE_FLOWER_CONFIG,
  }) {
    if (!Array.isArray(flowerRenderer?.textures)) {
      throw new TypeError(
        "Airborne flowers require the loaded PNG flower textures.",
      );
    }

    this.scene = scene;
    this.camera = camera;
    this.config = config;
    this.group = new THREE.Group();
    this.group.name = "AirborneMemoryFlowers";
    this.group.renderOrder = 3;
    this.accents = [];
    this.ndcPoint = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.worldPoint = new THREE.Vector3();

    config.accents.slice(0, config.count).forEach((accentConfig, index) => {
      const sourceTexture = flowerRenderer.textures[accentConfig.variantIndex];
      const { texture, aspect } = createDetachedBlossomTexture(
        sourceTexture,
        accentConfig.cropHeight,
        index,
      );
      const material = new THREE.SpriteMaterial({
        name: `AirborneZijincaoMaterial-${index + 1}`,
        map: texture,
        color: 0xe4deef,
        opacity: accentConfig.opacity,
        transparent: true,
        alphaTest: 0.025,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      });
      material.rotation = accentConfig.rotation;

      const sprite = new THREE.Sprite(material);
      sprite.name = `AirborneZijincao-${index + 1}`;
      sprite.center.set(0.5, 0.48);
      sprite.frustumCulled = false;
      sprite.renderOrder = 3;
      sprite.userData.decorative = true;
      sprite.userData.pointerInteractive = false;
      this.group.add(sprite);
      this.accents.push({
        config: accentConfig,
        sprite,
        material,
        texture,
        aspect,
      });
    });

    scene.add(this.group);
    this.resize();
    this.update(0);
  }

  projectNdcAtDistance(ndcX, ndcY, target) {
    this.ndcPoint.set(ndcX, ndcY, 0).unproject(this.camera);
    this.direction
      .copy(this.ndcPoint)
      .sub(this.camera.position)
      .normalize();
    return target
      .copy(this.camera.position)
      .addScaledVector(this.direction, this.config.distance);
  }

  resize() {
    const viewportHeightAtDistance =
      2 *
      Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5)) *
      this.config.distance;
    const isNarrow = this.camera.aspect < 0.72;

    this.accents.forEach((accent) => {
      const height = viewportHeightAtDistance * accent.config.height;
      accent.sprite.scale.set(height * accent.aspect, height, 1);
      accent.sprite.visible = !isNarrow || accent.config.mobileVisible;
    });
  }

  update(timeSeconds = 0) {
    this.accents.forEach((accent) => {
      if (!accent.sprite.visible) {
        return;
      }
      const { config, sprite, material } = accent;
      const phase = timeSeconds * config.speed + config.phase;
      const ndcX = config.ndcX + Math.sin(phase) * config.driftX;
      const ndcY =
        config.ndcY + Math.sin(phase * 0.73 + config.phase) * config.driftY;
      this.projectNdcAtDistance(ndcX, ndcY, this.worldPoint);
      sprite.position.copy(this.worldPoint);
      material.rotation =
        config.rotation + Math.sin(phase * 0.61) * config.rotationAmount;
      material.opacity =
        config.opacity * THREE.MathUtils.lerp(0.92, 1, (Math.sin(phase) + 1) * 0.5);
    });
  }

  dispose() {
    this.scene.remove(this.group);
    this.accents.forEach(({ material, texture }) => {
      material.dispose();
      texture.dispose();
    });
    this.group.clear();
    this.accents.length = 0;
  }
}

export function createAirborneFlowerSystem(options) {
  return new AirborneFlowerSystem(options);
}
