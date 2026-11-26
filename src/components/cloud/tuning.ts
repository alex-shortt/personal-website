import { fontChoices } from "@/styles/fontChoices";
import { motionDefaults } from "./motion";
import { studio, studioPresentationDefaults } from "./settings";
import checkpointV1 from "../../../public/cloud/checkpoints/v1.json";
import checkpointV2 from "../../../public/cloud/checkpoints/v2.json";
import checkpointV3 from "../../../public/cloud/checkpoints/v3.json";
import checkpointV4 from "../../../public/cloud/checkpoints/v4.json";
import checkpointV5 from "../../../public/cloud/checkpoints/v5.json";
import checkpointV6 from "../../../public/cloud/checkpoints/v6.json";

export type Tuning = Record<string, number | string | boolean>;
export type Control = {
  key: string;
  label: string;
  value: number | string | boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string; disabled?: boolean }[];
};
const n = (
  key: string,
  label: string,
  value: number,
  min: number,
  max: number,
  step: number,
): Control => ({ key, label, value, min, max, step });
export const tuningGroups: {
  label: string;
  description?: string;
  controls: Control[];
}[] = [
  {
    label: "Typography",
    description:
      "Preview the homepage typeface. All enabled options allow commercial website use; Neue Montreal needs licensed files.",
    controls: [
      {
        key: "siteFont",
        label: "Typeface",
        value: "work",
        options: fontChoices,
      },
    ],
  },
  {
    label: "Display",
    controls: [
      { key: "filmic", label: "Filmic enabled", value: true },
      n("filmicStrength", "Filmic strength", 1, 0, 1, 0.01),
      n("exposure", "Cloud exposure", studio.exposure, 0.1, 5, 0.01),
      n("ambient", "Cloud ambient", 0.01, 0, 2, 0.001),
    ],
  },
  ...studio.lights.map((l, i) => ({
    label: i === 0 ? "Blue spotlight" : "Pink spotlight",
    controls: [
      { key: `light${i}.enabled`, label: "Enabled", value: true },
      { key: `light${i}.color`, label: "Color", value: l.color },
      n(`light${i}.power`, "Intensity", l.power * 3, 0, 5000, 1),
      n(`light${i}.angle`, "Cone half-angle °", l.outerAngle, 1, 89, 0.1),
      n(
        `light${i}.penumbra`,
        "Penumbra",
        1 - l.innerAngle / l.outerAngle,
        0.001,
        1,
        0.001,
      ),
      n(`light${i}.distance`, "Range (0 = unlimited)", 0, 0, 30, 0.1),
      n(`light${i}.decay`, "Distance falloff", 2, 0, 4, 0.01),
      ...(["position", "target"] as const).flatMap((field) =>
        ["x", "y", "z"].map((axis, j) =>
          n(
            `light${i}.${field}.${axis}`,
            `${field === "position" ? "Position" : "Target"} ${axis}`,
            l[field][j],
            field === "position" && axis === "y" ? -0.4 : -8,
            8,
            0.01,
          ),
        ),
      ),
    ],
  })),
  {
    label: "Scattering & color",
    controls: [
      n("extinction", "Light extinction", 5.2, 0.1, 15, 0.1),
      n("viewExtinction", "View extinction", 7, 0.1, 15, 0.1),
      n("bounce", "Internal bounce", 0.48, 0, 2, 0.01),
      n("phase", "Forward scattering", 0.48, -0.8, 0.85, 0.01),
      n("separation", "Winner-takes-most", 1, 0, 1, 0.01),
      n("transition", "Color transition width", 0.0575, 0.005, 0.3, 0.0025),
      n("variation", "Interlocking color", 1.5, 0, 3, 0.01),
    ],
  },
  {
    label: "Density",
    controls: [
      n("density", "Density multiplier", 1, 0.1, 3, 0.01),
      n("noiseScale", "Billow frequency", 1, 0.5, 2, 0.01),
      n("erosion", "Fine erosion", 0.085, 0, 0.2, 0.001),
      { key: "rounderDepth", label: "Rounder depth", value: true },
      n("edgeWidth", "Edge rounding", 0.24, 0.04, 0.5, 0.01),
      n("wispEdgeWidth", "Wisp rounding", 0.018, 0.005, 0.1, 0.001),
    ],
  },
  {
    label: "Studio",
    controls: [
      n(
        "directionalIntensity",
        "Directional light",
        studio.directional.intensity,
        0,
        5,
        0.05,
      ),
      n(
        "floorSpill",
        "Colored floor spill",
        studioPresentationDefaults.floorSpill,
        0,
        1,
        0.01,
      ),
      n(
        "lensGlow",
        "Lens / barn-door glow",
        studioPresentationDefaults.lensGlow,
        0,
        3,
        0.01,
      ),
      n(
        "studioShadow",
        "Stand shadow opacity",
        studioPresentationDefaults.studioShadow,
        0,
        0.4,
        0.01,
      ),
    ],
  },
  {
    label: "Interaction",
    description: "Movement below the activation speed does not push the fluid.",
    controls: [
      { key: "stirEnabled", label: "Mouse interaction", value: true },
      n("stirThreshold", "Activation speed (m/s)", 0.05, 0, 10, 0.01),
    ],
  },
  {
    label: "Fluid interaction",
    description:
      "A coarse 3D velocity field pushes and carries the cloud, then relaxes back to its original shape.",
    controls: [
      n("fluidStrength", "Push strength", 0.55, 0, 4, 0.05),
      n("fluidRadius", "Brush radius (m)", 0.25, 0.15, 1, 0.01),
      n("fluidDrag", "Velocity damping", 0.8, 0.3, 5, 0.1),
      n("fluidReturn", "Shape return (seconds)", 0.5, 0.3, 6, 0.1),
    ],
  },
  {
    label: "Camera",
    controls: [
      { key: "cameraSway", label: "Mouse sway", value: false },
      n("cameraSwayHorizontal", "Horizontal (degrees)", 1.5, 0, 3, 0.1),
      n("cameraSwayVertical", "Vertical (degrees)", 0.6, 0, 1.5, 0.1),
      n("cameraSwaySmoothing", "Settle time (seconds)", 0.4, 0.1, 1.5, 0.05),
    ],
  },
  {
    label: "Motion",
    controls: [
      { key: "motionPaused", label: "Pause motion", value: false },
      n("motionTime", "Time / seek (seconds)", 0, 0, 600, 0.1),
      n("motionSpeed", "Master speed", 1, 0, 3, 0.01),
      n(
        "floatAmount",
        "Float amplitude (m)",
        motionDefaults.floatAmount,
        0,
        0.15,
        0.001,
      ),
      n(
        "floatPeriod",
        "Float period (seconds)",
        motionDefaults.floatPeriod,
        4,
        40,
        0.1,
      ),
      n(
        "swayAmount",
        "Sideways sway (m)",
        motionDefaults.swayAmount,
        0,
        0.08,
        0.001,
      ),
      n(
        "billowStrength",
        "Billow deformation",
        motionDefaults.billowStrength,
        0,
        0.6,
        0.01,
      ),
      n(
        "circulationSpeed",
        "Circulation speed",
        motionDefaults.circulationSpeed,
        0,
        0.6,
        0.01,
      ),
      n(
        "vortexSize",
        "Vortex radius (m)",
        motionDefaults.vortexSize,
        0.3,
        1.5,
        0.01,
      ),
      n(
        "secondaryVortex",
        "Secondary vortex",
        motionDefaults.secondaryVortex,
        0,
        1,
        0.01,
      ),
      n(
        "evolutionSpeed",
        "Internal evolution speed",
        motionDefaults.evolutionSpeed,
        0,
        0.5,
        0.01,
      ),
      n("legacyDrift", "Old sliding noise (comparison)", 0, 0, 1, 0.01),
      n("shadowResponse", "Shadow height response", 1, 0, 3, 0.01),
    ],
  },
];
export const checkpoints = [
  {
    id: "v1",
    label: "v1 · Color + depth",
    values: checkpointV1.values as Tuning,
  },
  {
    id: "v2",
    label: "v2 · November 23",
    values: checkpointV2.values as Tuning,
  },
  {
    id: "v3",
    label: "v3 · November 23",
    values: checkpointV3.values as Tuning,
  },
  {
    id: "v4",
    label: "v4 · November 23",
    values: checkpointV4.values as Tuning,
  },
  {
    id: "v5",
    label: "v5 · Color + motion",
    values: checkpointV5.values as Tuning,
  },
  {
    id: "v6",
    label: "v6 · Fluid interaction",
    values: checkpointV6.values as Tuning,
  },
] as const;
export const latestCheckpoint = "v6";
export const defaultTuning: Tuning = {
  ...motionDefaults,
  ...studioPresentationDefaults,
  ...checkpointV6.values,
};
export const checkpointSelectionKey = "cloud-studio-active-checkpoint-v6";
// Start the newly approved v3 from its snapshot, not a prior v3 draft that
// may contain the subsequent v4 experiment. Keep that older draft untouched.
export const tuningStorageKey = (id: string) =>
  id === "v3"
    ? "cloud-studio-checkpoint-v3-approved"
    : `cloud-studio-checkpoint-${id}`;
export function checkpointValues(id: string): Tuning {
  return {
    ...motionDefaults,
    ...studioPresentationDefaults,
    ...(checkpoints.find((c) => c.id === id)?.values ?? defaultTuning),
  };
}
export function loadCheckpoint(id: string): Tuning {
  const defaults = checkpointValues(id);
  if (process.env.NODE_ENV === "production") return defaults;
  try {
    const stored = JSON.parse(
      localStorage.getItem(tuningStorageKey(id)) || "null",
    );
    const fontMigration = "cloud-studio-v6-work-sans";
    if (id === "v6" && !localStorage.getItem(fontMigration)) {
      if (stored && typeof stored === "object") {
        stored.siteFont = "work";
        localStorage.setItem(tuningStorageKey(id), JSON.stringify(stored));
      }
      localStorage.setItem(fontMigration, "1");
    }
    const speedMinimumMigration = "cloud-studio-v6-speed-minimum-005";
    if (id === "v6" && !localStorage.getItem(speedMinimumMigration)) {
      if (stored && typeof stored === "object") {
        stored.stirThreshold = 0.05;
        localStorage.setItem(tuningStorageKey(id), JSON.stringify(stored));
      }
      localStorage.setItem(speedMinimumMigration, "1");
    }
    // Promote the previously approved value once without erasing other edits.
    const migrationKey = "cloud-studio-v5-billow-045";
    if (id === "v5" && !localStorage.getItem(migrationKey)) {
      if (stored?.billowStrength === 0.3) {
        stored.billowStrength = 0.45;
        localStorage.setItem(tuningStorageKey(id), JSON.stringify(stored));
      }
      localStorage.setItem(migrationKey, "1");
    }
    const cameraMigration = `cloud-studio-${id}-camera-orbit-off`;
    if (!localStorage.getItem(cameraMigration)) {
      if (stored && typeof stored === "object") {
        stored.cameraSway = false;
        localStorage.setItem(tuningStorageKey(id), JSON.stringify(stored));
      }
      localStorage.setItem(cameraMigration, "1");
    }
    const fluidMigration = "cloud-studio-v6-fluid-approved-1";
    if (id === "v6" && !localStorage.getItem(fluidMigration)) {
      if (stored && typeof stored === "object") {
        Object.assign(stored, {
          fluidStrength: 0.55,
          fluidRadius: 0.25,
          fluidDrag: 0.8,
          fluidReturn: 0.5,
        });
        localStorage.setItem(tuningStorageKey(id), JSON.stringify(stored));
      }
      localStorage.setItem(fluidMigration, "1");
    }
    const directionalMigration = `cloud-studio-${id}-directional-28`;
    if (!localStorage.getItem(directionalMigration)) {
      if (stored?.directionalIntensity === 1.6) {
        stored.directionalIntensity = 2.8;
        localStorage.setItem(tuningStorageKey(id), JSON.stringify(stored));
      }
      localStorage.setItem(directionalMigration, "1");
    }
    return validateTuning(stored, defaults);
  } catch {
    return { ...defaults };
  }
}
export function loadCheckpointSelection(): string {
  if (process.env.NODE_ENV === "production") return latestCheckpoint;
  try {
    const id = localStorage.getItem(checkpointSelectionKey);
    return checkpoints.some((c) => c.id === id) ? id! : latestCheckpoint;
  } catch {
    return latestCheckpoint;
  }
}
export function validateTuning(
  input: unknown,
  defaults: Tuning = defaultTuning,
): Tuning {
  const raw = input && typeof input === "object" ? (input as Tuning) : {};
  const source: Tuning = { ...defaults, ...raw };
  return Object.fromEntries(
    tuningGroups.flatMap((g) =>
      g.controls.map((c) => {
        const v = source[c.key];
        const valid =
          typeof v === typeof c.value &&
          (!c.options ||
            c.options.some((option) => option.value === v && !option.disabled));
        return [
          c.key,
          !valid
            ? defaults[c.key]
            : typeof v === "number"
              ? Number.isFinite(v)
                ? Math.min(c.max!, Math.max(c.min!, v))
                : defaults[c.key]
              : typeof v === "string"
                ? c.options || /^#[0-9a-f]{6}$/i.test(v)
                  ? v
                  : defaults[c.key]
                : v,
        ];
      }),
    ),
  );
}
export function tuningLights(t: Tuning) {
  return studio.lights.map((l, i) => ({
    ...l,
    position: ["x", "y", "z"].map((a) => Number(t[`light${i}.position.${a}`])),
    target: ["x", "y", "z"].map((a) => Number(t[`light${i}.target.${a}`])),
    color: String(t[`light${i}.color`]),
    power: t[`light${i}.enabled`] ? Number(t[`light${i}.power`]) : 0,
    outerAngle: Number(t[`light${i}.angle`]),
    innerAngle:
      Number(t[`light${i}.angle`]) * (1 - Number(t[`light${i}.penumbra`])),
    distance: Number(t[`light${i}.distance`]),
    decay: Number(t[`light${i}.decay`]),
  }));
}
export function serializeTuning(values: Tuning, checkpoint = latestCheckpoint) {
  return JSON.stringify(
    {
      schema: "cloud-studio-tuning",
      version: 1,
      basePreset: "Color + depth",
      checkpoint,
      values,
    },
    null,
    2,
  );
}
