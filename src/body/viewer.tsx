"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { BodyMesh } from "./mesh";

export type ViewMode = "skin" | "rank" | "holo";

const HOLO_VERT = `
varying vec3 vN;
varying vec3 vV;
varying float vY;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  vY = position.y;
  gl_Position = projectionMatrix * mv;
}`;

const HOLO_FRAG = `
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uRim;
varying vec3 vN;
varying vec3 vV;
varying float vY;
void main() {
  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
  float scan = smoothstep(0.0, 0.9, sin(vY * 140.0 - uTime * 3.0) * 0.5 + 0.5) * 0.35;
  float sweep = smoothstep(0.06, 0.0, abs(fract(uTime * 0.18) * 2.2 - 0.1 - vY));
  vec3 col = mix(uColor * 0.25, uRim, f) + uColor * scan * 0.4 + uRim * sweep * 0.9;
  float a = clamp(0.12 + f * 0.95 + scan * 0.2 + sweep, 0.0, 1.0);
  gl_FragColor = vec4(col, a);
}`;

function makeGeometry(m: BodyMesh, mode: ViewMode) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(m.positions, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(m.normals, 3));
  g.setAttribute("color", new THREE.BufferAttribute(mode === "rank" ? m.rankColors : m.skinColors, 3));
  g.setIndex(new THREE.BufferAttribute(m.indices, 1));
  g.computeBoundingBox();
  return g;
}

function padTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(128, 128, 10, 128, 128, 128);
  g.addColorStop(0, "rgba(200,255,46,0.35)");
  g.addColorStop(0.55, "rgba(46,230,255,0.12)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  x.strokeStyle = "rgba(200,255,46,0.35)";
  x.lineWidth = 1.5;
  for (let r = 30; r < 128; r += 22) {
    x.beginPath();
    x.arc(128, 128, r, 0, Math.PI * 2);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Spinning 3D body. `models` are shown side by side (e.g. now vs future).
 */
export function BodyViewer({ models, mode, scanning, className }: { models: BodyMesh[]; mode: ViewMode; scanning?: boolean; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{
    setModels: (m: BodyMesh[], mode: ViewMode) => void;
    setScanning: (s: boolean) => void;
  } | null>(null);

  useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "pan-y";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.enableDamping = true;
    controls.autoRotate = false;
    controls.minPolarAngle = Math.PI * 0.2;
    controls.maxPolarAngle = Math.PI * 0.62;

    scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x0b0b10, 0.75));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(1.6, 3, 2.6);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffe6d0, 0.6);
    fill.position.set(-2, 1, 2);
    scene.add(fill);
    const rimL = new THREE.DirectionalLight(0xc8ff2e, 2.4);
    rimL.position.set(-2.6, 2.2, -2.2);
    scene.add(rimL);
    const rimR = new THREE.DirectionalLight(0x2ee6ff, 2.2);
    rimR.position.set(2.6, 1.6, -2.4);
    scene.add(rimR);

    // Scanner pad
    const pad = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.62, 64), new THREE.MeshBasicMaterial({ map: padTexture(), transparent: true, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2;
    pad.add(disc);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.56, 0.585, 96), new THREE.MeshBasicMaterial({ color: 0xc8ff2e, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.002;
    pad.add(ring);
    const dashes = new THREE.Group();
    for (let i = 0; i < 24; i++) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.012), new THREE.MeshBasicMaterial({ color: 0x2ee6ff, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
      const a = (i / 24) * Math.PI * 2;
      d.position.set(Math.cos(a) * 0.66, 0.003, Math.sin(a) * 0.66);
      d.rotation.set(-Math.PI / 2, 0, -a);
      dashes.add(d);
    }
    pad.add(dashes);
    scene.add(pad);

    // Scan beam
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.62, 0.012, 64, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xc8ff2e, transparent: true, opacity: 0.85, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    beam.visible = false;
    scene.add(beam);

    const bodies = new THREE.Group();
    scene.add(bodies);
    const holoUniforms = { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x2ee6ff) }, uRim: { value: new THREE.Color(0xc8ff2e) } };
    let height = 1.8;
    let scanningNow = false;
    let spin = 0;

    const frame = (count: number) => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      camera.aspect = w / h;
      const needH = height * 1.12;
      const needW = count > 1 ? height * 0.95 : height * 0.55;
      const distH = needH / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const distW = needW / 2 / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
      const dist = Math.max(distH, distW);
      const target = new THREE.Vector3(0, height * 0.5, 0);
      const dir = camera.position.clone().sub(controls.target);
      if (dir.lengthSq() < 1e-6) dir.set(0, 0.12, 1);
      camera.position.copy(target).add(dir.normalize().multiplyScalar(dist));
      controls.target.copy(target);
      controls.minDistance = dist * 0.45;
      controls.maxDistance = dist * 1.6;
      camera.updateProjectionMatrix();
    };

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      frame(bodies.children.length || 1);
    };

    const disposeBodies = () => {
      bodies.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | undefined;
        if (mat) mat.dispose();
      });
      bodies.clear();
    };

    api.current = {
      setModels(ms, mode) {
        disposeBodies();
        height = 1.7;
        ms.forEach((m, i) => {
          const geo = makeGeometry(m, mode);
          height = Math.max(height, geo.boundingBox!.max.y);
          let obj: THREE.Object3D;
          if (mode === "holo") {
            const g = new THREE.Group();
            g.add(
              new THREE.Mesh(
                geo,
                new THREE.ShaderMaterial({
                  vertexShader: HOLO_VERT,
                  fragmentShader: HOLO_FRAG,
                  uniforms: holoUniforms,
                  transparent: true,
                  depthWrite: false,
                  blending: THREE.AdditiveBlending,
                  side: THREE.DoubleSide,
                }),
              ),
            );
            g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x2ee6ff, wireframe: true, transparent: true, opacity: 0.07, depthWrite: false })));
            obj = g;
          } else {
            obj = new THREE.Mesh(
              geo,
              new THREE.MeshStandardMaterial({
                vertexColors: true,
                roughness: mode === "rank" ? 0.38 : 0.55,
                metalness: mode === "rank" ? 0.25 : 0.02,
                side: THREE.DoubleSide,
              }),
            );
          }
          if (ms.length > 1) obj.position.x = (i === 0 ? -1 : 1) * 0.36 * height;
          bodies.add(obj);
        });
        pad.scale.setScalar(ms.length > 1 ? 1.75 : 1);
        frame(ms.length || 1);
      },
      setScanning(s) {
        scanningNow = s;
        beam.visible = s;
      },
    };

    let raf = 0;
    let visible = true;
    const clock = new THREE.Clock();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visible) return;
      const t = clock.getElapsedTime();
      holoUniforms.uTime.value = t;
      dashes.rotation.y = -t * 0.35;
      // Each body spins on its own axis (the camera stays put) so side-by-side models stay the same size.
      for (const o of bodies.children) o.rotation.y = t * 0.55 + spin;
      if (scanningNow) {
        beam.position.y = (Math.sin(t * 2.2) * 0.5 + 0.5) * height;
        beam.scale.setScalar(pad.scale.x);
      }
      controls.update();
      renderer.render(scene, camera);
    };
    loop();

    const ro = new ResizeObserver(resize);
    ro.observe(el);
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(el);
    resize();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      controls.dispose();
      disposeBodies();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const mat = mesh.material as THREE.MeshBasicMaterial | undefined;
        mat?.map?.dispose();
        mat?.dispose?.();
      });
      renderer.dispose();
      renderer.domElement.remove();
      api.current = null;
    };
  }, []);

  useEffect(() => {
    api.current?.setModels(models, mode);
  }, [models, mode]);

  useEffect(() => {
    api.current?.setScanning(!!scanning);
  }, [scanning]);

  return <div ref={host} className={className} />;
}
