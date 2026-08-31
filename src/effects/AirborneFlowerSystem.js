import * as THREE from "three";
import { createSeededRandom, randomRange } from "../utils/random.js";

const AIRBORNE_FLOWER_DISTANCE = 8;
const TWO_PI = Math.PI * 2;
const MEMORY_LAVENDER = Object.freeze([0.73, 0.62, 0.98]);

export const AIRBORNE_FLOWER_CONFIG = Object.freeze({
  count: 5,
  distance: AIRBORNE_FLOWER_DISTANCE,
  pointSizeMin: 1.6,
  pointSizeMax: 2.85,
  accents: Object.freeze([
    Object.freeze({
      variantIndex: 0,
      pointCount: 104,
      ndcX: -0.72,
      ndcY: 0.38,
      height: 0.082,
      opacity: 0.38,
      phase: 0.25,
      speed: 0.42,
      driftX: 0.038,
      driftY: 0.034,
      rotation: -0.15,
      rotationAmount: 0.078,
      cropVMax: 0.4,
      completeness: 0.64,
      depthOffset: -0.35,
      mobileVisible: true,
    }),
    Object.freeze({
      variantIndex: 2,
      pointCount: 84,
      ndcX: -0.43,
      ndcY: 0.17,
      height: 0.061,
      opacity: 0.28,
      phase: 1.8,
      speed: 0.34,
      driftX: 0.029,
      driftY: 0.039,
      rotation: 0.12,
      rotationAmount: 0.062,
      cropVMax: 0.35,
      completeness: 0.52,
      depthOffset: 0.38,
      mobileVisible: false,
    }),
    Object.freeze({
      variantIndex: 4,
      pointCount: 72,
      ndcX: 0.08,
      ndcY: 0.49,
      height: 0.052,
      opacity: 0.24,
      phase: 3.15,
      speed: 0.3,
      driftX: 0.025,
      driftY: 0.03,
      rotation: -0.06,
      rotationAmount: 0.052,
      cropVMax: 0.38,
      completeness: 0.48,
      depthOffset: 0.62,
      mobileVisible: false,
    }),
    Object.freeze({
      variantIndex: 3,
      pointCount: 92,
      ndcX: 0.45,
      ndcY: 0.23,
      height: 0.07,
      opacity: 0.32,
      phase: 4.4,
      speed: 0.38,
      driftX: 0.035,
      driftY: 0.036,
      rotation: 0.16,
      rotationAmount: 0.072,
      cropVMax: 0.42,
      completeness: 0.58,
      depthOffset: 0.12,
      mobileVisible: true,
    }),
    Object.freeze({
      variantIndex: 1,
      pointCount: 98,
      ndcX: 0.76,
      ndcY: 0.4,
      height: 0.076,
      opacity: 0.35,
      phase: 5.65,
      speed: 0.33,
      driftX: 0.043,
      driftY: 0.041,
      rotation: -0.11,
      rotationAmount: 0.068,
      cropVMax: 0.39,
      completeness: 0.61,
      depthOffset: -0.08,
      mobileVisible: true,
    }),
  ]),
});

function smootherStep(value) {
  const progress = THREE.MathUtils.clamp(value, 0, 1);
  return progress * progress * (3 - 2 * progress);
}

function selectFragmentSamples(
  sampleSet,
  accentConfig,
  fragmentIndex,
  systemConfig,
) {
  const random = createSeededRandom(
    (0xa17b9d31 ^ (fragmentIndex + 1) * 0x45d9f3b) >>> 0,
  );
  const candidates = sampleSet.samples.filter(
    (sample) => sample.v <= accentConfig.cropVMax,
  );
  const source = candidates.length > 0 ? candidates : sampleSet.samples;
  const shuffled = [...source];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }

  const selected = [];
  const rejected = [];
  for (const sample of shuffled) {
    const breakupField =
      Math.sin(sample.u * 19.7 + sample.v * 11.3 + fragmentIndex * 1.9) *
        0.5 +
      Math.cos(sample.u * 8.4 - sample.v * 21.1 - fragmentIndex) * 0.5;
    const fragmentGate = smootherStep((breakupField + 0.48) / 1.28);
    const presence =
      accentConfig.completeness *
      (0.5 + sample.edge * 0.34 + sample.alpha * 0.2) *
      (0.28 + fragmentGate * 0.84);

    if (random() < presence) {
      selected.push(sample);
    } else {
      rejected.push(sample);
    }
    if (selected.length >= accentConfig.pointCount) {
      break;
    }
  }

  let rejectedIndex = 0;
  while (
    selected.length < accentConfig.pointCount &&
    rejected.length > 0
  ) {
    selected.push(rejected[rejectedIndex % rejected.length]);
    rejectedIndex += 1;
  }

  if (selected.length === 0) {
    throw new Error(`Airborne flower fragment ${fragmentIndex + 1} has no samples.`);
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  selected.forEach((sample) => {
    minX = Math.min(minX, sample.x);
    maxX = Math.max(maxX, sample.x);
    minY = Math.min(minY, sample.y);
    maxY = Math.max(maxY, sample.y);
  });
  const centerX = (minX + maxX) * 0.5;
  const centerY = (minY + maxY) * 0.5;
  const height = Math.max(1e-4, maxY - minY);

  return selected.map((sample) => ({
    localX: (sample.x - centerX) / height,
    localY: (sample.y - centerY) / height,
    alpha: sample.alpha,
    edge: sample.edge,
    color: sample.color,
    pointPhase: random() * TWO_PI,
    pointSize: randomRange(
      random,
      systemConfig.pointSizeMin,
      systemConfig.pointSizeMax,
    ),
  }));
}

function createParticleMaterial(pixelRatio) {
  return new THREE.ShaderMaterial({
    name: "AirborneMemoryFlowerParticleMaterial",
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uMotionScale: { value: 1 },
      uCameraRight: { value: new THREE.Vector3(1, 0, 0) },
      uCameraUp: { value: new THREE.Vector3(0, 1, 0) },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uPixelRatio;
      uniform float uMotionScale;
      uniform vec3 uCameraRight;
      uniform vec3 uCameraUp;

      attribute vec3 aAnchor;
      attribute vec3 color;
      attribute vec4 aMotion;
      attribute vec4 aAppearance;
      attribute vec2 aRotation;

      varying vec3 vColor;
      varying float vAlpha;
      varying float vRadiance;

      void main() {
        float phase = uTime * aMotion.y + aMotion.x;
        float angle = aRotation.x +
          sin(phase * 0.67 + aMotion.x * 0.43) * aRotation.y * uMotionScale;
        float cosine = cos(angle);
        float sine = sin(angle);
        vec2 localPosition = vec2(
          position.x * cosine - position.y * sine,
          position.x * sine + position.y * cosine
        );
        float pointFlutter = sin(
          uTime * (0.46 + fract(aAppearance.w * 0.159) * 0.24) +
          aAppearance.w
        );
        float driftX = sin(phase) * aMotion.z * uMotionScale;
        float driftY = sin(phase * 0.79 + aMotion.x * 1.31) *
          aMotion.w * uMotionScale;
        float flutterAmount = pointFlutter * 0.008 * uMotionScale;
        vec3 worldPosition = aAnchor +
          uCameraRight * (localPosition.x + driftX + flutterAmount) +
          uCameraUp * (localPosition.y + driftY + abs(flutterAmount) * 0.62);
        vec4 viewPosition = viewMatrix * vec4(worldPosition, 1.0);

        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = aAppearance.y * uPixelRatio *
          (1.0 + sin(phase * 0.9 + aAppearance.w) * 0.08 * uMotionScale);
        vColor = color;
        vAlpha = aAppearance.x *
          (0.9 + sin(phase * 0.72 + aAppearance.w) * 0.1 * uMotionScale);
        vRadiance = aAppearance.z;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      varying float vRadiance;

      void main() {
        vec2 centered = gl_PointCoord - 0.5;
        float radius = length(centered);
        float coverage = smoothstep(0.5, 0.13, radius);
        float alpha = vAlpha * coverage;
        if (alpha < 0.008) {
          discard;
        }
        gl_FragColor = vec4(vColor * vRadiance, alpha);
      }
    `,
    transparent: true,
    blending: THREE.NormalBlending,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
}

export function getAirborneParticleBudget(config = AIRBORNE_FLOWER_CONFIG) {
  const accents = config.accents.slice(0, config.count);
  return Object.freeze({
    fragmentCount: accents.length,
    mobileFragmentCount: accents.filter((accent) => accent.mobileVisible).length,
    particleCapacity: accents.reduce(
      (total, accent) => total + accent.pointCount,
      0,
    ),
    drawCalls: 1,
    motionMode: "analytic",
  });
}

export class AirborneFlowerSystem {
  constructor({
    scene,
    camera,
    renderer,
    flowerRenderer,
    config = AIRBORNE_FLOWER_CONFIG,
  }) {
    if (typeof flowerRenderer?.getParticleSampleSet !== "function") {
      throw new TypeError(
        "Airborne flowers require PNG particle sample libraries.",
      );
    }

    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.config = config;
    this.budget = getAirborneParticleBudget(config);
    this.accents = config.accents.slice(0, config.count);
    this.records = [];
    this.ndcPoint = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.worldPoint = new THREE.Vector3();
    this.cameraRight = new THREE.Vector3();
    this.cameraUp = new THREE.Vector3();
    this.visibleFragmentCount = this.accents.length;

    this.accents.forEach((accentConfig, fragmentIndex) => {
      const sampleSet = flowerRenderer.getParticleSampleSet(
        accentConfig.variantIndex,
      );
      if (!sampleSet) {
        throw new Error(
          `Airborne flower sample ${accentConfig.variantIndex + 1} is unavailable.`,
        );
      }
      const samples = selectFragmentSamples(
        sampleSet,
        accentConfig,
        fragmentIndex,
        config,
      );
      samples.forEach((sample) => {
        this.records.push({ fragmentIndex, config: accentConfig, ...sample });
      });
    });

    const pointCount = this.records.length;
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(pointCount * 3), 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    this.geometry.setAttribute(
      "aAnchor",
      new THREE.BufferAttribute(new Float32Array(pointCount * 3), 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    this.geometry.setAttribute(
      "aMotion",
      new THREE.BufferAttribute(new Float32Array(pointCount * 4), 4).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    this.geometry.setAttribute(
      "aAppearance",
      new THREE.BufferAttribute(new Float32Array(pointCount * 4), 4).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    this.geometry.setAttribute(
      "aRotation",
      new THREE.BufferAttribute(new Float32Array(pointCount * 2), 2),
    );
    this.geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(new Float32Array(pointCount * 3), 3),
    );
    this.geometry.setDrawRange(0, pointCount);

    const rotationAttribute = this.geometry.getAttribute("aRotation");
    const colorAttribute = this.geometry.getAttribute("color");
    this.records.forEach((record, index) => {
      rotationAttribute.setXY(
        index,
        record.config.rotation,
        record.config.rotationAmount,
      );
      const memoryMix = 0.24 + record.edge * 0.16;
      colorAttribute.setXYZ(
        index,
        THREE.MathUtils.lerp(record.color[0], MEMORY_LAVENDER[0], memoryMix),
        THREE.MathUtils.lerp(record.color[1], MEMORY_LAVENDER[1], memoryMix),
        THREE.MathUtils.lerp(record.color[2], MEMORY_LAVENDER[2], memoryMix),
      );
    });

    this.material = createParticleMaterial(renderer.getPixelRatio());
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.name = "AirborneMemoryFlowerParticles";
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
    this.points.userData.decorative = true;
    this.points.userData.pointerInteractive = false;
    scene.add(this.points);

    this.resize();
    this.update(0);
  }

  projectNdcAtDistance(ndcX, ndcY, distance, target) {
    this.ndcPoint.set(ndcX, ndcY, 0).unproject(this.camera);
    this.direction
      .copy(this.ndcPoint)
      .sub(this.camera.position)
      .normalize();
    return target
      .copy(this.camera.position)
      .addScaledVector(this.direction, distance);
  }

  resize() {
    this.camera.updateMatrixWorld();
    this.cameraRight
      .setFromMatrixColumn(this.camera.matrixWorld, 0)
      .normalize();
    this.cameraUp
      .setFromMatrixColumn(this.camera.matrixWorld, 1)
      .normalize();
    this.material.uniforms.uCameraRight.value.copy(this.cameraRight);
    this.material.uniforms.uCameraUp.value.copy(this.cameraUp);
    this.material.uniforms.uPixelRatio.value = this.renderer.getPixelRatio();
    this.material.uniforms.uMotionScale.value = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches
      ? 0.18
      : 1;

    const isNarrow = this.camera.aspect < 0.72;
    const positionAttribute = this.geometry.getAttribute("position");
    const anchorAttribute = this.geometry.getAttribute("aAnchor");
    const motionAttribute = this.geometry.getAttribute("aMotion");
    const appearanceAttribute = this.geometry.getAttribute("aAppearance");
    const layout = this.accents.map((accent) => {
      const distance = this.config.distance + accent.depthOffset;
      const viewportHeight =
        2 *
        Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5)) *
        distance;
      const viewportWidth = viewportHeight * this.camera.aspect;
      return {
        anchor: this.projectNdcAtDistance(
          accent.ndcX,
          accent.ndcY,
          distance,
          new THREE.Vector3(),
        ),
        height: viewportHeight * accent.height,
        driftX: viewportWidth * accent.driftX * 0.5,
        driftY: viewportHeight * accent.driftY * 0.5,
        visible: !isNarrow || accent.mobileVisible,
      };
    });

    this.visibleFragmentCount = layout.filter((entry) => entry.visible).length;
    this.records.forEach((record, index) => {
      const fragmentLayout = layout[record.fragmentIndex];
      positionAttribute.setXYZ(
        index,
        record.localX * fragmentLayout.height,
        record.localY * fragmentLayout.height,
        0,
      );
      anchorAttribute.setXYZ(
        index,
        fragmentLayout.anchor.x,
        fragmentLayout.anchor.y,
        fragmentLayout.anchor.z,
      );
      motionAttribute.setXYZW(
        index,
        record.config.phase,
        record.config.speed,
        fragmentLayout.driftX,
        fragmentLayout.driftY,
      );
      const pointOpacity =
        record.config.opacity *
        (0.64 + record.alpha * 0.22 + record.edge * 0.18);
      appearanceAttribute.setXYZW(
        index,
        fragmentLayout.visible ? pointOpacity : 0,
        record.pointSize,
        1.08 + record.edge * 0.28,
        record.pointPhase,
      );
    });

    positionAttribute.needsUpdate = true;
    anchorAttribute.needsUpdate = true;
    motionAttribute.needsUpdate = true;
    appearanceAttribute.needsUpdate = true;
  }

  update(timeSeconds = 0) {
    this.material.uniforms.uTime.value = timeSeconds;
  }

  get diagnostics() {
    return {
      mode: this.budget.motionMode,
      representation: "fixed-capacity-particle-fragments",
      fragmentCount: this.budget.fragmentCount,
      visibleFragmentCount: this.visibleFragmentCount,
      particleCount: this.records.length,
      drawCalls: this.budget.drawCalls,
      particleCpuUpdatesPerFrame: 0,
      depthTest: this.material.depthTest,
      depthWrite: this.material.depthWrite,
      blending: "normal",
    };
  }

  dispose() {
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
    this.records.length = 0;
  }
}

export function createAirborneFlowerSystem(options) {
  return new AirborneFlowerSystem(options);
}
