export const labPresets = [
  {
    label: "Current",
    description:
      "The existing density, colored lighting, and artistic grading.",
  },
  {
    label: "Simple display",
    description:
      "Same density and lights; only the custom color grading is replaced with Reinhard tone mapping.",
  },
  {
    label: "Neutral light",
    description:
      "Current density under one white light, consistent extinction, modest ambient, and no bounce or color tricks.",
  },
  {
    label: "No filled core",
    description:
      "Same neutral setup; only the protected interior core is removed.",
  },
  {
    label: "Procedural baseline",
    description:
      "Same neutral setup; noise in a simple rounded volume, with no silhouette mask, filled core, or density plateau.",
  },
  {
    label: "Simple · brighter lights",
    description:
      "Simple display with both spotlights at 2× intensity. Density, ambient, bounce, light positions, and tone mapping are unchanged.",
  },
  {
    label: "Brighter · more ambient",
    description:
      "Brighter lights with ambient doubled from 0.4 to 0.8; everything else matches Simple · brighter lights.",
  },
  {
    label: "Internal lights",
    description:
      "Two embedded cyan/pink emitters in the existing density. Additive isotropic single scattering, ambient 0.06, consistent extinction, no fake bounce, and simple display. Not a hollow cotton-shell simulation.",
  },
  {
    label: "Brighter · low ambient",
    description:
      "Same doubled spotlights as Simple · brighter lights, with ambient reduced from 0.4 to 0.05. Everything else is unchanged.",
  },
  {
    label: "Low ambient · blue inside",
    description:
      "Low-ambient baseline with only blue moved inside and emitting in all directions. Pink stays outside. Intensities, bounce, scattering, color separation, and display are unchanged.",
  },
  {
    label: "Blue inside · aimed",
    description:
      "Internal blue spotlight aimed upward/right, at 40% of the previous internal blue intensity. Pink, low ambient, density, and simple display are unchanged.",
  },
  {
    label: "Aimed · midtone lift",
    description:
      "Same aimed internal blue setup, plus a gentle RGB-ratio-preserving midtone lift that tapers off near highlights. No bloom.",
  },
  {
    label: "Aimed · bloom",
    description:
      "Same aimed internal blue setup, plus a small thresholded highlight bloom. The base render stays sharp; no midtone lift.",
  },
  {
    label: "Low ambient · 0.01",
    description:
      "Approved brighter/low-ambient baseline with only ambient reduced from 0.05 to 0.01. Same lights, bounce, and simple display.",
  },
  {
    label: "Low ambient · less bounce",
    description:
      "Approved baseline with only approximate bounce reduced from 0.48 to 0.16. Ambient stays 0.05; same light positions, intensities, and display.",
  },
  {
    label: "Low ambient · grazing",
    description:
      "Approved baseline with both external lights moved more sideways and aimed at the same targets. Intensity compensates only for distance changes; ambient 0.05 and bounce 0.48 remain unchanged.",
  },
  {
    label: "More light",
    description:
      "Ambient 0.01 with both external spotlights doubled again. Same positions, scattering, and Reinhard display as Low ambient · 0.01.",
  },
  {
    label: "Filmic display",
    description:
      "Same lighting and ambient 0.01 as Low ambient · 0.01; only the cloud’s display curve changes to a simple filmic fit. The floor and fixtures are unaffected. No saturation boost or bloom.",
  },
  {
    label: "More light · 4×",
    description:
      "Two more doublings of More light: 4× its spotlight power. Ambient stays 0.01; same positions, scattering, and Reinhard display.",
  },
  {
    label: "More light · 8×",
    description:
      "Three more doublings of More light: 8× its spotlight power. Ambient stays 0.01; same positions, scattering, and Reinhard display.",
  },
  {
    label: "More light · 32×",
    description:
      "Five more doublings of More light: 32× its spotlight power. Ambient stays 0.01; same positions, scattering, and Reinhard display. An intentionally extreme comparison.",
  },
  {
    label: "More light + Filmic",
    description:
      "Original More light intensity combined with Filmic on the cloud only. Twice the light power of Filmic display, ambient 0.01, and a tighter color crossover (0.035 instead of 0.08). Same positions, density, and scattering.",
  },
  {
    label: "Filmic · balanced",
    description:
      "Halfway between Filmic display and More light + Filmic: light power 3× studio defaults, color crossover 0.0575, ambient 0.01. Same cloud-only Filmic curve, positions, and scattering.",
  },
  {
    label: "Interlocking color",
    description:
      "Balanced lighting with broad 3D variations in light visibility, letting blue and pink interlock. This artistic adjustment attenuates competing light without adding energy.",
  },
  {
    label: "Rounder depth",
    description:
      "Balanced lighting with shorter depth in thin sections and gentler depth offsets. Same front mask and procedural surface noise.",
  },
  {
    label: "Color + depth",
    description:
      "Both experiments together: interlocking light colors and rounder depth, on the approved balanced lighting baseline.",
  },
] as const;

export const activeLabPresets = [22, 23, 24, 25];

// Approved scene shared by the studio and the initial lab selection.
export const approvedCloudPreset = 25;
