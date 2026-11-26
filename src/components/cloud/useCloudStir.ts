import type { createFluidField } from "./fluidField";
import { recordTrace, traceRecording } from "./interactionTrace";
import { useEffect, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Plane, Raycaster, Vector2, Vector3, type ShaderMaterial } from "three";
import type { Tuning } from "./tuning";
import type { MotionSample } from "./motion";

type Resources = {
  fluidField: ReturnType<typeof createFluidField>;
  volume: ShaderMaterial;
};
function upload(resources: Resources) {
  resources.volume.uniforms.uFluidActive.value = resources.fluidField.active;
}
export function useCloudStir(
  resources: RefObject<Resources | null>,
  motion: RefObject<MotionSample>,
  tuning: Tuning | null,
  disabled: boolean,
) {
  const { gl, camera, invalidate } = useThree();
  const touchSurface = useRef<HTMLDivElement | null>(null);
  const touchBounds = useRef(
    [-2.05, 2.05].flatMap((x) =>
      [-1.2, 1.2].flatMap((y) =>
        [-1.55, 1.55].map((z) => new Vector3(x, y, z)),
      ),
    ),
  );
  const projected = useRef(new Vector3());
  const input = useRef({
    previous: new Vector2(),
    lastTime: 0,
    ray: new Raycaster(),
    plane: new Plane(),
    ndc: new Vector2(),
    hit: new Vector3(),
    previousHit: new Vector3(),
    axis: new Vector3(),
    origin: new Vector3(),
  });
  useEffect(() => {
    const s = input.current;
    if (traceRecording()) recordTrace("configuration", { tuning, disabled });
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const fine = matchMedia("(any-hover: hover) and (any-pointer: fine)");
    const coarse = matchMedia("(any-pointer: coarse)");
    const surface = document.createElement("div");
    surface.dataset.cloudTouchSurface = "true";
    surface.setAttribute("aria-hidden", "true");
    Object.assign(surface.style, {
      position: "absolute",
      touchAction: "pinch-zoom",
      userSelect: "none",
      WebkitUserSelect: "none",
      pointerEvents: "none",
    });
    gl.domElement.parentElement?.appendChild(surface);
    touchSurface.current = surface;
    let activeTouch: number | null = null;
    const endTouch = () => {
      const id = activeTouch;
      activeTouch = null;
      if (id !== null && surface.hasPointerCapture(id))
        surface.releasePointerCapture(id);
    };
    const updateSurface = () => {
      surface.style.pointerEvents =
        !disabled && tuning?.stirEnabled && !reduced.matches && coarse.matches
          ? "auto"
          : "none";
    };
    updateSurface();
    const reset = () => {
      endTouch();
      s.lastTime = 0;
    };
    const clear = () => {
      reset();
      updateSurface();
      resources.current?.fluidField.reset();
      invalidate();
    };
    const sample = (event: PointerEvent, rect: DOMRect) => {
      if (!tuning) return "no-tuning";
      const now = event.timeStamp / 1000,
        elapsed = now - s.lastTime;
      // A stationary cursor emits no events. Do not discard the first swipe
      // after a pause or average its velocity across all that idle time.
      // Its exact departure time is unknown; bound the estimate to 32 ms.
      const dt = elapsed > 0.15 ? 0.032 : elapsed;
      // Ignore duplicate timestamps without disturbing the previous sample.
      if (dt <= 0) return "duplicate-time";
      const firstSample = s.lastTime === 0;
      const x = s.previous.x,
        y = s.previous.y;
      s.previous.set(event.clientX, event.clientY);
      s.lastTime = now;
      if (firstSample) {
        return "first-sample";
      }
      const m = motion.current;
      s.origin.set(m.x, m.y, m.z);
      camera.getWorldDirection(s.axis);
      s.plane.setFromNormalAndCoplanarPoint(s.axis, s.origin);
      const project = (x: number, y: number, out: Vector3) => {
        s.ndc.set(
          ((x - rect.left) / rect.width) * 2 - 1,
          1 - ((y - rect.top) / rect.height) * 2,
        );
        s.ray.setFromCamera(s.ndc, camera);
        return s.ray.ray.intersectPlane(s.plane, out);
      };
      if (
        !project(event.clientX, event.clientY, s.hit) ||
        !project(x, y, s.previousHit)
      )
        return "projection-miss";
      s.axis
        .copy(s.hit)
        .add(s.previousHit)
        .multiplyScalar(0.5)
        .sub(camera.position)
        .normalize();
      s.hit.sub(s.origin);
      s.previousHit.sub(s.origin);
      const speed = s.hit.distanceTo(s.previousHit) / dt;
      const threshold = Number(tuning.stirThreshold ?? 0.05);
      if (
        speed <= threshold ||
        Math.min(s.hit.x, s.previousHit.x) > 2.3 ||
        Math.max(s.hit.x, s.previousHit.x) < -2.3 ||
        Math.min(s.hit.y, s.previousHit.y) > 1.4 ||
        Math.max(s.hit.y, s.previousHit.y) < -1.4
      ) {
        return speed <= threshold ? "below-threshold" : "outside-bounds";
      }
      if (!resources.current) return "not-ready";
      const radius = Number(tuning.fluidRadius ?? 0.25);
      resources.current.fluidField.impulse(
        s.previousHit,
        s.hit,
        s.axis,
        radius,
        Number(tuning.fluidStrength ?? 0.55),
      );
      invalidate();
      return { mode: "fluid", speed, radius };
    };
    const move = (event: PointerEvent) => {
      if (traceRecording())
        recordTrace("dispatch", {
          timestamp: event.timeStamp,
          x: event.clientX,
          y: event.clientY,
          disabled,
          enabled: tuning?.stirEnabled,
          reduced: reduced.matches,
          fine: fine.matches,
          pointerType: event.pointerType,
          overControls:
            event.target instanceof Element &&
            Boolean(
              event.target.closest(
                'button,a,input,select,textarea,[aria-label="Cloud tuning"]',
              ),
            ),
        });
      if (
        disabled ||
        !tuning?.stirEnabled ||
        reduced.matches ||
        (event.pointerType === "mouse"
          ? !fine.matches || activeTouch !== null
          : event.pointerId !== activeTouch)
      )
        return;
      if (
        event.target instanceof Element &&
        event.target.closest(
          'button,a,input,select,textarea,[aria-label="Cloud tuning"]',
        )
      ) {
        reset();
        return;
      }
      const rect = gl.domElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      // Coalesced samples retain their original timestamps, so batching cannot
      // reset recovery or change velocity. Fall back on unsupported browsers.
      const consume = (point: PointerEvent) => {
        const result = sample(point, rect);
        if (traceRecording())
          recordTrace("sample", {
            x: point.clientX,
            y: point.clientY,
            timestamp: point.timeStamp,
            dispatchedAt: performance.now(),
            rect: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            },
            result:
              typeof result === "object"
                ? JSON.parse(JSON.stringify(result))
                : result,
          });
      };
      const samples = event.getCoalescedEvents?.();
      if (samples?.length) {
        for (const point of samples) consume(point);
      } else {
        consume(event);
      }
    };
    const down = (event: PointerEvent) => {
      if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
      if (
        activeTouch !== null ||
        disabled ||
        !tuning?.stirEnabled ||
        reduced.matches
      )
        return;
      activeTouch = event.pointerId;
      s.previous.set(event.clientX, event.clientY);
      s.lastTime = event.timeStamp / 1000;
      surface.setPointerCapture(event.pointerId);
    };
    const up = (event: PointerEvent) => {
      if (event.pointerId === activeTouch) reset();
    };
    surface.addEventListener("pointerdown", down);
    surface.addEventListener("pointerup", up);
    surface.addEventListener("pointercancel", up);
    surface.addEventListener("lostpointercapture", up);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("blur", reset);
    document.documentElement.addEventListener("pointerleave", reset);
    reduced.addEventListener("change", clear);
    fine.addEventListener("change", clear);
    coarse.addEventListener("change", clear);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("blur", reset);
      document.documentElement.removeEventListener("pointerleave", reset);
      reduced.removeEventListener("change", clear);
      fine.removeEventListener("change", clear);
      coarse.removeEventListener("change", clear);
      clear();
      surface.removeEventListener("pointerdown", down);
      surface.removeEventListener("pointerup", up);
      surface.removeEventListener("pointercancel", up);
      surface.removeEventListener("lostpointercapture", up);
      surface.remove();
      touchSurface.current = null;
    };
  }, [camera, gl, invalidate, disabled, tuning, motion, resources]);
  useFrame((_, delta) => {
    const surface = touchSurface.current;
    if (surface && surface.style.pointerEvents === "auto") {
      const width = gl.domElement.clientWidth,
        height = gl.domElement.clientHeight;
      let left = width,
        right = 0,
        top = height,
        bottom = 0;
      for (const corner of touchBounds.current) {
        const p = projected.current.copy(corner);
        p.x += motion.current.x;
        p.y += motion.current.y;
        p.z += motion.current.z;
        p.project(camera);
        const x = ((p.x + 1) * width) / 2,
          y = ((1 - p.y) * height) / 2;
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
      left = Math.max(0, Math.floor(left));
      top = Math.max(0, Math.floor(top));
      const geometry = `${left},${top},${Math.max(0, Math.ceil(Math.min(width, right) - left))},${Math.max(0, Math.ceil(Math.min(height, bottom) - top))}`;
      if (surface.dataset.bounds !== geometry) {
        const [x, y, w, h] = geometry.split(",");
        Object.assign(surface.style, {
          left: `${x}px`,
          top: `${y}px`,
          width: `${w}px`,
          height: `${h}px`,
        });
        surface.dataset.bounds = geometry;
      }
    }
    if (!resources.current) return;
    const now = performance.now() / 1000;
    const fluid = resources.current.fluidField;
    if (disabled || !tuning?.stirEnabled) fluid.reset();
    else
      fluid.update(
        delta,
        Number(tuning.fluidDrag ?? 0.8),
        Number(tuning.fluidReturn ?? 0.5),
      );
    upload(resources.current);
    if (traceRecording())
      recordTrace("frame", {
        timestamp: now * 1000,
        fluidActive: fluid.active,
        camera: camera.matrixWorld.toArray(),
        projection: camera.projectionMatrix.toArray(),
        motion: { ...motion.current },
      });
  }, -0.5);
}
