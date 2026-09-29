"use client";
// On-device photo analysis: MediaPipe finds the body's joints and silhouette, then we measure
// silhouette widths at the shoulders, chest, waist, hips, thigh, arm and calf. The photo never
// leaves the phone — only these ratios are saved.

import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import type { PhotoMetrics } from "@/shared/physique";

const VERSION = "1.0.1";
const MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task";

let loader: Promise<PoseLandmarker> | null = null;

function landmarker() {
  loader ??= (async () => {
    const vision = await import("@mediapipe/tasks-vision");
    const files = await vision.FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`);
    const opts = (delegate: "GPU" | "CPU") => ({
      baseOptions: { modelAssetPath: MODEL, delegate },
      runningMode: "IMAGE" as const,
      numPoses: 1,
      outputSegmentationMasks: true,
    });
    try {
      return await vision.PoseLandmarker.createFromOptions(files, opts("GPU"));
    } catch {
      return vision.PoseLandmarker.createFromOptions(files, opts("CPU"));
    }
  })().catch((e) => {
    loader = null;
    throw e;
  });
  return loader;
}

/** Start downloading the model early (e.g. when the scan sheet opens). */
export function preloadAnalyzer() {
  landmarker().catch(() => {});
}

export type Line = { y: number; x0: number; x1: number; label: string };
export type Analysis = {
  metrics: PhotoMetrics;
  skin: string;
  confidence: number;
  warnings: string[];
  overlay: { width: number; height: number; points: [number, number][]; lines: Line[]; top: number; bottom: number; mask: Uint8ClampedArray };
};

export async function loadImage(file: File): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function analyzePhoto(canvas: HTMLCanvasElement): Promise<Analysis> {
  const lm = await landmarker();
  let landmarks: { x: number; y: number; visibility?: number }[] | null = null;
  let mask: Float32Array | null = null;
  let mw = 0;
  let mh = 0;
  lm.detect(canvas, (res) => {
    landmarks = res.landmarks[0] ?? null;
    const m = res.segmentationMasks?.[0];
    if (m) {
      mask = m.getAsFloat32Array().slice();
      mw = m.width;
      mh = m.height;
    }
  });
  if (!landmarks || !mask) throw new Error("No body found. Use a full-length, front-facing photo.");
  const L = landmarks as { x: number; y: number; visibility?: number }[];
  const M = mask as Float32Array;
  const W = mw;
  const Hh = mh;
  const px = (i: number): [number, number] => [L[i].x * W, L[i].y * Hh];
  const vis = (i: number) => L[i].visibility ?? 1;
  const warnings: string[] = [];
  let confidence = 1;

  const on = (x: number, y: number) => {
    const xi = Math.round(x);
    const yi = Math.round(y);
    return xi >= 0 && yi >= 0 && xi < W && yi < Hh && M[yi * W + xi] > 0.5;
  };
  /** Width of the silhouette run that contains x on row y (searching a little sideways if x is off). */
  const run = (y: number, x: number): [number, number] | null => {
    let cx = Math.round(x);
    if (!on(cx, y)) {
      let found = -1;
      for (let d = 1; d < W * 0.04; d++) {
        if (on(cx + d, y)) { found = cx + d; break; }
        if (on(cx - d, y)) { found = cx - d; break; }
      }
      if (found < 0) return null;
      cx = found;
    }
    let a = cx;
    let b = cx;
    while (a > 0 && on(a - 1, y)) a--;
    while (b < W - 1 && on(b + 1, y)) b++;
    return [a, b];
  };

  const [lsx, lsy] = px(11);
  const [rsx, rsy] = px(12);
  const [lhx, lhy] = px(23);
  const [rhx, rhy] = px(24);
  const [lkx, lky] = px(25);
  const [, rky] = px(26);
  const [lax, lay] = px(27);
  const [, ray] = px(28);
  const shY = (lsy + rsy) / 2;
  const hipY = (lhy + rhy) / 2;
  const kneeY = (lky + rky) / 2;
  const ankleY = (lay + ray) / 2;
  const cx = (lsx + rsx + lhx + rhx) / 4;

  if ([11, 12, 23, 24, 25, 26, 27, 28].some((i) => vis(i) < 0.5)) {
    warnings.push("Some joints are hidden — stand so your whole body is visible.");
    confidence -= 0.3;
  }

  // Head top: first silhouette row above the nose.
  const [nx, ny] = px(0);
  let top = ny;
  for (let y = Math.round(ny); y >= 0; y--) {
    let any = false;
    for (let dx = -W * 0.02; dx <= W * 0.02; dx += 2) if (on(nx + dx, y)) { any = true; break; }
    if (!any) break;
    top = y;
  }
  const feet = [29, 30, 31, 32].filter((i) => vis(i) > 0.3).map((i) => px(i)[1]);
  const bottom = feet.length ? Math.max(...feet) : ankleY + (ankleY - kneeY) * 0.12;
  const bodyH = bottom - top;
  if (bodyH < Hh * 0.45) {
    warnings.push("You're small in the frame — step closer or crop the photo.");
    confidence -= 0.2;
  }
  if (Math.abs(lsx - rsx) < bodyH * 0.12) {
    warnings.push("Face the camera straight on for accurate widths.");
    confidence -= 0.3;
  }

  const lines: Line[] = [];
  const widthAt = (y: number, x: number, label: string) => {
    const r = run(y, x);
    if (!r) return 0;
    lines.push({ y, x0: r[0], x1: r[1], label });
    return (r[1] - r[0]) / bodyH;
  };
  const torso = hipY - shY;
  const jointShoulder = Math.abs(lsx - rsx) / bodyH;

  let shoulder = widthAt(shY + bodyH * 0.02, cx, "Shoulders");
  if (!shoulder || shoulder > jointShoulder * 1.55) shoulder = jointShoulder * 1.3;

  let chest = widthAt(shY + torso * 0.3, cx, "Chest");
  if (!chest || chest > shoulder * 0.98) {
    chest = shoulder * 0.84;
    warnings.push("Arms were touching your sides — hold them out a little for better accuracy.");
    confidence -= 0.15;
  }

  // Narrowest point between the ribs and hips.
  let waist = Infinity;
  let waistY = shY + torso * 0.7;
  for (let t = 0.5; t <= 0.95; t += 0.025) {
    const y = shY + torso * t;
    const r = run(y, cx);
    if (r && r[1] - r[0] < waist) {
      waist = r[1] - r[0];
      waistY = y;
    }
  }
  waist = isFinite(waist) ? widthAt(waistY, cx, "Waist") : 0;

  let hip = 0;
  let hipLine: Line | null = null;
  for (let t = -0.05; t <= 0.18; t += 0.025) {
    const y = hipY + (t < 0 ? torso : kneeY - hipY) * t;
    const r = run(y, cx);
    if (r && (r[1] - r[0]) / bodyH > hip) {
      hip = (r[1] - r[0]) / bodyH;
      hipLine = { y, x0: r[0], x1: r[1], label: "Hips" };
    }
  }
  if (hipLine) lines.push(hipLine);
  if (waist && hip && waist > hip * 1.05) {
    warnings.push("Hands may be merging with your waist — keep arms away from your body.");
    confidence -= 0.15;
  }

  const thighT = 0.35;
  const thigh = widthAt(hipY + (kneeY - hipY) * thighT, lhx + (lkx - lhx) * thighT, "Thigh");
  const calf = widthAt(kneeY + (ankleY - kneeY) * 0.3, lkx + (lax - lkx) * 0.3, "Calf");
  const [lex, ley] = px(13);
  const armMidX = (lsx + lex) / 2;
  const armMidY = (lsy + ley) / 2;
  const armAngle = Math.atan2(Math.abs(lex - lsx), Math.abs(ley - lsy));
  const armRaw = widthAt(armMidY, armMidX, "Arm");
  const arm = armRaw ? armRaw * Math.cos(armAngle) : 0;

  const clampR = (v: number, lo: number, hi: number, name: string) => {
    if (!v) return undefined;
    if (v < lo || v > hi) {
      confidence -= 0.1;
      warnings.push(`${name} measurement looked off, so it was adjusted.`);
    }
    return Math.min(hi, Math.max(lo, v));
  };
  const metrics: PhotoMetrics = {
    shoulder: clampR(shoulder, 0.17, 0.36, "Shoulder") ?? 0.25,
    chest: clampR(chest, 0.13, 0.3, "Chest") ?? 0.2,
    waist: clampR(waist, 0.1, 0.3, "Waist") ?? 0.17,
    hip: clampR(hip, 0.13, 0.32, "Hip") ?? 0.2,
    thigh: clampR(thigh, 0.05, 0.17, "Thigh"),
    arm: clampR(arm, 0.025, 0.1, "Arm"),
    calf: clampR(calf, 0.035, 0.1, "Calf"),
  };

  // Skin tone: median colour of the face area.
  const ctx = canvas.getContext("2d")!;
  const sx = W / canvas.width;
  const r0 = Math.max(4, bodyH * 0.02);
  const img = ctx.getImageData(Math.max(0, nx / sx - r0), Math.max(0, ny / sx - r0), r0 * 2, r0 * 2).data;
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  for (let i = 0; i < img.length; i += 4) {
    const lum = img[i] * 0.3 + img[i + 1] * 0.59 + img[i + 2] * 0.11;
    if (lum < 25 || lum > 245) continue;
    rs.push(img[i]);
    gs.push(img[i + 1]);
    bs.push(img[i + 2]);
  }
  const med = (a: number[]) => (a.length ? a.sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0);
  const skin = rs.length > 10 ? `#${[med(rs), med(gs), med(bs)].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}` : "#c68863";

  // Overlay data (mask as an alpha channel at mask resolution).
  const alpha = new Uint8ClampedArray(W * Hh);
  for (let i = 0; i < M.length; i++) alpha[i] = M[i] > 0.5 ? 255 : 0;
  const idxs = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
  return {
    metrics,
    skin,
    confidence: Math.max(0.1, confidence),
    warnings: [...new Set(warnings)],
    overlay: { width: W, height: Hh, points: idxs.map(px), lines, top, bottom, mask: alpha },
  };
}

/** Draws the photo with the silhouette, joints and measurement lines on top. */
export function drawOverlay(target: HTMLCanvasElement, photo: HTMLCanvasElement, a: Analysis) {
  const { width: W, height: H } = a.overlay;
  target.width = W;
  target.height = H;
  const ctx = target.getContext("2d")!;
  ctx.drawImage(photo, 0, 0, W, H);
  ctx.fillStyle = "rgba(6,6,8,0.55)";
  ctx.fillRect(0, 0, W, H);
  const m = ctx.createImageData(W, H);
  for (let i = 0; i < a.overlay.mask.length; i++) {
    if (!a.overlay.mask[i]) continue;
    m.data[i * 4] = 200;
    m.data[i * 4 + 1] = 255;
    m.data[i * 4 + 2] = 46;
    m.data[i * 4 + 3] = 70;
  }
  const tmp = document.createElement("canvas");
  tmp.width = W;
  tmp.height = H;
  tmp.getContext("2d")!.putImageData(m, 0, 0);
  ctx.drawImage(tmp, 0, 0);
  ctx.lineWidth = Math.max(2, W / 250);
  ctx.font = `bold ${Math.max(12, W / 32)}px system-ui, sans-serif`;
  for (const l of a.overlay.lines) {
    ctx.strokeStyle = "#2ee6ff";
    ctx.beginPath();
    ctx.moveTo(l.x0, l.y);
    ctx.lineTo(l.x1, l.y);
    ctx.stroke();
    ctx.fillStyle = "#2ee6ff";
    ctx.fillText(l.label, l.x1 + 6, l.y + 4);
  }
  ctx.fillStyle = "#c8ff2e";
  for (const [x, y] of a.overlay.points) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(3, W / 160), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(200,255,46,0.7)";
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(W * 0.08, a.overlay.top);
  ctx.lineTo(W * 0.92, a.overlay.top);
  ctx.moveTo(W * 0.08, a.overlay.bottom);
  ctx.lineTo(W * 0.92, a.overlay.bottom);
  ctx.stroke();
  ctx.setLineDash([]);
}
