// Procedural body mesh: the body is a signed distance field built from ~50 smoothly-blended
// primitives (ellipsoids for muscles, round cones for limbs), sized from a Shape, then turned
// into triangles with Surface Nets. Runs in the browser in well under a second.

import type { Shape } from "./shape";

type V3 = [number, number, number];

const ELL = 0;
const CONE = 1;

// Groups used for the rank-map colouring.
export const GROUP_IDS = ["none", "chest", "back", "shoulders", "arms", "legs", "core"] as const;
export type GroupId = (typeof GROUP_IDS)[number];

type Prim = {
  kind: number;
  d: Float64Array;
  k: number;
  group: number;
  bb: [number, number, number, number, number, number];
};

/* ------------------------------ primitives -------------------------------- */

function rotation(rz: number, rx: number) {
  // R = Rz * Rx ; we store R^T to bring points into the ellipsoid's frame.
  const cz = Math.cos(rz);
  const sz = Math.sin(rz);
  const cx = Math.cos(rx);
  const sx = Math.sin(rx);
  const r = [cz, -sz * cx, sz * sx, sz, cz * cx, -cz * sx, 0, sx, cx];
  return [r[0], r[3], r[6], r[1], r[4], r[7], r[2], r[5], r[8]];
}

function makeEll(c: V3, r: V3, group: number, k: number, rz = 0, rx = 0): Prim {
  const m = rotation(rz, rx);
  const R = Math.max(r[0], r[1], r[2]) + k;
  return {
    kind: ELL,
    d: new Float64Array([c[0], c[1], c[2], r[0], r[1], r[2], ...m]),
    k,
    group,
    bb: [c[0] - R, c[1] - R, c[2] - R, c[0] + R, c[1] + R, c[2] + R],
  };
}

function makeCone(a: V3, b: V3, r1: number, r2: number, group: number, k: number): Prim {
  const ba: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const l2 = ba[0] * ba[0] + ba[1] * ba[1] + ba[2] * ba[2];
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  const R = Math.max(r1, r2) + k;
  return {
    kind: CONE,
    d: new Float64Array([a[0], a[1], a[2], ba[0], ba[1], ba[2], l2, rr, a2, 1 / l2, r1, r2]),
    k,
    group,
    bb: [Math.min(a[0], b[0]) - R, Math.min(a[1], b[1]) - R, Math.min(a[2], b[2]) - R, Math.max(a[0], b[0]) + R, Math.max(a[1], b[1]) + R, Math.max(a[2], b[2]) + R],
  };
}

function evalPrim(p: Prim, x: number, y: number, z: number) {
  const d = p.d;
  if (p.kind === ELL) {
    const px = x - d[0];
    const py = y - d[1];
    const pz = z - d[2];
    const qx = (d[6] * px + d[7] * py + d[8] * pz) / d[3];
    const qy = (d[9] * px + d[10] * py + d[11] * pz) / d[4];
    const qz = (d[12] * px + d[13] * py + d[14] * pz) / d[5];
    const k0 = Math.sqrt(qx * qx + qy * qy + qz * qz);
    const k1 = Math.sqrt((qx * qx) / (d[3] * d[3]) + (qy * qy) / (d[4] * d[4]) + (qz * qz) / (d[5] * d[5]));
    if (k1 < 1e-9) return -Math.min(d[3], d[4], d[5]);
    return (k0 * (k0 - 1)) / k1;
  }
  // Round cone (Inigo Quilez)
  const pax = x - d[0];
  const pay = y - d[1];
  const paz = z - d[2];
  const bax = d[3];
  const bay = d[4];
  const baz = d[5];
  const l2 = d[6];
  const rr = d[7];
  const a2 = d[8];
  const il2 = d[9];
  const yy = pax * bax + pay * bay + paz * baz;
  const zz = yy - l2;
  const qx = pax * l2 - bax * yy;
  const qy = pay * l2 - bay * yy;
  const qz = paz * l2 - baz * yy;
  const x2 = qx * qx + qy * qy + qz * qz;
  const y2 = yy * yy * l2;
  const z2 = zz * zz * l2;
  const kk = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(zz) * a2 * z2 > kk) return Math.sqrt(x2 + z2) * il2 - d[11];
  if (Math.sign(yy) * a2 * y2 < kk) return Math.sqrt(x2 + y2) * il2 - d[10];
  return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - d[10];
}

function smin(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

/* ------------------------------- the body --------------------------------- */

const G = { none: 0, chest: 1, back: 2, shoulders: 3, arms: 4, legs: 5, core: 6 };

/** Lays out the primitives for a shape, in metres (feet at y = 0, facing +z). */
export function bodyPrims(s: Shape): Prim[] {
  const H = s.heightM;
  const m = s.muscle;
  const f = s.fat;
  const P: Prim[] = [];
  const v = (x: number, y: number, z: number): V3 => [x * H, y * H, z * H];
  const ell = (c: V3, r: V3, g: number, k: number, rz = 0, rx = 0) => P.push(makeEll(v(...c), v(...r), g, k * H, rz, rx));
  const cone = (a: V3, b: V3, r1: number, r2: number, g: number, k: number) => P.push(makeCone(v(...a), v(...b), r1 * H, r2 * H, g, k * H));
  const def = 0.01 + 0.014 * Math.min(1, f); // blend radius for muscles: sharper when lean

  // Head, neck, traps
  ell([0, 0.932, 0.004], [0.046, 0.062, 0.056], G.none, 0.02);
  ell([0, 0.886, 0.02], [0.036, 0.03, 0.038], G.none, 0.024);
  cone([0, 0.832, -0.006], [0, 0.9, 0.004], s.neck, s.neck * 0.88, G.none, 0.02);

  // Torso core
  ell([0, 0.712, -0.004], [s.chestW, 0.105, s.chestD], G.chest, 0.03);
  ell([0, 0.728, -s.chestD * 0.34], [s.chestW * 0.9, 0.09, s.chestD * 0.72], G.back, 0.03);
  ell([0, 0.6, 0.002], [s.waistW, 0.1, s.waistD], G.core, 0.04);
  if (s.belly > 0.02) {
    const b = 0.6 + 0.6 * s.belly;
    ell([0, 0.585, s.waistD * 0.35 + 0.012 * s.belly], [s.waistW * 0.8 * b, 0.07 * b, s.waistD * 0.72 * b], G.core, 0.04);
  }
  ell([0, 0.516, -0.004], [s.hipW, 0.068, s.hipD], G.core, 0.04);

  for (const side of [1, -1]) {
    const sx = side;
    // Traps
    cone([0, 0.852, -0.018], [sx * s.shoulder * 0.74, 0.818, -0.014], 0.026 + 0.012 * m, 0.018, G.back, 0.03);
    // Pecs
    if (!s.female || m > 0.3)
      ell([sx * 0.052, 0.74, s.chestD * 0.5], [0.056 + 0.01 * m, 0.034 + 0.007 * m, 0.013 + 0.011 * m], G.chest, def, sx * 0.12);
    if (s.female && s.bust > 0) ell([sx * 0.046, 0.713, s.chestD * 0.7], [0.045, 0.043, 0.03 + 0.024 * s.bust], G.chest, 0.02, sx * 0.18);
    // Lats (V-taper)
    ell([sx * s.chestW * 0.76, 0.69, -0.016], [0.034 + 0.022 * m, 0.085, 0.044 + 0.01 * m], G.back, 0.03, -sx * 0.22);
    // Obliques / love handles
    if (f > 0.4) ell([sx * s.waistW * 0.75, 0.56, 0], [0.03 * f, 0.05, s.waistD * 0.7], G.core, 0.035);
    // Abs
    if (s.abs > 0.05)
      for (const [i, y] of [0.668, 0.632, 0.597].entries())
        ell([sx * 0.021, y, s.waistD * (0.86 - i * 0.02) + 0.006 * s.abs], [0.02, 0.016, 0.008 + 0.006 * s.abs], G.core, 0.008);
    // Glutes
    ell([sx * 0.043, 0.496, -s.hipD * 0.52], [0.05 + 0.008 * m + (s.female ? 0.008 : 0), 0.058, 0.042 + 0.01 * m + 0.012 * f], G.legs, 0.03);

    // Shoulder + arm (A-pose so the arms clear the lats)
    const deltR = 0.033 + 0.014 * m;
    const J: V3 = [sx * (s.shoulder - deltR * 0.95), 0.796, 0];
    ell([sx * (s.shoulder - deltR * 0.82), 0.803, 0], [deltR, deltR * 1.22, deltR * 1.1], G.shoulders, def + 0.006, sx * 0.3);
    const th = 0.2 + 0.1 * m + 0.08 * Math.min(1, f);
    const du: V3 = [sx * Math.sin(th), -Math.cos(th), 0];
    const Lu = 0.17;
    const E: V3 = [J[0] + du[0] * Lu, J[1] + du[1] * Lu, J[2] + du[2] * Lu];
    cone(J, E, s.arm, s.arm * 0.72, G.arms, 0.02);
    const at = (t: number, off: V3): V3 => [J[0] + du[0] * Lu * t + off[0], J[1] + du[1] * Lu * t + off[1], J[2] + du[2] * Lu * t + off[2]];
    ell(at(0.52, [0, 0, s.arm * 0.4]), [s.arm * 0.62, Lu * 0.3, s.arm * 0.64], G.arms, def, sx * th);
    ell(at(0.42, [0, 0, -s.arm * 0.38]), [s.arm * 0.7, Lu * 0.34, s.arm * 0.62], G.arms, def, sx * th);
    const th2 = th * 0.7;
    const df0: V3 = [sx * Math.sin(th2), -Math.cos(th2), 0.08];
    const dl = Math.hypot(...df0);
    const df: V3 = [df0[0] / dl, df0[1] / dl, df0[2] / dl];
    const Lf = 0.148;
    const W: V3 = [E[0] + df[0] * Lf, E[1] + df[1] * Lf, E[2] + df[2] * Lf];
    cone(E, W, s.forearm, 0.0165, G.arms, 0.016);
    ell([E[0] + df[0] * Lf * 0.28, E[1] + df[1] * Lf * 0.28, E[2] + df[2] * Lf * 0.28], [s.forearm * 0.95, Lf * 0.28, s.forearm * 0.88], G.arms, def, sx * th2);
    ell([W[0] + df[0] * 0.046, W[1] + df[1] * 0.046, W[2] + df[2] * 0.046], [0.013, 0.05, 0.026], G.none, 0.012, sx * th2);

    // Leg (slight A-stance so the thighs don't web together)
    const Hj: V3 = [sx * 0.056, 0.478, 0.002];
    const K: V3 = [sx * 0.072, 0.285, 0.01];
    const A: V3 = [sx * 0.08, 0.045, -0.012];
    const lerp3 = (a: V3, b: V3, t: number, off: V3 = [0, 0, 0]): V3 => [a[0] + (b[0] - a[0]) * t + off[0], a[1] + (b[1] - a[1]) * t + off[1], a[2] + (b[2] - a[2]) * t + off[2]];
    cone(Hj, K, s.thigh, 0.032 + 0.004 * m, G.legs, 0.025);
    ell(lerp3(Hj, K, 0.42, [sx * 0.004, 0, s.thigh * 0.36]), [s.thigh * 0.8, 0.085, s.thigh * 0.64], G.legs, def);
    if (m > 0.25) ell(lerp3(Hj, K, 0.8, [-sx * s.thigh * 0.3, 0, s.thigh * 0.24]), [s.thigh * 0.44, 0.04, s.thigh * 0.38], G.legs, def);
    ell(lerp3(Hj, K, 0.45, [0, 0, -s.thigh * 0.34]), [s.thigh * 0.74, 0.09, s.thigh * 0.58], G.legs, def);
    cone(K, A, 0.03 + 0.003 * m, 0.019, G.legs, 0.02);
    ell([K[0], K[1] - 0.072, K[2] - s.calf * 0.4], [s.calf * 0.84, 0.062, s.calf * 0.72], G.legs, def);
    cone([sx * 0.081, 0.026, -0.022], [sx * 0.088, 0.018, 0.105], 0.024, 0.018, G.none, 0.015);
  }
  return P;
}

/* ------------------------------ surface nets ------------------------------ */

export type BodyMesh = {
  positions: Float32Array;
  normals: Float32Array;
  skinColors: Float32Array;
  rankColors: Float32Array;
  indices: Uint32Array;
  volume: number;
  scaleXZ: number;
};

function hexToRgb(hex: string): V3 {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// sRGB → linear (three.js vertex colours are linear)
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

export function buildBodyMesh(shape: Shape, opts: { voxel?: number; targetVolume?: number } = {}): BodyMesh {
  const H = shape.heightM;
  const prims = bodyPrims(shape);
  const h = (opts.voxel ?? 0.0066) * H;
  const x0 = -0.34 * H;
  const y0 = -0.01 * H;
  const z0 = -0.16 * H;
  const nx = Math.ceil((0.68 * H) / h) + 1;
  const ny = Math.ceil((1.03 * H) / h) + 1;
  const nz = Math.ceil((0.34 * H) / h) + 1;

  // Primitives overlapping each y slice (margin keeps the zero surface well inside the boxes).
  const margin = 2 * h;
  const slices: Prim[][] = [];
  for (let j = 0; j < ny; j++) {
    const y = y0 + j * h;
    slices.push(prims.filter((p) => y >= p.bb[1] - margin && y <= p.bb[4] + margin));
  }

  const sdfAt = (x: number, y: number, z: number, list: Prim[]) => {
    let d = 1e9;
    for (let n = 0; n < list.length; n++) {
      const p = list[n];
      const bb = p.bb;
      if (x < bb[0] - margin || x > bb[3] + margin || z < bb[2] - margin || z > bb[5] + margin || y < bb[1] - margin || y > bb[4] + margin) continue;
      d = smin(d, evalPrim(p, x, y, z), p.k);
    }
    return d;
  };
  const sliceFor = (y: number) => slices[Math.max(0, Math.min(ny - 1, Math.round((y - y0) / h)))];
  const sdf = (x: number, y: number, z: number) => sdfAt(x, y, z, sliceFor(y));

  const field = new Float32Array(nx * ny * nz);
  let inside = 0;
  for (let k = 0; k < nz; k++) {
    const z = z0 + k * h;
    for (let j = 0; j < ny; j++) {
      const y = y0 + j * h;
      const list = slices[j].filter((p) => z >= p.bb[2] - margin && z <= p.bb[5] + margin);
      const base = nx * (j + ny * k);
      for (let i = 0; i < nx; i++) {
        const d = list.length ? sdfAt(x0 + i * h, y, z, list) : 1e9;
        field[base + i] = d;
        if (d < 0) inside++;
      }
    }
  }

  const idx = (i: number, j: number, k: number) => i + nx * (j + ny * k);
  const cellVert = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cid = (i: number, j: number, k: number) => i + (nx - 1) * (j + (ny - 1) * k);
  const pos: number[] = [];
  const EDGES = [
    [0, 1], [2, 3], [4, 5], [6, 7],
    [0, 2], [1, 3], [4, 6], [5, 7],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  const cv = new Float64Array(8);
  for (let k = 0; k < nz - 1; k++)
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          const v = field[idx(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1))];
          cv[c] = v;
          if (v < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let sx = 0;
        let sy = 0;
        let sz = 0;
        let cnt = 0;
        for (const [a, b] of EDGES) {
          const va = cv[a];
          const vb = cv[b];
          if (va < 0 === vb < 0) continue;
          const t = va / (va - vb);
          sx += (a & 1) + ((b & 1) - (a & 1)) * t;
          sy += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t;
          sz += ((a >> 2) & 1) + (((b >> 2) & 1) - ((a >> 2) & 1)) * t;
          cnt++;
        }
        cellVert[cid(i, j, k)] = pos.length / 3;
        pos.push(x0 + (i + sx / cnt) * h, y0 + (j + sy / cnt) * h, z0 + (k + sz / cnt) * h);
      }

  const tris: number[] = [];
  for (let k = 0; k < nz - 1; k++)
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const v0 = cellVert[cid(i, j, k)];
        if (v0 < 0) continue;
        const inside0 = field[idx(i, j, k)] < 0;
        // Edges along x, y, z from this cell's minimum corner.
        const axes: [number, number, number, number, number, number, number, number, number, boolean][] = [
          [1, 0, 0, 0, 1, 0, 0, 0, 1, j > 0 && k > 0],
          [0, 1, 0, 0, 0, 1, 1, 0, 0, i > 0 && k > 0],
          [0, 0, 1, 1, 0, 0, 0, 1, 0, i > 0 && j > 0],
        ];
        for (const [ax, ay, az, ux, uy, uz, wx, wy, wz, ok] of axes) {
          if (!ok) continue;
          const inside1 = field[idx(i + ax, j + ay, k + az)] < 0;
          if (inside0 === inside1) continue;
          const c1 = cellVert[cid(i - ux, j - uy, k - uz)];
          const c2 = cellVert[cid(i - ux - wx, j - uy - wy, k - uz - wz)];
          const c3 = cellVert[cid(i - wx, j - wy, k - wz)];
          if (c1 < 0 || c2 < 0 || c3 < 0) continue;
          if (inside0) tris.push(v0, c1, c2, v0, c2, c3);
          else tris.push(v0, c2, c1, v0, c3, c2);
        }
      }

  // Snap vertices onto the surface, then shade from the field's gradient.
  const nv = pos.length / 3;
  const positions = new Float32Array(pos);
  const normals = new Float32Array(nv * 3);
  const skinColors = new Float32Array(nv * 3);
  const rankColors = new Float32Array(nv * 3);
  const e = h * 0.5;
  const skin = hexToRgb(shape.skin).map(lin) as V3;
  const palette = GROUP_IDS.map((g) => hexToRgb(shape.groupColors?.[g as keyof typeof shape.groupColors] ?? (g === "none" ? "#3a3a46" : "#5a5a66")).map(lin) as V3);
  const occ1 = 0.012 * H;
  const occ2 = 0.03 * H;
  const w = new Float64Array(GROUP_IDS.length);
  for (let n = 0; n < nv; n++) {
    let x = positions[n * 3];
    let y = positions[n * 3 + 1];
    let z = positions[n * 3 + 2];
    for (let it = 0; it < 1; it++) {
      const d = sdf(x, y, z);
      const gx = sdf(x + e, y, z) - sdf(x - e, y, z);
      const gy = sdf(x, y + e, z) - sdf(x, y - e, z);
      const gz = sdf(x, y, z + e) - sdf(x, y, z - e);
      const gl = Math.hypot(gx, gy, gz) || 1;
      x -= (d * gx) / gl;
      y -= (d * gy) / gl;
      z -= (d * gz) / gl;
    }
    const gx = sdf(x + e, y, z) - sdf(x - e, y, z);
    const gy = sdf(x, y + e, z) - sdf(x, y - e, z);
    const gz = sdf(x, y, z + e) - sdf(x, y, z - e);
    const gl = Math.hypot(gx, gy, gz) || 1;
    const nx_ = gx / gl;
    const ny_ = gy / gl;
    const nz_ = gz / gl;
    positions.set([x, y, z], n * 3);
    normals.set([nx_, ny_, nz_], n * 3);

    // Cheap ambient occlusion: how far the field really is when stepping out along the normal.
    const ao = Math.max(0, Math.min(1, (sdf(x + nx_ * occ1, y + ny_ * occ1, z + nz_ * occ1) / occ1 + sdf(x + nx_ * occ2, y + ny_ * occ2, z + nz_ * occ2) / occ2) / 2));
    const shade = 0.5 + 0.5 * ao;

    // Which muscle group this point belongs to (soft-assigned by distance).
    w.fill(0);
    const list = sliceFor(y);
    let best = 1e9;
    const ds: number[] = [];
    for (const p of list) {
      const di = evalPrim(p, x, y, z);
      ds.push(di);
      if (di < best) best = di;
    }
    let tot = 0;
    list.forEach((p, i) => {
      const wi = Math.exp(-(ds[i] - best) / (0.006 * H));
      w[p.group] += wi;
      tot += wi;
    });
    let r = 0;
    let g = 0;
    let b = 0;
    for (let q = 0; q < w.length; q++) {
      const t = w[q] / (tot || 1);
      r += palette[q][0] * t;
      g += palette[q][1] * t;
      b += palette[q][2] * t;
    }
    rankColors.set([r * shade, g * shade, b * shade], n * 3);
    skinColors.set([skin[0] * shade, skin[1] * shade, skin[2] * shade], n * 3);
  }

  // Scale girth so the body's volume matches its weight (height stays exact).
  const volume = inside * h * h * h;
  let scaleXZ = 1;
  if (opts.targetVolume && volume > 0) {
    scaleXZ = Math.max(0.85, Math.min(1.2, Math.sqrt(opts.targetVolume / volume)));
    for (let n = 0; n < nv; n++) {
      positions[n * 3] *= scaleXZ;
      positions[n * 3 + 2] *= scaleXZ;
      const a = normals[n * 3] / scaleXZ;
      const b2 = normals[n * 3 + 1];
      const c = normals[n * 3 + 2] / scaleXZ;
      const l = Math.hypot(a, b2, c) || 1;
      normals.set([a / l, b2 / l, c / l], n * 3);
    }
  }

  return { positions, normals, skinColors, rankColors, indices: new Uint32Array(tris), volume, scaleXZ };
}

/** Body volume (m³) from weight and body fat, via Siri's density equation. */
export function targetVolume(weightKg: number, bodyFat: number) {
  const density = 495 / (bodyFat * 100 + 450); // g/cm³
  return weightKg / (density * 1000);
}
