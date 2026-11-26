import {
  Data3DTexture,
  DataUtils,
  HalfFloatType,
  LinearFilter,
  RGBAFormat,
  type Vector3,
} from "three";

// Small Eulerian grid: advect velocity, project pressure, then transport the
// inverse displacement map. The procedural cloud remains the density source.
export function createFluidField() {
  const nx = 20,
    ny = 12,
    nz = 16,
    count = nx * ny * nz;
  const bounds = [2.05, 1.2, 1.55],
    h = bounds.map((b, i) => (2 * b) / ([nx, ny, nz][i] - 1));
  let velocity = new Float32Array(count * 3),
    next = new Float32Array(count * 3);
  let displacement = new Float32Array(count * 3),
    warped = new Float32Array(count * 3);
  let pressure = new Float32Array(count),
    scratch = new Float32Array(count);
  const divergence = new Float32Array(count),
    pixels = new Uint16Array(count * 4);
  const texture = new Data3DTexture(pixels, nx, ny, nz);
  texture.format = RGBAFormat;
  texture.type = HalfFloatType;
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  let active = false,
    accumulator = 0;
  const index = (x: number, y: number, z: number) => x + nx * (y + ny * z);
  const sample = (
    field: Float32Array,
    x: number,
    y: number,
    z: number,
    c: number,
  ) => {
    x = Math.max(0, Math.min(nx - 1.001, x));
    y = Math.max(0, Math.min(ny - 1.001, y));
    z = Math.max(0, Math.min(nz - 1.001, z));
    const ix = Math.floor(x),
      iy = Math.floor(y),
      iz = Math.floor(z),
      fx = x - ix,
      fy = y - iy,
      fz = z - iz;
    const i = index(ix, iy, iz) * 3 + c,
      row = nx * 3,
      layer = nx * ny * 3;
    const a =
      (field[i] * (1 - fx) + field[i + 3] * fx) * (1 - fy) +
      (field[i + row] * (1 - fx) + field[i + row + 3] * fx) * fy;
    const b =
      (field[i + layer] * (1 - fx) + field[i + layer + 3] * fx) * (1 - fy) +
      (field[i + layer + row] * (1 - fx) + field[i + layer + row + 3] * fx) *
        fy;
    return a * (1 - fz) + b * fz;
  };
  function reset() {
    if (!active) return;
    velocity.fill(0);
    displacement.fill(0);
    pixels.fill(0);
    texture.needsUpdate = true;
    active = false;
    accumulator = 0;
  }
  function impulse(
    a: Vector3,
    b: Vector3,
    axis: Vector3,
    radius: number,
    strength: number,
  ) {
    const dx = b.x - a.x,
      dy = b.y - a.y,
      dz = b.z - a.z,
      length = Math.hypot(dx, dy, dz);
    if (length < 1e-6) return;
    const along = dx * axis.x + dy * axis.y + dz * axis.z;
    const sx = dx - axis.x * along,
      sy = dy - axis.y * along,
      sz = dz - axis.z * along,
      den = sx * sx + sy * sy + sz * sz;
    for (let z = 1; z < nz - 1; z++)
      for (let y = 1; y < ny - 1; y++)
        for (let x = 1; x < nx - 1; x++) {
          let rx = x * h[0] - bounds[0] - a.x,
            ry = y * h[1] - bounds[1] - a.y,
            rz = z * h[2] - bounds[2] - a.z;
          const depth = rx * axis.x + ry * axis.y + rz * axis.z;
          rx -= axis.x * depth;
          ry -= axis.y * depth;
          rz -= axis.z * depth;
          const t = Math.max(
            0,
            Math.min(1, (rx * sx + ry * sy + rz * sz) / Math.max(den, 1e-8)),
          );
          rx -= sx * t;
          ry -= sy * t;
          rz -= sz * t;
          const distance = Math.hypot(rx, ry, rz),
            weight = Math.exp((-distance * distance) / (radius * radius));
          if (weight < 0.002) continue;
          const gain = weight * Math.min(length, 1.5) * strength * 3,
            i = index(x, y, z) * 3;
          const radial = 0.65 / Math.max(distance, 0.08);
          velocity[i] += gain * ((dx / length) * 0.65 + rx * radial);
          velocity[i + 1] += gain * ((dy / length) * 0.65 + ry * radial);
          velocity[i + 2] += gain * ((dz / length) * 0.65 + rz * radial);
          const speed = Math.hypot(
            velocity[i],
            velocity[i + 1],
            velocity[i + 2],
          );
          if (speed > 5)
            for (let c = 0; c < 3; c++) velocity[i + c] *= 5 / speed;
        }
    active = true;
  }
  function step(dt: number, drag: number, returnTime: number) {
    next.fill(0);
    for (let z = 1; z < nz - 1; z++)
      for (let y = 1; y < ny - 1; y++)
        for (let x = 1; x < nx - 1; x++) {
          const i = index(x, y, z) * 3;
          const bx = x - (dt * velocity[i]) / h[0],
            by = y - (dt * velocity[i + 1]) / h[1],
            bz = z - (dt * velocity[i + 2]) / h[2];
          for (let c = 0; c < 3; c++)
            next[i + c] =
              sample(velocity, bx, by, bz, c) * Math.exp(-drag * dt);
        }
    [velocity, next] = [next, velocity];
    divergence.fill(0);
    pressure.fill(0);
    const offsets = [1, nx, nx * ny],
      weights = h.map((v) => 1 / (v * v)),
      denom = 2 * weights.reduce((a, b) => a + b, 0);
    for (let z = 1; z < nz - 1; z++)
      for (let y = 1; y < ny - 1; y++)
        for (let x = 1; x < nx - 1; x++) {
          const i = index(x, y, z);
          for (let c = 0; c < 3; c++)
            divergence[i] +=
              (velocity[(i + offsets[c]) * 3 + c] -
                velocity[(i - offsets[c]) * 3 + c]) /
              (2 * h[c]);
        }
    // Approximate incompressibility spreads the impulse beyond the cursor.
    for (let iteration = 0; iteration < 12; iteration++) {
      scratch.fill(0);
      for (let z = 1; z < nz - 1; z++)
        for (let y = 1; y < ny - 1; y++)
          for (let x = 1; x < nx - 1; x++) {
            const i = index(x, y, z);
            let sum = 0;
            for (let c = 0; c < 3; c++)
              sum +=
                (pressure[i + offsets[c]] + pressure[i - offsets[c]]) *
                weights[c];
            scratch[i] = (sum - divergence[i]) / denom;
          }
      [pressure, scratch] = [scratch, pressure];
    }
    for (let z = 1; z < nz - 1; z++)
      for (let y = 1; y < ny - 1; y++)
        for (let x = 1; x < nx - 1; x++) {
          const i = index(x, y, z);
          for (let c = 0; c < 3; c++)
            velocity[i * 3 + c] -=
              (pressure[i + offsets[c]] - pressure[i - offsets[c]]) /
              (2 * h[c]);
        }
    warped.fill(0);
    let peak = 0;
    for (let z = 1; z < nz - 1; z++)
      for (let y = 1; y < ny - 1; y++)
        for (let x = 1; x < nx - 1; x++) {
          const i = index(x, y, z) * 3;
          const bx = x - (dt * velocity[i]) / h[0],
            by = y - (dt * velocity[i + 1]) / h[1],
            bz = z - (dt * velocity[i + 2]) / h[2];
          for (let c = 0; c < 3; c++) {
            const value =
              (sample(displacement, bx, by, bz, c) + dt * velocity[i + c]) *
              Math.exp(-dt / returnTime);
            warped[i + c] = Math.max(-0.7, Math.min(0.7, value));
            peak = Math.max(
              peak,
              Math.abs(warped[i + c]),
              Math.abs(velocity[i + c]),
            );
          }
        }
    [displacement, warped] = [warped, displacement];
    if (peak < 0.001) {
      reset();
      return;
    }
  }
  return {
    texture,
    impulse,
    reset,
    get active() {
      return active;
    },
    update(delta: number, drag: number, returnTime: number) {
      if (!active) return;
      accumulator += Math.min(delta, 0.0667);
      while (accumulator >= 1 / 30) {
        step(1 / 30, drag, returnTime);
        accumulator = Math.max(0, accumulator - 1 / 30);
        if (!active) break;
      }
      if (!active) return;
      // Render the fractional step immediately instead of holding the texture
      // until the next 30 Hz pressure solve. Bounded velocity extrapolation
      // adds no extra solver pass and does not alter the persistent field.
      const relax = Math.exp(-accumulator / returnTime);
      for (let i = 0; i < count; i++) {
        for (let c = 0; c < 3; c++) {
          const value =
            (displacement[i * 3 + c] + accumulator * velocity[i * 3 + c]) *
            relax;
          pixels[i * 4 + c] = DataUtils.toHalfFloat(
            Math.max(-0.7, Math.min(0.7, value)),
          );
        }
      }
      texture.needsUpdate = true;
    },
    dispose() {
      texture.dispose();
    },
  };
}
