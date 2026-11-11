import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { DeviceKind } from "@/lib/customization/style";
import { frameFor, hardwareFor, sizedFrame, type FrameGeometry, type ModuleShape } from "@/lib/device-frames";
import { aspectOf, KIND_DEFAULTS, type BodyMaterial, type Device3DParams } from "@/lib/device-3d";

/**
 * Imperative three.js scene for one device (loaded on demand by `Device3D`, never on the server).
 * The body is generated from the 2D frame family: an extruded rounded slab, raised camera modules, lenses and
 * flash. The back and front faces are textured with the same SVG the 2D `DevicePreview` draws, so the skin,
 * text and artwork match the flat preview exactly. An uploaded .glb replaces the generated body.
 */

/** Padding around the device in the DevicePreview viewBox (`-24 -24 w+48 h+48`). */
export const PREVIEW_PAD = 24;
const TEX_MAX = 1600;

export type SceneModel = {
  kind: DeviceKind;
  frame: string | null | undefined;
  params: Device3DParams;
  glbUrl: string | null;
  finish: string | null | undefined;
  coverage: string | null | undefined;
  /** Rail colour when the skin wraps the edges (sides/full coverage). */
  edgeColor: string | null;
  /** A customer skin is applied (studio); false shows the bare device (repair pages). */
  skinned: boolean;
};

export type DeviceScene = {
  setModel(m: SceneModel): void;
  /** Draw a rendered SVG (back or front face) into that face's texture. */
  drawTexture(side: "back" | "front", img: CanvasImageSource): void;
  setView(view: "back" | "front", instant?: boolean): void;
  /** Rotate by a step (keyboard). */
  nudge(dx: number, dy: number): void;
  /** Size of the face textures, matching the frame's preview viewBox. */
  textureSize(): { width: number; height: number };
  dispose(): void;
};

// ───────────── geometry helpers ─────────────

/** The model's frame at its real proportions. */
export const geometryOf = (m: Pick<SceneModel, "frame" | "kind" | "params">) => sizedFrame(frameFor(m.frame, m.kind), aspectOf(m.params));

function roundedRectShape(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0.01, Math.min(r, w / 2, h / 2));
  const s = new THREE.Shape();
  s.moveTo(x + rr, y);
  s.lineTo(x + w - rr, y);
  s.absarc(x + w - rr, y + rr, rr, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - rr);
  s.absarc(x + w - rr, y + h - rr, rr, 0, Math.PI / 2, false);
  s.lineTo(x + rr, y + h);
  s.absarc(x + rr, y + h - rr, rr, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + rr);
  s.absarc(x + rr, y + rr, rr, Math.PI, Math.PI * 1.5, false);
  return s;
}

/** Frame units (SVG, y down, origin top-left) → face-local units (y up, origin centre). */
const toLocal = (g: FrameGeometry, x: number, y: number) => [x - g.w / 2, g.h / 2 - y] as const;

function moduleShape(g: FrameGeometry, m: ModuleShape) {
  if (m.shape === "rect") {
    const [lx, ly] = toLocal(g, m.x, m.y + m.h);
    return roundedRectShape(lx, ly, m.w, m.h, m.r);
  }
  const [cx, cy] = toLocal(g, m.cx, m.cy);
  const s = new THREE.Shape();
  s.absarc(cx, cy, m.r, 0, Math.PI * 2, false);
  return s;
}

const insideModule = (m: ModuleShape, x: number, y: number) =>
  m.shape === "rect" ? x >= m.x && x <= m.x + m.w && y >= m.y && y <= m.y + m.h : Math.hypot(x - m.cx, y - m.cy) <= m.r;

/** UVs that map face-local positions onto the preview texture (which includes the viewBox padding). */
function planarUv(geo: THREE.BufferGeometry, g: FrameGeometry) {
  const pos = geo.getAttribute("position");
  const uv = new Float32Array(pos.count * 2);
  const W = g.w + PREVIEW_PAD * 2;
  const H = g.h + PREVIEW_PAD * 2;
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) + g.w / 2 + PREVIEW_PAD) / W;
    uv[i * 2 + 1] = (pos.getY(i) + g.h / 2 + PREVIEW_PAD) / H;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geo;
}

// ───────────── materials ─────────────

function bodyMaterial(kind: BodyMaterial, color: string) {
  const base = { color: new THREE.Color(color) };
  switch (kind) {
    case "titanium":
      return new THREE.MeshPhysicalMaterial({ ...base, metalness: 0.8, roughness: 0.48 });
    case "steel":
      return new THREE.MeshPhysicalMaterial({ ...base, metalness: 1, roughness: 0.14 });
    case "plastic":
      return new THREE.MeshPhysicalMaterial({ ...base, metalness: 0, roughness: 0.55 });
    case "glass":
      return new THREE.MeshPhysicalMaterial({ ...base, metalness: 0.1, roughness: 0.08, clearcoat: 1 });
    default:
      return new THREE.MeshPhysicalMaterial({ ...base, metalness: 0.85, roughness: 0.34 });
  }
}

/** The skin's surface: finish slug → how light reacts (the texture already carries the finish's look). */
function skinMaterial(finish: string | null | undefined, map: THREE.Texture | null, skinned: boolean) {
  const m = new THREE.MeshPhysicalMaterial({ map, color: 0xffffff });
  if (!skinned) Object.assign(m, { roughness: 0.22, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.1 });
  else
    switch (finish) {
      case "matte":
        Object.assign(m, { roughness: 0.9, metalness: 0 });
        break;
      case "gloss":
        Object.assign(m, { roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04 });
        break;
      case "metallic":
        Object.assign(m, { roughness: 0.32, metalness: 0.7 });
        break;
      case "carbon":
        Object.assign(m, { roughness: 0.42, metalness: 0.1, clearcoat: 0.7, clearcoatRoughness: 0.2 });
        break;
      case "leather":
        Object.assign(m, { roughness: 0.95, metalness: 0, sheen: 1, sheenRoughness: 0.8, sheenColor: new THREE.Color(0x222222) });
        break;
      default:
        Object.assign(m, { roughness: 0.5, metalness: 0 });
    }
  return m;
}

function disposeTree(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const m of mats) m.dispose(); // textures are shared and disposed with the scene
  });
}

// ───────────── generated body ─────────────

function buildGenerated(m: SceneModel, back: THREE.Texture, front: THREE.Texture) {
  const g = geometryOf(m);
  const d = KIND_DEFAULTS[m.kind];
  const p = m.params;
  const W = g.w;
  const H = g.h;
  const R = p.cornerRadius ?? g.r;
  const D = p.thicknessMm && p.widthMm ? (W * p.thicknessMm) / p.widthMm : W * (p.thickness ?? d.thickness);
  const bump = W * (p.bumpHeight ?? d.bumpHeight);
  const cov = m.coverage ?? "back";
  const skinned = m.skinned;
  const group = new THREE.Group();

  // Body: rounded slab with softened (bevelled) rails.
  const bevel = Math.min(D * 0.38, R * 0.6, W * 0.04);
  const bodyGeo = new THREE.ExtrudeGeometry(roundedRectShape(-W / 2 + bevel, -H / 2 + bevel, W - bevel * 2, H - bevel * 2, Math.max(1, R - bevel)), {
    depth: Math.max(0.5, D - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 6,
    curveSegments: 28,
  });
  bodyGeo.translate(0, 0, -(D - bevel * 2) / 2);
  const rail = bodyMaterial(p.bodyMaterial ?? d.bodyMaterial, m.edgeColor ?? p.bodyColor ?? d.bodyColor);
  group.add(new THREE.Mesh(bodyGeo, rail));

  // Faces: flat caps carrying the preview textures, a hair above the body so they never z-fight.
  const face = () => planarUv(new THREE.ShapeGeometry(roundedRectShape(-W / 2 + bevel * 0.6, -H / 2 + bevel * 0.6, W - bevel * 1.2, H - bevel * 1.2, Math.max(1, R - bevel * 0.6)), 32), g);
  const frontMesh = new THREE.Mesh(face(), new THREE.MeshPhysicalMaterial({ map: front, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02 }));
  frontMesh.position.z = D / 2 + 0.05;
  group.add(frontMesh);

  const backGroup = new THREE.Group();
  backGroup.rotation.y = Math.PI; // face-local +z points out of the back
  backGroup.position.z = -D / 2 - 0.05;
  const skin = skinMaterial(m.finish, back, skinned);
  backGroup.add(new THREE.Mesh(face(), skin));

  // Camera modules: raised islands; a "camera"/"full" skin wraps them, otherwise they show the bare back.
  const wrapModules = skinned && (cov === "camera" || cov === "full");
  const moduleMat = wrapModules ? skin : new THREE.MeshPhysicalMaterial({ color: new THREE.Color(p.backColor ?? d.backColor), roughness: 0.25, metalness: 0.2, clearcoat: 0.6 });
  for (const mod of g.modules) {
    if (bump <= 0) break;
    const bt = Math.min(bump * 0.35, 2.4);
    const geo = new THREE.ExtrudeGeometry(moduleShape(g, mod), { depth: Math.max(0.2, bump - bt), bevelEnabled: true, bevelThickness: bt, bevelSize: Math.min(2, bt), bevelSegments: 4, curveSegments: 32 });
    geo.translate(0, 0, bt);
    backGroup.add(new THREE.Mesh(planarUv(geo, g), moduleMat));
  }

  // Lenses and flash sit on their module (or flush on the back).
  const lensH = Math.max(1, W * 0.014);
  const ring = new THREE.MeshStandardMaterial({ color: 0x23262e, metalness: 0.9, roughness: 0.28 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x06080d, roughness: 0.04, metalness: 0.3, clearcoat: 1 });
  const iris = new THREE.MeshPhysicalMaterial({ color: 0x1c2a48, roughness: 0.1, metalness: 0.5, clearcoat: 1 });
  const baseAt = (x: number, y: number) => (g.modules.some((mod) => insideModule(mod, x, y)) ? bump : 0);
  for (const [x, y, r] of g.lenses) {
    const [lx, ly] = toLocal(g, x, y);
    const z0 = baseAt(x, y);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.02, lensH, 48).rotateX(Math.PI / 2), ring);
    barrel.position.set(lx, ly, z0 + lensH / 2);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(r * 0.74, 48), glass);
    lens.position.set(lx, ly, z0 + lensH + 0.06);
    const eye = new THREE.Mesh(new THREE.CircleGeometry(r * 0.34, 32), iris);
    eye.position.set(lx, ly, z0 + lensH + 0.12);
    backGroup.add(barrel, lens, eye);
  }
  const flashMat = new THREE.MeshStandardMaterial({ color: 0xf5efd8, emissive: 0x3a3424, roughness: 0.4 });
  for (const [x, y, r] of g.flash) {
    const [lx, ly] = toLocal(g, x, y);
    const f = new THREE.Mesh(new THREE.CylinderGeometry(r, r, lensH * 0.4, 32).rotateX(Math.PI / 2), flashMat);
    f.position.set(lx, ly, baseAt(x, y) + lensH * 0.2);
    backGroup.add(f);
  }
  group.add(backGroup);

  // Side keys and bottom ports. With a sides/full skin the rails are skinned, so each key and port sits in a
  // dark cut-out gap like a real skin.
  const hw = hardwareFor(m.frame, m.kind);
  const keyMat = bodyMaterial(p.bodyMaterial ?? d.bodyMaterial, p.bodyColor ?? d.bodyColor);
  const gapMat = new THREE.MeshStandardMaterial({ color: 0x050608, roughness: 0.9 });
  const wrapped = skinned && (cov === "sides" || cov === "full");
  const keyOut = Math.max(0.8, W * 0.009);
  const keyT = D * 0.32;
  for (const b of hw.buttons) {
    const len = b.length * H;
    const y = H / 2 - b.top * H - len / 2;
    const x = (b.side === "right" ? 1 : -1) * (W / 2 + keyOut / 2 - 0.4);
    const key = new THREE.Mesh(new THREE.BoxGeometry(keyOut, len, keyT), keyMat);
    key.position.set(x, y, 0);
    group.add(key);
    if (wrapped) {
      const gap = new THREE.Mesh(new THREE.BoxGeometry(keyOut * 0.8, len + W * 0.02, keyT + W * 0.02), gapMat);
      gap.position.set(x - (b.side === "right" ? 1 : -1) * keyOut * 0.35, y, 0);
      group.add(gap);
    }
  }
  if (hw.ports.usb) {
    const slotW = W * 0.11;
    const slot = new THREE.Mesh(new THREE.CapsuleGeometry(D * 0.13, slotW, 4, 12).rotateZ(Math.PI / 2), gapMat);
    slot.position.set(0, -H / 2 + 0.2, 0);
    slot.scale.y = 0.35;
    group.add(slot);
  }
  if (hw.ports.speakers) {
    const hole = new THREE.CylinderGeometry(D * 0.07, D * 0.07, 1.2, 12);
    for (const sideSign of [-1, 1])
      for (let i = 0; i < 5; i++) {
        const h = new THREE.Mesh(hole, gapMat);
        h.position.set(sideSign * (W * 0.14 + i * W * 0.035), -H / 2 + 0.3, 0);
        group.add(h);
      }
  }
  return { group, size: Math.max(W, H, D) };
}

// ───────────── uploaded .glb ─────────────

const SKIN_NAME = /skin|back(?:[_\s-]?(?:cover|panel|glass|plate))?$/i;
const SCREEN_NAME = /screen|display/i;

function fitGlb(root: THREE.Object3D, m: SceneModel, back: THREE.Texture, front: THREE.Texture) {
  const p = m.params;
  root.rotation.set(THREE.MathUtils.degToRad(p.glbRotateX ?? 0), THREE.MathUtils.degToRad(p.glbRotateY ?? 0), THREE.MathUtils.degToRad(p.glbRotateZ ?? 0));
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const wrapper = new THREE.Group();
  root.position.sub(center);
  wrapper.add(root);
  wrapper.scale.setScalar(p.glbScale ?? 1);

  // Named meshes/materials receive the live skin and screen (glTF UVs: 0,0 = top-left of the face).
  const g = geometryOf(m);
  const glbTex = (t: THREE.Texture) => {
    const c = t.clone();
    c.flipY = false;
    c.repeat.set(g.w / (g.w + PREVIEW_PAD * 2), g.h / (g.h + PREVIEW_PAD * 2));
    c.offset.set(PREVIEW_PAD / (g.w + PREVIEW_PAD * 2), PREVIEW_PAD / (g.h + PREVIEW_PAD * 2));
    c.needsUpdate = true;
    return c;
  };
  const backTex = glbTex(back);
  const frontTex = glbTex(front);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const name = `${mesh.name} ${mat?.name ?? ""}`;
    if (SCREEN_NAME.test(name)) mesh.material = new THREE.MeshPhysicalMaterial({ map: frontTex, roughness: 0.06, clearcoat: 1 });
    else if (SKIN_NAME.test(name)) mesh.material = skinMaterial(m.finish, backTex, m.skinned);
  });
  return { group: wrapper, size: Math.max(size.x, size.y, size.z) * (p.glbScale ?? 1), textures: [backTex, frontTex] };
}

// ───────────── scene ─────────────

export function createDeviceScene(container: HTMLElement, opts: { reducedMotion: boolean; interactive: boolean }): DeviceScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const canvas = renderer.domElement;
  canvas.style.cssText = "width:100%;height:100%;display:block;touch-action:pan-y;outline:none";
  if (opts.interactive) canvas.style.cursor = "grab";
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new RoomEnvironment();
  scene.environment = pmrem.fromScene(envScene, 0.04).texture;
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(3, 4, 5);
  const rim = new THREE.DirectionalLight(0xb9a8ff, 0.8);
  rim.position.set(-4, 2, -3);
  scene.add(key, rim, new THREE.AmbientLight(0xffffff, 0.25));

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  const pivot = new THREE.Group();
  scene.add(pivot);

  // Face textures, redrawn in place whenever the design changes.
  const faces = { back: document.createElement("canvas"), front: document.createElement("canvas") };
  const textures = { back: new THREE.CanvasTexture(faces.back), front: new THREE.CanvasTexture(faces.front) };
  for (const t of Object.values(textures)) {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }
  let extraTextures: THREE.Texture[] = [];

  let model: SceneModel | null = null;
  let current: THREE.Object3D | null = null;
  let glbToken = 0;
  const loader = new GLTFLoader();

  function sizeFaces(m: SceneModel) {
    const g = geometryOf(m);
    const W = g.w + PREVIEW_PAD * 2;
    const H = g.h + PREVIEW_PAD * 2;
    const s = TEX_MAX / Math.max(W, H);
    const w = Math.round(W * s);
    const h = Math.round(H * s);
    for (const side of ["back", "front"] as const) {
      if (faces[side].width !== w || faces[side].height !== h) {
        faces[side].width = w;
        faces[side].height = h;
        // A resized canvas needs a fresh GPU texture.
        textures[side].dispose();
        textures[side].needsUpdate = true;
      }
    }
  }

  function replace(obj: THREE.Object3D, size: number) {
    if (current) {
      pivot.remove(current);
      disposeTree(current);
    }
    current = obj;
    obj.scale.multiplyScalar(2 / size); // normalise: largest dimension = 2 units
    pivot.add(obj);
    fit();
  }

  function setModel(m: SceneModel) {
    model = m;
    sizeFaces(m);
    for (const t of extraTextures) t.dispose();
    extraTextures = [];
    const gen = buildGenerated(m, textures.back, textures.front);
    replace(gen.group, gen.size);
    const token = ++glbToken;
    if (m.glbUrl) {
      loader.load(
        m.glbUrl,
        (gltf) => {
          if (token !== glbToken) return disposeTree(gltf.scene);
          const fitted = fitGlb(gltf.scene, m, textures.back, textures.front);
          extraTextures = fitted.textures;
          replace(fitted.group, fitted.size);
        },
        undefined,
        (err) => console.warn("3D model failed to load; showing the generated body instead.", err),
      );
    }
  }

  // ── view & interaction ──
  let targetY = 0;
  let userY = 0;
  let userX = 0;
  let velocity = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  const start = performance.now();

  const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
  function setView(view: "back" | "front", instant = false) {
    targetY = view === "back" ? Math.PI : 0;
    // Take the short way round from wherever the user left it.
    pivot.rotation.y = targetY + wrap(pivot.rotation.y - targetY);
    userY = 0;
    userX = 0;
    velocity = 0;
    if (instant || opts.reducedMotion) pivot.rotation.set(0, targetY, 0);
  }

  const onDown = (e: PointerEvent) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = "grabbing";
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    userY += dx * 0.012;
    velocity = dx * 0.012;
    userX = THREE.MathUtils.clamp(userX + dy * 0.006, -0.6, 0.6);
  };
  const onUp = (e: PointerEvent) => {
    dragging = false;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    canvas.style.cursor = "grab";
  };
  if (opts.interactive) {
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
  }

  function fit() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    // Object is normalised to 2 units on its largest side; fit its bounding sphere in both directions.
    const radius = 1.08;
    const dist = Math.max(radius / Math.tan(vfov / 2), radius / (Math.tan(vfov / 2) * camera.aspect));
    camera.position.set(0, 0, dist * 1.3);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }

  const resize = new ResizeObserver(() => fit());
  resize.observe(container);

  let visible = true;
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !raf) raf = requestAnimationFrame(loop);
  });
  io.observe(container);

  let raf = 0;
  function loop(now: number) {
    raf = 0;
    if (!visible) return;
    if (!dragging) {
      velocity *= 0.92;
      userY += velocity;
    }
    const sway = opts.reducedMotion || dragging ? 0 : Math.sin((now - start) / 2200) * 0.28;
    const ty = targetY + userY + sway;
    const tx = userX + (opts.reducedMotion ? 0 : Math.sin((now - start) / 3100) * 0.05);
    const k = opts.reducedMotion ? 1 : 0.08;
    pivot.rotation.y += (ty - pivot.rotation.y) * k;
    pivot.rotation.x += (tx - pivot.rotation.x) * k;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  return {
    setModel,
    setView,
    nudge(dx, dy) {
      userY += dx;
      userX = THREE.MathUtils.clamp(userX + dy, -0.6, 0.6);
    },
    textureSize() {
      return { width: faces.back.width, height: faces.back.height };
    },
    drawTexture(side, img) {
      const c = faces[side];
      const ctx = c.getContext("2d");
      if (!ctx || !model) return;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      textures[side].needsUpdate = true;
      for (const t of extraTextures) t.needsUpdate = true;
    },
    dispose() {
      cancelAnimationFrame(raf);
      resize.disconnect();
      io.disconnect();
      glbToken++;
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      if (current) disposeTree(current);
      for (const t of [...Object.values(textures), ...extraTextures]) t.dispose();
      scene.environment?.dispose();
      envScene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose();
      });
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
