import type { Tuning } from "./tuning";

export const motionDefaults = {
  motionPaused: false,
  motionTime: 0,
  floatAmount: 0.04,
  floatPeriod: 10,
  swayAmount: 0.008,
  billowStrength: 0.45,
  circulationSpeed: 0.18,
  vortexSize: 0.85,
  secondaryVortex: 0.65,
  evolutionSpeed: 0.12,
  legacyDrift: 0,
  shadowResponse: 1,
};
export type MotionSample = {
  x: number;
  y: number;
  z: number;
  response: number;
};
// Keep this translation identical to movingPoint() in shaders.ts.
export function sampleMotion(time: number, t: Tuning | null): MotionSample {
  if (!t) return { x: 0, y: Math.sin(time * 0.19) * 0.035, z: 0, response: 0 };
  const phase = (time * Math.PI * 2) / Number(t.floatPeriod);
  return {
    x: Number(t.swayAmount) * Math.sin(phase * 0.73 + 1.3),
    y:
      Number(t.floatAmount) *
      (0.85 * Math.sin(phase + 0.45) + 0.15 * Math.sin(phase * 1.37 + 2.1)),
    z: Number(t.swayAmount) * 0.5 * Math.sin(phase * 0.91 + 3.8),
    response: Number(t.shadowResponse),
  };
}
