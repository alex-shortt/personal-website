import { createFluidField } from "./fluidField";
import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber";
import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ACESFilmicToneMapping,
  BackSide,
  Box3,
  BoxGeometry,
  Color,
  Data3DTexture,
  DataTexture,
  HalfFloatType,
  LinearFilter,
  Mesh,
  NearestFilter,
  NoBlending,
  OrthographicCamera,
  PerspectiveCamera,
  Quaternion,
  PlaneGeometry,
  RedFormat,
  RGBAFormat,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  type Texture,
} from "three";
import { activeLabPresets, approvedCloudPreset, labPresets } from "./lab";
import { qualityLevels, studio } from "./settings";
import {
  compositeFragment,
  compositeVertex,
  volumeFragment,
  volumeVertex,
  lightingFragment,
  floorLightingFragment,
} from "./shaders";
import styles from "./CloudStudy.module.css";
import { GpuTimer } from "./GpuTimer";
import StudioSpace from "./StudioSpace";
import { useCloudStir } from "./useCloudStir";
import { sampleMotion, type MotionSample } from "./motion";
import TuningPanel from "./TuningPanel";
import {
  checkpointSelectionKey,
  loadCheckpointSelection,
  loadCheckpoint,
  tuningLights,
  tuningStorageKey,
  type Tuning,
} from "./tuning";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

function Fallback({ onReady }: { onReady?: () => void }) {
  return (
    <div
      className={styles.fallback}
      role="img"
      aria-label="A cyan and pink cloud"
    >
      {/* The reference also provides a quiet fallback on devices without WebGL2. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/pfp-transparent-cropped.png"
        alt=""
        onLoad={onReady}
        onError={onReady}
      />
    </div>
  );
}

class GraphicsBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed
      ? (this.props.fallback ?? <Fallback />)
      : this.props.children;
  }
}

function SceneAssetsReady({ onReady }: { onReady: () => void }) {
  // Shares the loader cache with both fixtures; no duplicate downloads.
  useLoader(GLTFLoader, "/models/stand-segmented.glb");
  useLoader(GLTFLoader, "/models/spotlight.glb");
  useEffect(onReady, [onReady]);
  return null;
}

const lights = studio.lights.map((light) => {
  const position = new Vector3(...light.position);
  return {
    ...light,
    position,
    direction: new Vector3(...light.target).sub(position).normalize(),
    cone: new Vector2(
      Math.cos((light.outerAngle * Math.PI) / 180),
      Math.cos((light.innerAngle * Math.PI) / 180),
    ),
    linearColor: new Color(light.color),
  };
});

async function bytes(
  path: string,
  length: number,
  signal: AbortSignal,
  channels = 1,
) {
  const response = await fetch(path, { signal });
  if (!response.ok) throw new Error(`Unable to load ${path}`);
  let data: Uint8Array;
  if (path.endsWith(".png")) {
    // PNG transports numeric fields without color conversion. Keep all RGBA
    // channels for the shape profile, or reconstruct one channel for density.
    const bitmap = await createImageBitmap(await response.blob(), {
      colorSpaceConversion: "none",
    });
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      bitmap.close();
      throw new Error("Unable to decode density texture");
    }
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
    data = new Uint8Array((rgba.length / 4) * channels);
    if (channels === 4) data.set(rgba);
    else for (let i = 0; i < data.length; i++) data[i] = rgba[i * 4];
  } else data = new Uint8Array(await response.arrayBuffer());
  if (data.length !== length) throw new Error(`Invalid texture ${path}`);
  return data;
}

function createResources(
  densityBytes: Uint8Array,
  jitterBytes: Uint8Array,
  shapeBytes: Uint8Array,
) {
  const shape = new DataTexture(shapeBytes, 512, 320, RGBAFormat);
  shape.minFilter = shape.magFilter = LinearFilter;
  shape.unpackAlignment = 1;
  shape.needsUpdate = true;
  const density = new Data3DTexture(densityBytes, 64, 64, 64);
  density.format = RedFormat;
  density.minFilter = density.magFilter = LinearFilter;
  density.wrapS = density.wrapT = density.wrapR = RepeatWrapping;
  density.unpackAlignment = 1;
  density.needsUpdate = true;
  const jitter = new DataTexture(jitterBytes, 32, 32, RedFormat);
  jitter.minFilter = jitter.magFilter = NearestFilter;
  jitter.wrapS = jitter.wrapT = RepeatWrapping;
  jitter.unpackAlignment = 1;
  jitter.needsUpdate = true;
  const volume = new ShaderMaterial({
    vertexShader: volumeVertex,
    fragmentShader: volumeFragment,
    uniforms: {
      uDensity: { value: density },
      uDensityMode: { value: 0 },
      uFlowEnabled: { value: false },
      uFloatAmount: { value: 0.04 },
      uFloatPeriod: { value: 10 },
      uSwayAmount: { value: 0.008 },
      uBillowStrength: { value: 0 },
      uFluidField: { value: null },
      uFluidActive: { value: false },
      uCirculationSpeed: { value: 0.18 },
      uVortexSize: { value: 0.85 },
      uSecondaryVortex: { value: 0.65 },
      uEvolutionSpeed: { value: 0.12 },
      uLegacyDrift: { value: 1 },
      uDensityMultiplier: { value: 1 },
      uNoiseScale: { value: 1 },
      uErosion: { value: 0.085 },
      uViewExtinction: { value: 7 },
      uPhase: { value: 0.48 },
      uLightRange: { value: new Vector2(0, 0) },
      uLightDecay: { value: new Vector2(2, 2) },
      uRounderDepth: { value: false },
      uColorVariation: { value: 0 },
      uNeutral: { value: false },
      uInternal: { value: false },
      uBlueInternal: { value: false },
      uShape: { value: shape },
      uEdgeWidths: {
        value: new Vector2(
          studio.cloudShape.wispEdgeWidth,
          studio.cloudShape.edgeWidth,
        ),
      },
      uJitter: { value: jitter },
      uTime: { value: 0 },
      uSteps: { value: qualityLevels[1].steps },
      uOrthographic: { value: false },
      uViewDirection: { value: new Vector3(0, 0, -1) },
      uAmbient: {
        value: new Color(studio.ambient.color).multiplyScalar(
          studio.ambient.intensity,
        ),
      },
      uLightExtinction: { value: studio.cloudLighting.extinction },
      uBounce: { value: studio.cloudLighting.bounce },
      uSeparation: { value: studio.cloudLighting.separation },
      uTransitionWidth: { value: studio.cloudLighting.transitionWidth },
      uLighting: { value: null },
      uDirectionalLighting: { value: null },
      uDirectionalDirection: {
        value: new Vector3(...studio.directional.position).normalize(),
      },
      uDirectionalColor: { value: new Color(studio.directional.color) },
      uDirectionalIntensity: { value: studio.directional.intensity },
      uDirectionalPass: { value: false },
      uLightPosition: { value: lights.map((l) => l.position) },
      uLightColor: { value: lights.map((l) => l.linearColor) },
      uLightDirection: { value: lights.map((l) => l.direction) },
      uLightCone: { value: lights.map((l) => l.cone) },
      uPower: { value: new Vector2(...studio.lights.map((l) => l.power)) },
    },
    side: BackSide,
    blending: NoBlending,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  });
  const fluidField = createFluidField();
  volume.uniforms.uFluidField.value = fluidField.texture;
  const lightingTarget = new WebGLRenderTarget(384, 72, {
    type: HalfFloatType,
    depthBuffer: false,
    stencilBuffer: false,
  });
  const directionalTarget = lightingTarget.clone();
  volume.uniforms.uDirectionalLighting.value = directionalTarget.texture;
  const lightingMaterial = new ShaderMaterial({
    vertexShader: compositeVertex,
    fragmentShader: lightingFragment,
    uniforms: { ...volume.uniforms, uTime: { value: 0 } },
    blending: NoBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const floorTarget = new WebGLRenderTarget(128, 128, {
    type: HalfFloatType,
    depthBuffer: false,
    stencilBuffer: false,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
  });
  const floorMaterial = new ShaderMaterial({
    vertexShader: compositeVertex,
    fragmentShader: floorLightingFragment,
    uniforms: {
      ...volume.uniforms,
      uTime: { value: 0 },
      uFloorY: { value: studio.floorY },
    },
    blending: NoBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const floorScene = new Scene();
  volume.uniforms.uLighting.value = lightingTarget.texture;
  const lightingGeometry = new PlaneGeometry(2, 2);
  const floorMesh = new Mesh(lightingGeometry, floorMaterial);
  floorMesh.frustumCulled = false;
  floorScene.add(floorMesh);
  const lightingScene = new Scene();
  const lightingMesh = new Mesh(lightingGeometry, lightingMaterial);
  lightingMesh.frustumCulled = false;
  lightingScene.add(lightingMesh);
  const geometry = new BoxGeometry(
    ...(studio.cloudBounds.map((x) => x * 2) as [number, number, number]),
  );
  const cloudScene = new Scene();
  cloudScene.add(new Mesh(geometry, volume));
  const target = new WebGLRenderTarget(1, 1, {
    type: HalfFloatType,
    depthBuffer: false,
    stencilBuffer: false,
  });
  const composite = new ShaderMaterial({
    vertexShader: compositeVertex,
    fragmentShader: compositeFragment,
    uniforms: {
      uCloud: { value: target.texture },
      uSilhouette: { value: false },
      uExposure: { value: studio.exposure },
      uSaturation: { value: studio.cloudColor.saturation },
      uSimpleDisplay: { value: false },
      uFilmicDisplay: { value: false },
      uFilmicStrength: { value: 1 },
      uMidtoneLift: { value: 0 },
      uBloomStrength: { value: 0 },
      uCloudTexel: { value: new Vector2(1, 1) },
    },
    // The cloud uses a hue-preserving curve; fixtures retain renderer ACES.
    toneMapped: false,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new PlaneGeometry(2, 2);
  const compositeScene = new Scene();
  const mesh = new Mesh(quad, composite);
  mesh.frustumCulled = false;
  compositeScene.add(mesh);
  return {
    shapeBytes,
    fluidField,
    volume,
    composite,
    cloudScene,
    target,
    compositeScene,
    lightingTarget,
    directionalTarget,
    floorTarget,
    floorMaterial,
    floorScene,
    floorTime: -Infinity,
    floorUpdatedAt: -Infinity,
    floorStirring: false,
    lightingMaterial,
    lightingScene,
    preset: -1,
    cacheRow: 0,
    cacheInitialized: false,
    lightingWasStirring: false,
    camera: new OrthographicCamera(-1, 1, 1, -1, 0, 1),
    dispose() {
      density.dispose();
      shape.dispose();
      jitter.dispose();
      volume.dispose();
      fluidField.dispose();
      geometry.dispose();
      target.dispose();
      composite.dispose();
      quad.dispose();
      floorTarget.dispose();
      floorMaterial.dispose();
      lightingTarget.dispose();
      directionalTarget.dispose();
      lightingMaterial.dispose();
      lightingGeometry.dispose();
    },
  };
}

type Resources = ReturnType<typeof createResources>;

function frameOrthographic(
  camera: OrthographicCamera,
  aspect: number,
  lab = false,
) {
  const height = lab
    ? Math.max(4.0, 4.6 / aspect)
    : Math.max(5.8, 5.4 / aspect);
  camera.left = (-height * aspect) / 2;
  camera.right = (height * aspect) / 2;
  camera.top = height / 2;
  camera.bottom = -height / 2;
  camera.zoom = 1;
  return height;
}

// Mutate the Three.js projection explicitly; this is renderer state, not React state.
function setCameraAspect(camera: PerspectiveCamera, aspect: number) {
  camera.aspect = aspect;
}

function Renderer({
  onToggleLight,
  assetsReady,
  framingElement,
  onReady,
  onFps,
  inspect,
  resetView,
  silhouette,
  inspectionView,
  lab,
  preset,
  tuning,
}: {
  framingElement?: RefObject<HTMLDivElement | null>;
  onToggleLight: (index: number) => void;
  assetsReady: boolean;
  tuning: Tuning | null;
  lab: boolean;
  preset: number;
  inspectionView: "front" | "top" | "side" | "other-side";
  silhouette: boolean;
  inspect: boolean;
  resetView: number;
  onReady: () => void;
  onFps: (fps: number) => void;
}) {
  const { size, camera, gl, scene, set, setFrameloop, invalidate } = useThree();
  const studioCamera = useRef(camera);
  const inspectionCamera = useMemo(
    () =>
      Object.assign(new OrthographicCamera(-3, 3, 3, -3, 0.1, 100), {
        manual: true,
      }),
    [],
  );
  useEffect(() => {
    set({ camera: inspect ? inspectionCamera : studioCamera.current });
    invalidate();
  }, [inspect, inspectionCamera, set, invalidate]);
  const sway = useRef({
    pointer: new Vector2(),
    current: new Vector2(),
    position: new Vector3(),
    rotation: new Quaternion(),
    yaw: new Quaternion(),
    pitch: new Quaternion(),
    delta: new Quaternion(),
    up: new Vector3(0, 1, 0),
    right: new Vector3(1, 0, 0),
    ready: false,
  });
  useEffect(() => {
    if (inspect || lab) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reset = () => {
      sway.current.pointer.set(0, 0);
      invalidate();
    };
    const move = (event: PointerEvent) => {
      if (
        event.pointerType !== "mouse" ||
        !fine.matches ||
        reducedMotion.current
      )
        return;
      if (
        event.target instanceof Element &&
        event.target.closest('[aria-label="Cloud tuning"]')
      ) {
        reset();
        return;
      }
      sway.current.pointer.set(
        Math.max(-1, Math.min(1, (event.clientX / window.innerWidth) * 2 - 1)),
        Math.max(-1, Math.min(1, 1 - (event.clientY / window.innerHeight) * 2)),
      );
      invalidate();
    };
    window.addEventListener("pointermove", move);
    document.documentElement.addEventListener("pointerleave", reset);
    window.addEventListener("blur", reset);
    fine.addEventListener("change", reset);
    return () => {
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", reset);
      window.removeEventListener("blur", reset);
      fine.removeEventListener("change", reset);
      reset();
    };
  }, [inspect, lab, invalidate]);
  useFrame((state, dt) => {
    const s = sway.current;
    if (inspect || lab || !s.ready || state.camera !== studioCamera.current)
      return;
    const enabled = !!tuning?.cameraSway && !reducedMotion.current;
    const factor =
      1 -
      Math.exp(
        (-3 * Math.min(dt, 0.05)) / Number(tuning?.cameraSwaySmoothing ?? 0.4),
      );
    s.current.x += ((enabled ? s.pointer.x : 0) - s.current.x) * factor;
    s.current.y += ((enabled ? s.pointer.y : 0) - s.current.y) * factor;
    if (
      reducedMotion.current ||
      (!s.pointer.lengthSq() && s.current.lengthSq() < 1e-8)
    )
      s.current.set(0, 0);
    s.right.set(1, 0, 0).applyQuaternion(s.rotation);
    s.yaw.setFromAxisAngle(
      s.up,
      (s.current.x * Number(tuning?.cameraSwayHorizontal ?? 1.5) * Math.PI) /
        180,
    );
    s.pitch.setFromAxisAngle(
      s.right,
      (-s.current.y * Number(tuning?.cameraSwayVertical ?? 0.6) * Math.PI) /
        180,
    );
    s.delta.copy(s.yaw).multiply(s.pitch);
    // Orbit the origin and rotate the original camera basis by the same amount.
    // This preserves its existing off-center aim and DOM projection offset.
    state.camera.position.copy(s.position).applyQuaternion(s.delta);
    state.camera.quaternion.copy(s.delta).multiply(s.rotation);
    state.camera.updateMatrixWorld(true);
  }, -1);
  const drawingSize = useMemo(() => new Vector2(), []);
  const resourceRef = useRef<Resources | null>(null);
  const [floorTexture, setFloorTexture] = useState<Texture | null>(null);
  const appliedTuning = useRef<Tuning | null>(null);
  const fixtureLights = useMemo(
    () => (tuning ? tuningLights(tuning) : studio.lights),
    [tuning],
  );
  useEffect(() => {
    invalidate();
  }, [tuning, invalidate]);
  const [error, setError] = useState<Error | null>(null);
  const reducedMotion = useRef(false);
  const gpuTimer = useRef<GpuTimer | null>(null);
  const elapsed = useRef(0);
  const requestedTime = useRef<number | null>(null);
  const motion = useRef<MotionSample>({ x: 0, y: 0, z: 0, response: 1 });
  useCloudStir(resourceRef, motion, tuning, inspect || lab);
  // Advance before the shadow's useFrame and the priority-1 manual renderer.
  useFrame((state, delta) => {
    const seek = tuning ? Number(tuning.motionTime) : 0;
    if (requestedTime.current !== seek) {
      elapsed.current = seek;
      requestedTime.current = seek;
    } else if (!reducedMotion.current && !lab && !tuning?.motionPaused) {
      elapsed.current +=
        Math.min(delta, 0.05) * (tuning ? Number(tuning.motionSpeed) : 1);
    }
    motion.current = sampleMotion(elapsed.current, tuning);
    state.gl.domElement.dataset.cloudTime = elapsed.current.toFixed(6);
  }, -2);
  const fpsWindow = useRef({ start: 0, frames: 0 });
  const quality = useRef(1);
  const samples = useRef<number[]>([]);
  const stableWindows = useRef(0);
  const ready = useRef(false);
  const background = useMemo(() => new Color("#fcfcfc"), []);

  useEffect(() => {
    const abort = new AbortController();
    let owned: Resources | undefined;
    Promise.all([
      bytes("/cloud/density-64.png", 64 ** 3, abort.signal),
      bytes("/cloud/jitter-32.bin", 32 ** 2, abort.signal),
      bytes("/cloud/shape-profile.png", 512 * 320 * 4, abort.signal, 4),
    ])
      .then(([density, jitter, shape]) => {
        if (abort.signal.aborted) return;
        owned = createResources(density, jitter, shape);
        resourceRef.current = owned;
        setFloorTexture(owned.floorTarget.texture);
        invalidate();
      })
      .catch((error) => {
        if (!abort.signal.aborted) setError(error);
      });
    return () => {
      abort.abort();
      resourceRef.current = null;
      owned?.dispose();
      gpuTimer.current?.dispose();
      gpuTimer.current = null;
    };
  }, [invalidate]);

  useEffect(() => {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      reducedMotion.current = motion.matches;
      samples.current = [];
      fpsWindow.current = { start: 0, frames: 0 };
      if (motion.matches || lab) onFps(0);
      setFrameloop(
        document.hidden || motion.matches || lab ? "demand" : "always",
      );
      if (!document.hidden) invalidate();
    };
    update();
    document.addEventListener("visibilitychange", update);
    motion.addEventListener("change", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      motion.removeEventListener("change", update);
    };
  }, [setFrameloop, invalidate, onFps, lab]);

  useLayoutEffect(() => {
    const perspective = camera as PerspectiveCamera;
    const updateFraming = () => {
      const canvasRect = gl.domElement.getBoundingClientRect();
      const anchor = !inspect
        ? framingElement?.current?.getBoundingClientRect()
        : null;
      const width = anchor?.width || size.width;
      const height = anchor?.height || size.height;
      if (
        width <= 0 ||
        height <= 0 ||
        canvasRect.width <= 0 ||
        canvasRect.height <= 0
      )
        return;
      const aspect = width / height;
      if (camera instanceof PerspectiveCamera) {
        // Both cameras are manual: R3F must not overwrite the DOM-slot aspect.
        camera.clearViewOffset();
        setCameraAspect(perspective, aspect);
        if (anchor && anchor.width > 0 && anchor.height > 0) {
          // Extend the original DOM slot's camera frustum across the whole page.
          // Negative offsets preserve its composition without moving any objects.
          camera.setViewOffset(
            width,
            height,
            canvasRect.left - anchor.left,
            canvasRect.top - anchor.top,
            canvasRect.width,
            canvasRect.height,
          );
        }
      }
      // A restrained telephoto perspective, elevated above the seamless floor.
      const direction = new Vector3(0.23, 0.4, 0.888).normalize();
      const mobileStudio = !inspect && canvasRect.width <= 760;
      const target = new Vector3(mobileStudio ? -0.7 : 0, -0.35, 0);
      let distance = 14.8;
      const points: Vector3[] = [];
      const addBox = (box: Box3, object?: Mesh) => {
        for (const x of [box.min.x, box.max.x])
          for (const y of [box.min.y, box.max.y])
            for (const z of [box.min.z, box.max.z]) {
              const point = new Vector3(x, y, z);
              if (object) point.applyMatrix4(object.matrixWorld);
              points.push(point);
            }
      };
      if (!inspect) {
        // Include the raymarched cloud (not in the main scene), with motion room.
        addBox(
          new Box3(
            new Vector3(-2.25, -1.4, -1.75),
            new Vector3(2.25, 1.4, 1.75),
          ),
        );
        scene.updateMatrixWorld(true);
        scene.traverse((object) => {
          if (object.name !== "studio-fixture") return;
          object.traverse((child) => {
            if (!(child instanceof Mesh) || child.userData.excludeFromFraming)
              return;
            child.geometry.computeBoundingBox();
            if (child.geometry.boundingBox)
              addBox(child.geometry.boundingBox, child);
          });
        });
        const right = new Vector3()
          .crossVectors(new Vector3(0, 1, 0), direction)
          .normalize();
        const up = new Vector3().crossVectors(direction, right);
        const tanY = Math.tan((32 * Math.PI) / 360);
        const padding = mobileStudio ? 12 : 48;
        const insetX = Math.max(0.6, 1 - padding / width);
        const insetY = Math.max(0.6, 1 - padding / height);
        for (const point of points) {
          const relative = point.clone().sub(target);
          const depth = relative.dot(direction);
          distance = Math.max(
            distance,
            depth + Math.abs(relative.dot(right)) / (tanY * aspect * insetX),
            depth + Math.abs(relative.dot(up)) / (tanY * insetY),
          );
        }
      }
      perspective.up.set(0, 1, 0);
      perspective.position.copy(target).addScaledVector(direction, distance);
      if (inspect) {
        if (inspectionView === "top") {
          perspective.up.set(0, 0, -1);
          perspective.position.set(0, 12, 0);
        } else if (
          inspectionView === "side" ||
          inspectionView === "other-side"
        ) {
          perspective.position.set(inspectionView === "side" ? 12 : -12, 0, 0);
        } else perspective.position.set(0, 0, 12);
        if (camera instanceof OrthographicCamera) {
          const height = frameOrthographic(camera, aspect, lab);
          gl.domElement.setAttribute("data-cloud-view-height", String(height));
        }
        perspective.lookAt(0, 0, 0);
      } else perspective.lookAt(target);
      perspective.updateProjectionMatrix();
      perspective.updateMatrixWorld(true);
      if (!inspect) {
        sway.current.position.copy(perspective.position);
        sway.current.rotation.copy(perspective.quaternion);
        sway.current.ready = true;
      }
      if (!inspect && points.length) {
        const projected = points.map((point) =>
          point.clone().project(perspective),
        );
        gl.domElement.setAttribute(
          "data-studio-bounds",
          JSON.stringify({
            left:
              ((Math.min(...projected.map((p) => p.x)) + 1) *
                canvasRect.width) /
              2,
            right:
              ((Math.max(...projected.map((p) => p.x)) + 1) *
                canvasRect.width) /
              2,
            top:
              ((1 - Math.max(...projected.map((p) => p.y))) *
                canvasRect.height) /
              2,
            bottom:
              ((1 - Math.min(...projected.map((p) => p.y))) *
                canvasRect.height) /
              2,
          }),
        );
      }
      invalidate();
    };
    updateFraming();
    const observer = new ResizeObserver(updateFraming);
    observer.observe(gl.domElement);
    if (framingElement?.current) observer.observe(framingElement.current);
    window.addEventListener("resize", updateFraming);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateFraming);
    };
  }, [
    camera,
    gl,
    size,
    invalidate,
    inspect,
    resetView,
    inspectionView,
    lab,
    framingElement,
    scene,
    assetsReady,
    tuning,
  ]);

  useEffect(() => {
    if (!inspect) return;
    const controls = new OrbitControls(camera, gl.domElement);
    controls.target.set(0, 0, 0);
    controls.enablePan = false;
    controls.enableDamping = false;
    controls.minDistance = 5;
    controls.maxDistance = 25;
    controls.minZoom = 0.65;
    controls.maxZoom = 2.5;
    const onChange = () => invalidate();
    controls.addEventListener("change", onChange);
    controls.update();
    return () => {
      controls.removeEventListener("change", onChange);
      controls.dispose();
    };
  }, [camera, gl, invalidate, inspect, resetView, inspectionView, lab]);

  useEffect(() => invalidate(), [silhouette, preset, invalidate]);

  useFrame((state, delta) => {
    const resources = resourceRef.current;
    const { gl } = state;
    if (!resources) return;
    if (resources.preset !== preset || appliedTuning.current !== tuning) {
      const neutral = preset >= 2 && preset <= 4;
      const internal = preset === 7;
      const aimed = preset >= 10 && preset <= 12;
      const lightingTest = preset >= 13 && preset <= 25;
      const strongerLightScale =
        preset === 18 ? 4 : preset === 19 ? 8 : preset === 20 ? 32 : 1;
      const grazing = preset === 15;
      const blueInternal = preset === 9 || aimed;
      const simpleTransport = neutral || internal;
      const u = resources.volume.uniforms;
      u.uDirectionalIntensity.value = lab
        ? 0
        : Number(tuning?.directionalIntensity ?? studio.directional.intensity);
      u.uDensityMode.value = preset === 4 ? 2 : preset === 3 ? 1 : 0;
      u.uRounderDepth.value = preset === 24 || preset === 25;
      u.uColorVariation.value = preset === 23 || preset === 25 ? 1.5 : 0;
      // Narrow the mixed-color band for the approved bright filmic candidate.
      u.uTransitionWidth.value =
        preset >= 22
          ? 0.0575
          : preset === 21
            ? 0.035
            : studio.cloudLighting.transitionWidth;
      u.uNeutral.value = neutral;
      u.uInternal.value = internal;
      u.uBlueInternal.value = blueInternal && !aimed;
      u.uLightExtinction.value = simpleTransport
        ? 7.0
        : studio.cloudLighting.extinction;
      u.uBounce.value = simpleTransport
        ? 0
        : preset === 14
          ? 0.16
          : studio.cloudLighting.bounce;
      u.uAmbient.value = simpleTransport
        ? new Color(0.06, 0.06, 0.06)
        : new Color(studio.ambient.color).multiplyScalar(
            preset === 13 || preset >= 16
              ? 0.01
              : preset === 8 || blueInternal || lightingTest
                ? 0.05
                : studio.ambient.intensity * (preset === 6 ? 2 : 1),
          );
      u.uLightPosition.value = grazing
        ? [new Vector3(-2.8, 2.7, 0.6), new Vector3(2.2, -0.35, 3.0)]
        : blueInternal
          ? [new Vector3(0.45, 0.18, 0.1), lights[1].position]
          : internal
            ? [new Vector3(0.45, 0.18, 0.1), new Vector3(-0.25, -0.45, 0)]
            : neutral
              ? [new Vector3(-3, 4, 5), lights[1].position]
              : lights.map((l) => l.position);
      u.uLightColor.value = neutral
        ? [new Color("white"), new Color("black")]
        : lights.map((l) => l.linearColor);
      u.uLightDirection.value = grazing
        ? studio.lights.map((l, i) =>
            new Vector3(...l.target).sub(u.uLightPosition.value[i]).normalize(),
          )
        : aimed
          ? [new Vector3(0.25, 1, 0.2).normalize(), lights[1].direction]
          : neutral
            ? [new Vector3(3, -4, -5).normalize(), lights[1].direction]
            : lights.map((l) => l.direction);
      u.uLightCone.value = aimed
        ? [
            new Vector2(
              Math.cos((Math.PI * 80) / 180),
              Math.cos((Math.PI * 45) / 180),
            ),
            lights[1].cone,
          ]
        : neutral
          ? [new Vector2(0, 0.5), lights[1].cone]
          : lights.map((l) => l.cone);
      u.uPower.value = internal
        ? new Vector2(160, 140)
        : neutral
          ? new Vector2(600, 0)
          : new Vector2(
              ...studio.lights.map(
                (l) =>
                  l.power *
                  (preset === 5 ||
                  preset === 6 ||
                  preset === 8 ||
                  blueInternal ||
                  lightingTest
                    ? 2
                    : 1),
              ),
            );
      if (grazing) {
        // Maintain inverse-square incident intensity at each existing aim target.
        const powers = studio.lights.map((l, i) => {
          const target = new Vector3(...l.target);
          return (
            (l.power *
              2 *
              u.uLightPosition.value[i].distanceToSquared(target)) /
            lights[i].position.distanceToSquared(target)
          );
        });
        u.uPower.value.set(powers[0], powers[1]);
      }
      if (aimed) u.uPower.value.x *= 0.4;
      if (preset === 16 || (preset >= 18 && preset <= 21))
        u.uPower.value.multiplyScalar(2 * strongerLightScale);
      if (preset >= 22) u.uPower.value.multiplyScalar(1.5);
      resources.composite.uniforms.uFilmicDisplay.value =
        preset === 17 || preset >= 21;
      resources.composite.uniforms.uMidtoneLift.value =
        preset === 11 ? 0.22 : 0;
      resources.composite.uniforms.uBloomStrength.value =
        preset === 12 ? 0.16 : 0;
      resources.composite.uniforms.uSimpleDisplay.value = preset > 0;
      resources.composite.uniforms.uExposure.value = simpleTransport
        ? 1
        : studio.exposure;
      if (tuning) {
        const t = tuning;
        u.uFlowEnabled.value = true;
        for (const [key, uniform] of Object.entries({
          floatAmount: "uFloatAmount",
          floatPeriod: "uFloatPeriod",
          swayAmount: "uSwayAmount",
          billowStrength: "uBillowStrength",
          circulationSpeed: "uCirculationSpeed",
          vortexSize: "uVortexSize",
          secondaryVortex: "uSecondaryVortex",
          evolutionSpeed: "uEvolutionSpeed",
          legacyDrift: "uLegacyDrift",
        }))
          u[uniform].value = Number(t[key]);
        const configured = tuningLights(t);
        u.uLightPosition.value = configured.map(
          (l) => new Vector3(...l.position),
        );
        u.uLightDirection.value = configured.map((l) => {
          const direction = new Vector3(...l.target).sub(
            new Vector3(...l.position),
          );
          return direction.lengthSq() > 0.000001
            ? direction.normalize()
            : new Vector3(0, 0, -1);
        });
        u.uLightColor.value = configured.map((l) => new Color(l.color));
        u.uLightCone.value = configured.map(
          (l) =>
            new Vector2(
              Math.cos((l.outerAngle * Math.PI) / 180),
              Math.cos((l.innerAngle * Math.PI) / 180),
            ),
        );
        u.uPower.value.set(configured[0].power, configured[1].power);
        u.uLightRange.value.set(configured[0].distance, configured[1].distance);
        u.uLightDecay.value.set(configured[0].decay, configured[1].decay);
        u.uAmbient.value = new Color(studio.ambient.color).multiplyScalar(
          Number(t.ambient),
        );
        u.uLightExtinction.value = Number(t.extinction);
        u.uViewExtinction.value = Number(t.viewExtinction);
        u.uBounce.value = Number(t.bounce);
        u.uPhase.value = Number(t.phase);
        u.uSeparation.value = Number(t.separation);
        u.uTransitionWidth.value = Number(t.transition);
        u.uColorVariation.value = Number(t.variation);
        u.uDensityMultiplier.value = Number(t.density);
        u.uNoiseScale.value = Number(t.noiseScale);
        u.uErosion.value = Number(t.erosion);
        u.uRounderDepth.value = Boolean(t.rounderDepth);
        u.uEdgeWidths.value.set(Number(t.wispEdgeWidth), Number(t.edgeWidth));
        resources.composite.uniforms.uExposure.value = Number(t.exposure);
        resources.composite.uniforms.uFilmicDisplay.value = Boolean(t.filmic);
        resources.composite.uniforms.uFilmicStrength.value = Number(
          t.filmicStrength,
        );
      }
      appliedTuning.current = tuning;
      resources.floorTime = -Infinity;
      resources.cacheInitialized = false;
      resources.cacheRow = 0;
      resources.preset = preset;
      gl.domElement.dataset.cloudPreset = String(preset);
    }
    const q = qualityLevels[lab ? 2 : quality.current];
    // Cap resolution independently of the display DPR. A 3x phone must not do
    // nine times the volume work. Only the inexpensive fixtures use the canvas DPR.
    // Use the actual buffer, not a React size snapshot which can lag a resize.
    gl.getDrawingBufferSize(drawingSize);
    const width = Math.max(1, Math.round(drawingSize.x * q.scale));
    const height = Math.max(1, Math.round(drawingSize.y * q.scale));
    if (resources.target.width !== width || resources.target.height !== height)
      resources.target.setSize(width, height);
    resources.composite.uniforms.uCloudTexel.value.set(1 / width, 1 / height);
    resources.composite.uniforms.uSilhouette.value = silhouette;
    resources.volume.uniforms.uTime.value = elapsed.current;
    resources.volume.uniforms.uSteps.value = q.steps;
    resources.volume.uniforms.uOrthographic.value =
      camera instanceof OrthographicCamera;
    camera.getWorldDirection(resources.volume.uniforms.uViewDirection.value);
    gpuTimer.current ??= new GpuTimer(
      gl.getContext() as WebGL2RenderingContext,
    );
    gpuTimer.current.begin();
    gl.autoClear = false;
    // Eight floor updates/second; seeks and parameter edits refresh immediately.
    // No extra floor work in inspection/lab views, or while simulation is still.
    const stirring = resources.volume.uniforms.uFluidActive.value;
    const floorNow = performance.now();
    if (
      !inspect &&
      (resources.floorTime === -Infinity ||
        ((elapsed.current !== resources.floorTime ||
          stirring ||
          resources.floorStirring) &&
          floorNow - resources.floorUpdatedAt >= 125))
    ) {
      resources.floorMaterial.uniforms.uTime.value = elapsed.current;
      gl.setRenderTarget(resources.floorTarget);
      gl.render(resources.floorScene, resources.camera);
      resources.floorTime = elapsed.current;
      resources.floorUpdatedAt = floorNow;
      resources.floorStirring = stirring;
    }
    // Refresh 1/6 of the illumination volume per frame (10 Hz at 60fps).
    // Internal evolution is slow; distributing updates prevents periodic spikes.
    const cache = resources.lightingTarget;
    // Pointer deformation is faster than the baseline billows. Keep all atlas
    // slices at the same time/shape until settling, including one final refresh.
    if (
      !resources.cacheInitialized ||
      reducedMotion.current ||
      stirring ||
      resources.lightingWasStirring
    ) {
      cache.scissorTest = false;
      resources.lightingMaterial.uniforms.uTime.value = elapsed.current;
    } else {
      cache.scissorTest = true;
      cache.scissor.set(0, resources.cacheRow * 12, 384, 12);
      if (resources.cacheRow === 0)
        resources.lightingMaterial.uniforms.uTime.value = elapsed.current;
    }
    gl.setRenderTarget(cache);
    gl.render(resources.lightingScene, resources.camera);
    if (resources.volume.uniforms.uDirectionalIntensity.value > 0) {
      const directional = resources.directionalTarget;
      directional.scissorTest = cache.scissorTest;
      directional.scissor.copy(cache.scissor);
      resources.volume.uniforms.uDirectionalPass.value = true;
      gl.setRenderTarget(directional);
      gl.render(resources.lightingScene, resources.camera);
      resources.volume.uniforms.uDirectionalPass.value = false;
    }
    resources.cacheInitialized = true;
    resources.lightingWasStirring = stirring;
    resources.cacheRow = (resources.cacheRow + 1) % 6;
    gl.setRenderTarget(resources.target);
    gl.setClearColor(0, 0);
    gl.clear();
    gl.render(resources.cloudScene, camera);
    gl.setRenderTarget(null);
    gl.setClearColor(background, 1);
    gl.clear();
    gl.render(state.scene, camera);
    gl.render(resources.compositeScene, resources.camera);
    gpuTimer.current.end();
    const now = performance.now();
    if (!fpsWindow.current.start) fpsWindow.current.start = now;
    fpsWindow.current.frames++;
    const span = now - fpsWindow.current.start;
    if (span >= 500) {
      onFps(Math.round((fpsWindow.current.frames * 1000) / span));
      fpsWindow.current = { start: now, frames: 0 };
    }
    if (!ready.current) {
      ready.current = true;
      onReady();
    }

    // Frame cadence controls quality without render-loop React state updates.
    // Long windows and asymmetric thresholds avoid quality oscillation.
    if (!reducedMotion.current && elapsed.current > 2) {
      samples.current.push(delta * 1000);
      if (samples.current.length >= 120) {
        const sorted = samples.current.sort((a, b) => a - b);
        const p90 = sorted[Math.floor(sorted.length * 0.9)];
        if ((p90 > 21 || gpuTimer.current.p90 > 8) && quality.current > 0) {
          quality.current--;
          stableWindows.current = 0;
        } else if (
          p90 < 17.6 &&
          (gpuTimer.current.p90 === 0 || gpuTimer.current.p90 < 4.5)
        ) {
          stableWindows.current++;
        } else stableWindows.current = 0;
        if (
          stableWindows.current >= 4 &&
          quality.current < qualityLevels.length - 1
        ) {
          quality.current++;
          stableWindows.current = 0;
        }
        gl.domElement.dataset.cloudQuality = String(quality.current);
        gl.domElement.dataset.gpuP90Ms = gpuTimer.current.p90
          ? gpuTimer.current.p90.toFixed(2)
          : "unavailable";
        gl.domElement.dataset.frameP90Ms = p90.toFixed(2);
        gl.domElement.dataset.cloudResolution = `${width}x${height}`;
        samples.current = [];
      }
    }
  }, 1);
  if (error) throw error;
  return inspect ? null : (
    <StudioSpace
      onToggleLight={onToggleLight}
      lights={fixtureLights}
      motion={motion}
      directionalIntensity={Number(
        tuning?.directionalIntensity ?? studio.directional.intensity,
      )}
      floorTexture={floorTexture}
      floorSpill={tuning ? Number(tuning.floorSpill) : undefined}
      lensGlow={tuning ? Number(tuning.lensGlow) : undefined}
      studioShadow={tuning ? Number(tuning.studioShadow) : undefined}
    />
  );
}

export default function CloudStudy({
  framingElement,
  lab = false,
  onSceneReady,
  onFontChange,
}: {
  framingElement?: RefObject<HTMLDivElement | null>;
  lab?: boolean;
  onSceneReady?: () => void;
  onFontChange?: (id: string) => void;
}) {
  const [assetsReady, setAssetsReady] = useState(lab);
  const onAssetsReady = useCallback(() => setAssetsReady(true), []);
  const [preset, setPreset] = useState<number>(approvedCloudPreset);
  const [checkpoint, setCheckpoint] = useState(loadCheckpointSelection);
  const [tuning, setTuning] = useState<Tuning>(() =>
    loadCheckpoint(checkpoint),
  );
  useEffect(() => {
    if (!lab) onFontChange?.(String(tuning.siteFont ?? "inter"));
  }, [tuning.siteFont, onFontChange, lab]);
  const toggleLight = useCallback((index: number) => {
    setTuning((current) => ({
      ...current,
      [`light${index}.enabled`]: !current[`light${index}.enabled`],
    }));
  }, []);
  const draftSettings = useRef<Record<string, Tuning>>({});
  const selectCheckpoint = (id: string) => {
    draftSettings.current[checkpoint] = tuning;
    setCheckpoint(id);
    setTuning(draftSettings.current[id] ?? loadCheckpoint(id));
  };
  useEffect(() => {
    if (!lab && process.env.NODE_ENV !== "production") {
      try {
        localStorage.setItem(
          tuningStorageKey(checkpoint),
          JSON.stringify(tuning),
        );
        localStorage.setItem(checkpointSelectionKey, checkpoint);
      } catch {
        /* Copy/download still work if browser storage is blocked. */
      }
    }
  }, [tuning, checkpoint, lab]);
  const [devOpen, setDevOpen] = useState(() => {
    if (process.env.NODE_ENV === "production") return false;
    try {
      return localStorage.getItem("cloud-dev-open") === "true";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    try {
      localStorage.setItem("cloud-dev-open", String(devOpen));
    } catch {
      /* Session toggle still works. */
    }
  }, [devOpen]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (ready && assetsReady) onSceneReady?.();
  }, [ready, assetsReady, onSceneReady]);
  const [inspect, setInspect] = useState(lab);
  const [silhouette, setSilhouette] = useState(false);
  const [inspectionView, setInspectionView] = useState<
    "front" | "top" | "side" | "other-side"
  >("front");
  const [resetView, setResetView] = useState(0);
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        event.key !== "`" ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey ||
        event.repeat ||
        event.isComposing ||
        event.defaultPrevented
      )
        return;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest("input, textarea, select, [role='textbox']"))
      )
        return;
      event.preventDefault();
      setDevOpen(!devOpen);
      if (devOpen && !lab) {
        setInspect(false);
        setSilhouette(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [devOpen, lab]);
  const fpsOutput = useRef<HTMLOutputElement>(null);
  const onFps = useCallback((fps: number) => {
    if (fpsOutput.current) fpsOutput.current.textContent = `${fps} FPS`;
  }, []);
  return (
    <div
      className={`${styles.study} ${lab ? styles.lab : ""}`}
      data-cloud-ready={ready}
    >
      {devOpen && !lab && (
        <TuningPanel
          values={tuning}
          onChange={setTuning}
          checkpoint={checkpoint}
          onCheckpointChange={selectCheckpoint}
        />
      )}
      {!lab && !inspect && (
        <div className={styles.keyboardLights}>
          {["Blue", "Pink"].map((name, index) => (
            <button
              key={name}
              aria-pressed={!!tuning[`light${index}.enabled`]}
              onClick={() => toggleLight(index)}
            >
              {name} studio light
            </button>
          ))}
        </div>
      )}
      <GraphicsBoundary fallback={<Fallback onReady={onSceneReady} />}>
        <div className={styles.canvas} aria-hidden="true">
          <Canvas
            camera={{
              manual: true,
              position: [3.4, 4.7, 13.5],
              fov: 32,
              near: 0.1,
              far: 100,
            }}
            shadows="variance"
            dpr={[1, 1.5]}
            gl={{ alpha: false, antialias: true, powerPreference: "low-power" }}
            onCreated={({ gl }) => {
              gl.toneMapping = ACESFilmicToneMapping;
              gl.toneMappingExposure = studio.exposure;
              gl.shadowMap.autoUpdate = false;
              gl.shadowMap.needsUpdate = true;
            }}
          >
            {!lab && (
              <Suspense fallback={null}>
                <SceneAssetsReady onReady={onAssetsReady} />
              </Suspense>
            )}
            <Renderer
              onToggleLight={toggleLight}
              assetsReady={assetsReady}
              framingElement={framingElement}
              onReady={() => setReady(true)}
              onFps={onFps}
              inspect={inspect}
              resetView={resetView}
              silhouette={silhouette}
              inspectionView={inspectionView}
              lab={lab}
              preset={preset}
              tuning={lab ? null : tuning}
            />
          </Canvas>
        </div>
      </GraphicsBoundary>
      {devOpen && (
        <div
          className={styles.inspector}
          aria-label="Temporary cloud inspection controls"
        >
          {lab && (
            <>
              <div role="group" aria-label="Rendering comparison">
                {activeLabPresets.map((index) => (
                  <button
                    key={index}
                    aria-pressed={preset === index}
                    onClick={() => setPreset(index)}
                  >
                    {labPresets[index].label}
                  </button>
                ))}
              </div>
              <span>{labPresets[preset].description}</span>
              <details className={styles.archive}>
                <summary>Earlier experiments</summary>
                <div role="group" aria-label="Archived rendering comparisons">
                  {labPresets.map(
                    (item, index) =>
                      !activeLabPresets.includes(index) && (
                        <button
                          key={index}
                          aria-pressed={preset === index}
                          onClick={() => setPreset(index)}
                        >
                          {item.label}
                        </button>
                      ),
                  )}
                </div>
              </details>
            </>
          )}
          <div>
            <button
              type="button"
              aria-pressed={inspect && inspectionView === "front"}
              onClick={() => {
                setInspect(true);
                setInspectionView("front");
                setResetView((n) => n + 1);
              }}
            >
              Front view
            </button>
            <button
              type="button"
              aria-pressed={inspect && inspectionView === "top"}
              onClick={() => {
                setInspect(true);
                setInspectionView("top");
                setResetView((n) => n + 1);
              }}
            >
              Top view
            </button>
            <button
              type="button"
              aria-pressed={inspect && inspectionView === "side"}
              onClick={() => {
                setInspect(true);
                setInspectionView("side");
                setResetView((value) => value + 1);
              }}
            >
              Side view
            </button>
            <button
              type="button"
              aria-pressed={inspect && inspectionView === "other-side"}
              onClick={() => {
                setInspect(true);
                setInspectionView("other-side");
                setResetView((value) => value + 1);
              }}
            >
              Other side
            </button>
            {!lab && (
              <button
                type="button"
                aria-pressed={!inspect}
                onClick={() => {
                  setInspect(false);
                  setSilhouette(false);
                }}
              >
                Studio view
              </button>
            )}
            <button
              type="button"
              aria-pressed={silhouette}
              onClick={() => {
                setInspect(true);
                setSilhouette((value) => !value);
                setInspectionView("front");
                setResetView((n) => n + 1);
              }}
            >
              Silhouette
            </button>
          </div>
          {silhouette && (
            <a
              href="/cloud/silhouette-comparison.png"
              target="_blank"
              rel="noreferrer"
            >
              Latest scored comparison
            </a>
          )}
          {inspect && (
            <span>
              Cloud inspection · drag to orbit · scroll or pinch to zoom
            </span>
          )}
        </div>
      )}
      {devOpen && !lab && (
        <output
          ref={fpsOutput}
          className={styles.fps}
          aria-label="Frames per second"
        >
          — FPS
        </output>
      )}
    </div>
  );
}
