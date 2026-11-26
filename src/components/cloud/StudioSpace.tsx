import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import {
  Color,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  ShaderMaterial,
  type Texture,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { MotionSample } from "./motion";
import type { RefObject } from "react";
import { studio, studioPresentationDefaults } from "./settings";

function FixtureModel({
  kind,
  color,
  height,
  glow = 1,
  hovered = false,
}: {
  hovered?: boolean;
  glow?: number;
  height?: number;
  kind: "stand" | "spotlight";
  color?: string;
}) {
  const gltf = useLoader(
    GLTFLoader,
    `/models/${kind === "stand" ? "stand-segmented" : kind}.glb`,
  );
  const refreshShadows = useRef(true);
  const invalidate = useThree((state) => state.invalidate);
  const model = useMemo(() => {
    const object = gltf.scene.clone(true);
    if (kind === "stand") {
      const baseHeight = 0.96,
        capHeight = 0.237335,
        segmentHeight = 0.435;
      const capStart = Math.max(baseHeight, (height ?? 3) - capHeight);
      const segment = object.getObjectByName("segment")!;
      object.remove(segment);
      object.getObjectByName("cap")!.position.y = capStart;
      const gap = capStart - baseHeight;
      if (gap > 0) {
        const count = Math.ceil((gap + 0.06) / (segmentHeight - 0.03));
        for (let i = 0; i < count; i++) {
          const part = segment.clone(true);
          part.position.y =
            count === 1
              ? capStart - segmentHeight + 0.03
              : baseHeight -
                0.03 +
                (i / (count - 1)) * (gap - segmentHeight + 0.06);
          object.add(part);
        }
      }
    }
    object.traverse((child) => {
      if (child instanceof Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (color && child.material instanceof MeshStandardMaterial) {
          child.material = child.material.clone();
          if (hovered) child.material.color.lerp(new Color("#ffffff"), 0.12);
          // Retain the authored metal/roughness detail. Only soften the
          // sharpest highlights, rather than replacing it with a matte finish.
          child.material.onBeforeCompile = (
            shader: Parameters<MeshStandardMaterial["onBeforeCompile"]>[0],
          ) => {
            shader.fragmentShader = shader.fragmentShader.replace(
              "#include <roughnessmap_fragment>",
              "#include <roughnessmap_fragment>\nroughnessFactor = max(roughnessFactor, 0.28);",
            );
          };
          child.material.customProgramCacheKey = () =>
            "fixture-roughness-floor-028";
          // Preserve the authored emissive mask; the black housing stays black.
          child.material.emissive = new Color(color);
          child.material.emissiveIntensity = glow * 0.6;
        }
      }
    });
    return object;
  }, [gltf, color, kind, height, glow, hovered]);
  useEffect(() => {
    // Asset arrival must refresh the otherwise cached fixture shadows.
    refreshShadows.current = true;
    invalidate();
    return () => {
      if (color)
        model.traverse((child) => {
          if (child instanceof Mesh) child.material.dispose();
        });
    };
  }, [invalidate, model, color]);
  useFrame(({ gl }) => {
    if (refreshShadows.current) {
      gl.shadowMap.needsUpdate = true;
      refreshShadows.current = false;
    }
  });
  return <primitive object={model} dispose={null} />;
}

function FootShadow({ x, z }: { x: number; z: number }) {
  return (
    <mesh
      position={[x, studio.floorY + 0.008, z]}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={2}
    >
      <planeGeometry args={[0.19, 0.19]} />
      <shaderMaterial
        vertexShader={shadowVertex}
        fragmentShader={contactFragment}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function StudioLight({
  onToggle,
  light,
  lensGlow,
}: {
  onToggle: () => void;
  light: (typeof studio.lights)[number];
  lensGlow: number;
}) {
  const [hovered, setHovered] = useState(false);
  const canvas = useThree((state) => state.gl.domElement);
  useEffect(() => {
    if (!hovered) return;
    const previous = canvas.style.cursor;
    canvas.style.setProperty("cursor", "pointer");
    return () => {
      canvas.style.setProperty("cursor", previous);
    };
  }, [hovered, canvas]);
  const strength = lensGlow * (1 - Math.exp(-light.power / 100));
  const lensUniforms = useMemo(
    () => ({
      uColor: { value: new Color(light.color) },
      uStrength: { value: strength },
    }),
    [light.color, strength],
  );
  const rotation = useMemo(
    () =>
      new Quaternion().setFromUnitVectors(
        new Vector3(0, 0, 1),
        new Vector3(...light.target)
          .sub(new Vector3(...light.position))
          .normalize(),
      ),
    [light.position, light.target],
  );
  // Keep the established stand placement. Extend only its top to bridge
  // the small socket gap; do not rotate or relocate the stand with the yoke.
  const direction = new Vector3(...light.target)
    .sub(new Vector3(...light.position))
    .normalize();
  const mount = new Vector3(...light.position).addScaledVector(
    direction,
    -light.size * 0.3,
  );
  const [x, y, z] = [mount.x, mount.y - 0.15 * light.size, mount.z];
  const floor = studio.floorY;
  return (
    <group name="studio-fixture">
      <group position={[x, floor, z]}>
        <Suspense fallback={null}>
          <FixtureModel kind="stand" height={y - floor} />
        </Suspense>
      </group>
      {[
        [-1.6, 2.45],
        [-1.6, -2.45],
        [2.8, 0],
      ].map(([fx, fz], i) => (
        <FootShadow
          key={i}
          x={x + (fx / 9.58) * 2.1}
          z={z + (fz / 9.58) * 2.1}
        />
      ))}
      <group
        position={light.position as [number, number, number]}
        quaternion={rotation}
      >
        <group scale={light.size}>
          <mesh
            position={[0, -0.05, -0.2]}
            userData={{ excludeFromFraming: true }}
            onPointerOver={(event) => {
              event.stopPropagation();
              setHovered(true);
            }}
            onPointerOut={() => setHovered(false)}
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
          >
            <boxGeometry args={[0.65, 0.72, 0.9]} />
            <meshBasicMaterial colorWrite={false} depthWrite={false} />
          </mesh>
          <Suspense fallback={null}>
            <FixtureModel
              hovered={hovered}
              kind="spotlight"
              color={light.color}
              glow={strength}
            />
          </Suspense>
          {/* Authored lens lies at local z=-0.03; +Z is the emission direction.
              Front-facing only, with normal depth testing against the housing. */}
          {strength > 0 && (
            <>
              <mesh position={[0, 0, -0.024]}>
                <circleGeometry args={[0.128, 32]} />
                <shaderMaterial
                  vertexShader={shadowVertex}
                  fragmentShader={lensFragment}
                  uniforms={lensUniforms}
                />
              </mesh>
              {/* Short-range, unshadowed light illuminates the inner barn doors. */}
              <pointLight
                position={[0, 0, 0.06]}
                color={light.color}
                intensity={0.3 * strength}
                distance={0.65}
                decay={2}
              />
            </>
          )}
        </group>
      </group>
    </group>
  );
}

const shadowVertex = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }
`;
const lensFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  varying vec2 vUv;
  void main() {
    float r=length((vUv-0.5)*2.0);
    vec3 color=mix(uColor,vec3(1.0),0.8*(1.0-smoothstep(0.0,0.9,r)));
    gl_FragColor=vec4(color*uStrength*2.2,1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
const floorSpillVertex = /* glsl */ `
  varying vec2 vGroundUV;
  void main() {
    vec4 world=modelMatrix*vec4(position,1.0);
    vGroundUV=world.xz/16.0+0.5;
    gl_Position=projectionMatrix*viewMatrix*world;
  }
`;
const floorSpillFragment = /* glsl */ `
  uniform sampler2D uFloorLight;
  uniform vec3 uBlue;
  uniform vec3 uPink;
  uniform float uStrength;
  varying vec2 vGroundUV;
  void main() {
    vec2 energy=texture2D(uFloorLight,vGroundUV).rg;
    float total=energy.x+energy.y;
    vec3 tint=(uBlue*energy.x+uPink*energy.y)/max(total,0.00001);
    // Exposure-calibrated pastel wash on the near-white seamless backdrop.
    // Geometry/irradiance/transmission are physical; this display tint is not GI.
    vec3 color=mix(vec3(1.0),tint,0.55);
    vec2 border=smoothstep(vec2(0.0),vec2(0.04),vGroundUV)*
                (1.0-smoothstep(vec2(0.96),vec2(1.0),vGroundUV));
    float alpha=uStrength*(1.0-exp(-total*0.1))*border.x*border.y;
    gl_FragColor=vec4(color,alpha);
    #include <colorspace_fragment>
  }
`;
const contactFragment = /* glsl */ `
  varying vec2 vUv;
  void main(){
    float r=length((vUv-0.5)*2.0);
    float alpha=exp(-r*r*5.0)*(1.0-smoothstep(0.65,1.0,r))*0.48;
    gl_FragColor=vec4(0.22,0.23,0.25,alpha);
    #include <colorspace_fragment>
  }
`;
const shadowFragment = /* glsl */ `
  uniform float uOpacity;
  uniform float uSoftness;
  varying vec2 vUv;
  void main(){
    vec2 p=(vUv-0.5)*2.0;
    float shadow=exp(-dot(p,p)*uSoftness)*0.15*uOpacity;
    shadow*=1.0-smoothstep(0.65,1.0,max(abs(p.x),abs(p.y)));
    gl_FragColor=vec4(0.38,0.41,0.48,shadow);
    #include <colorspace_fragment>
  }
`;

export default function StudioSpace({
  onToggleLight,
  lights = studio.lights,
  motion,
  floorTexture,
  directionalIntensity = studio.directional.intensity,
  floorSpill = studioPresentationDefaults.floorSpill,
  lensGlow = studioPresentationDefaults.lensGlow,
  studioShadow = studioPresentationDefaults.studioShadow,
}: {
  onToggleLight: (index: number) => void;
  lights?: typeof studio.lights;
  motion: RefObject<MotionSample>;
  floorTexture: Texture | null;
  directionalIntensity?: number;
  floorSpill?: number;
  lensGlow?: number;
  studioShadow?: number;
}) {
  const spillUniforms = useMemo(
    () => ({
      uFloorLight: { value: floorTexture },
      uBlue: { value: new Color(lights[0].color) },
      uPink: { value: new Color(lights[1].color) },
      uStrength: { value: floorSpill },
    }),
    [floorTexture, lights, floorSpill],
  );
  const cloudShadow = useRef<Mesh>(null);
  const shadowUniforms = useMemo(
    () => ({ uOpacity: { value: 1 }, uSoftness: { value: 3.5 } }),
    [],
  );
  const invalidate = useThree((state) => state.invalidate);
  const refreshShadows = useRef(true);
  useEffect(() => {
    refreshShadows.current = true;
    invalidate();
  }, [invalidate, lights]);
  useFrame(({ gl }) => {
    const shadow = cloudShadow.current;
    if (shadow) {
      const m = motion.current;
      const height = m.y * m.response;
      const scale = Math.max(0.7, 1 + height * 0.8);
      shadow.position.set(0.05 + m.x, studio.floorY + 0.006, 0.15 + m.z);
      shadow.scale.set(scale, scale, 1);
      const material = shadow.material as ShaderMaterial;
      material.uniforms.uOpacity.value = Math.max(
        0.2,
        Math.min(1.5, 1 - height * 1.6),
      );
      material.uniforms.uSoftness.value = Math.max(2.0, 3.5 - height * 2.5);
      gl.domElement.dataset.cloudShadow = JSON.stringify({
        x: m.x,
        y: m.y,
        z: m.z,
        scale,
        opacity: material.uniforms.uOpacity.value,
      });
    }
    if (refreshShadows.current) {
      gl.shadowMap.needsUpdate = true;
      refreshShadows.current = false;
    }
  });
  return (
    <>
      <hemisphereLight args={["#ffffff", "#c6c4c0", 2.2]} />
      <directionalLight
        position={studio.directional.position}
        intensity={directionalIntensity}
        color={studio.directional.color}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-camera-near={0.5}
        shadow-camera-far={25}
        shadow-bias={-0.0002}
        shadow-normalBias={0.003}
        shadow-radius={6}
        shadow-blurSamples={16}
      />
      {/* Only shadow is drawn: the floor and the page are literally the same color.
        Static fixture shadows are cached. The volume gets a broad analytic contact
        shadow instead of an expensive per-frame volumetric ground-shadow pass. */}
      <mesh
        position={[0, studio.floorY, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[100, 100]} />
        <shadowMaterial
          transparent
          color="#6c7380"
          opacity={studioShadow}
          depthWrite={false}
        />
      </mesh>
      <mesh
        ref={cloudShadow}
        position={[0.05, studio.floorY + 0.006, 0.15]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={1}
      >
        <planeGeometry args={[5.2, 3.6]} />
        <shaderMaterial
          vertexShader={shadowVertex}
          fragmentShader={shadowFragment}
          uniforms={shadowUniforms}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {floorTexture && floorSpill > 0 && (
        <mesh
          position={[0, studio.floorY + 0.004, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={-1}
        >
          <planeGeometry args={[16, 16]} />
          <shaderMaterial
            vertexShader={floorSpillVertex}
            fragmentShader={floorSpillFragment}
            uniforms={spillUniforms}
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}
      <StudioLight
        light={lights[0]}
        lensGlow={lensGlow}
        onToggle={() => onToggleLight(0)}
      />
      <StudioLight
        light={lights[1]}
        lensGlow={lensGlow}
        onToggle={() => onToggleLight(1)}
      />
    </>
  );
}
