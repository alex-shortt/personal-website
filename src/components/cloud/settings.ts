// World units are metres. Fixture geometry and volumetric lighting share this data.
export const studio = {
  cloudBounds: [2.05, 1.2, 1.55] as const,
  floorY: -1.85,
  directional: {
    position: [-1.5, 10, 2] as const,
    color: "#fffaf3",
    intensity: 2.8,
  },
  // Cone angles are half-angles in degrees; power is on-axis intensity.
  lights: [
    // Cyan: high on the camera-left side, sweeping across the upper-right bank.
    {
      position: [-2.0, 3.0, 1.8],
      // Narrow soft cone reaches down toward the cloud midpoint.
      target: [0.65, 0.58, 0.25],
      innerAngle: 10,
      outerAngle: 25,
      color: "#23f7ff",
      power: 192,
      size: 1,
    },
    // Pink: camera-side fill just below mid-height, aimed slightly upward.
    {
      position: [0.25, -0.35, 3.7],
      target: [0, 0.12, 0.15],
      innerAngle: 36,
      outerAngle: 55,
      color: "#ff43e9",
      power: 132,
      size: 1,
    },
  ],
  ambient: { color: "#fcfcfc", intensity: 0.4 },
  // Light-path attenuation is independent of view opacity: tighter lighting
  // without changing the silhouette or turning wisps into solid geometry.
  cloudLighting: {
    extinction: 5.2,
    bounce: 0.48,
    separation: 1.0,
    transitionWidth: 0.08,
  },
  cloudColor: { saturation: 1.0 },
  // Inward rounding band in metres; thin wisps need a much narrower band.
  cloudShape: { edgeWidth: 0.24, wispEdgeWidth: 0.018 },
  exposure: 1.15,
};

// Start conservatively; promote only after several seconds of smooth frames.
export const qualityLevels = [
  { scale: 0.5, steps: 36 },
  { scale: 0.65, steps: 48 },
  { scale: 0.8, steps: 64 },
] as const;

// Display calibration for the surrounding studio, independent of cloud grading.
export const studioPresentationDefaults = {
  directionalIntensity: studio.directional.intensity,
  floorSpill: 0.47,
  lensGlow: 1.32,
  studioShadow: 0.19,
  stirEnabled: true,
  stirThreshold: 0.05,
  fluidStrength: 0.55,
  fluidRadius: 0.25,
  fluidDrag: 0.8,
  fluidReturn: 0.5,
  siteFont: "work",
  cameraSway: false,
  cameraSwayHorizontal: 1.5,
  cameraSwayVertical: 0.6,
  cameraSwaySmoothing: 0.4,
};
