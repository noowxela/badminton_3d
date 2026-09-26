import * as THREE from 'three';
import {
  COURT_LENGTH,
  COURT_WIDTH,
  NET_CENTER_HEIGHT,
  NET_POST_HEIGHT,
  SHORT_SERVICE,
  LONG_SERVICE_INSET,
  SINGLES_INSET,
} from './constants.js';

export const COURT_STYLES = {
  'pro-mat': {
    id: 'pro-mat',
    label: 'Pro Mat',
    fog: 0x4a5560,
    fogNear: 60,
    fogFar: 120,
    bg: 0x3a4550,
  },
  'wood-hall': {
    id: 'wood-hall',
    label: 'Wood Hall',
    fog: 0xc5d0a0,
    fogNear: 50,
    fogFar: 100,
    bg: 0xb8c96a,
  },
};

export const DEFAULT_COURT_STYLE = 'pro-mat';
const STORAGE_KEY = 'badminton_3d_court_style';

export function getSavedCourtStyle() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && COURT_STYLES[v]) return v;
  } catch (_) {
    /* ignore */
  }
  return DEFAULT_COURT_STYLE;
}

export function saveCourtStyle(id) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch (_) {
    /* ignore */
  }
}

/**
 * Load procedural court (style from localStorage / default).
 * Also probes court.glb with Vite BASE_URL so Pages path is correct when a future GLB ships.
 */
export async function loadCourt(scene, styleId = getSavedCourtStyle()) {
  // BASE_URL-aware asset path (GitHub Pages base is /badminton_3d/).
  // Procedural styles are the shipped look; GLB path kept for future Blender exports.
  const base = import.meta.env.BASE_URL || '/';
  const url = `${base}assets/court.glb`;
  console.info('[court] asset base', base, 'glb path', url);

  const style = COURT_STYLES[styleId] ? styleId : DEFAULT_COURT_STYLE;
  const root = buildProceduralCourt(style);
  scene.add(root);
  return { root, netHeight: NET_CENTER_HEIGHT, fromGlb: false, style };
}

/** Swap court geometry/materials in-place without reload. */
export function setCourtStyle(scene, currentRoot, styleId) {
  const style = COURT_STYLES[styleId] ? styleId : DEFAULT_COURT_STYLE;
  if (currentRoot) {
    scene.remove(currentRoot);
    currentRoot.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          if (m.map) m.map.dispose();
          m.dispose();
        }
      }
    });
  }
  const root = buildProceduralCourt(style);
  scene.add(root);
  saveCourtStyle(style);
  return { root, style };
}

export function applyStyleAtmosphere(scene, styleId) {
  const s = COURT_STYLES[styleId] || COURT_STYLES[DEFAULT_COURT_STYLE];
  scene.background = new THREE.Color(s.bg);
  scene.fog = new THREE.Fog(s.fog, s.fogNear, s.fogFar);
}

function makeWoodTexture() {
  const w = 512;
  const h = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#c4a36a';
  ctx.fillRect(0, 0, w, h);
  const plankH = 28;
  for (let y = 0; y < h; y += plankH) {
    const tone = 180 + ((y * 17) % 40);
    const g = 140 + ((y * 13) % 35);
    const b = 80 + ((y * 7) % 25);
    ctx.fillStyle = `rgb(${tone},${g},${b})`;
    ctx.fillRect(0, y, w, plankH - 1);
    ctx.strokeStyle = `rgba(90, 55, 25, ${0.08 + ((y * 3) % 7) / 100})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const gy = y + 4 + i * 5 + ((y + i) % 3);
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.bezierCurveTo(w * 0.3, gy + 1, w * 0.6, gy - 1, w, gy);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(70, 40, 15, 0.35)';
    ctx.fillRect(0, y + plankH - 1, w, 1);
  }
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.06)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeMatTexture(hex, noise = 18) {
  const s = 256;
  const canvas = document.createElement('canvas');
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, s, s);
  const img = ctx.getImageData(0, 0, s, s);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = ((i * 13) % noise) - noise / 2;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n * 0.6));
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 12);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeNetTexture() {
  const s = 256;
  const canvas = document.createElement('canvas');
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, s, s);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.2;
  const step = 10;
  for (let i = 0; i <= s; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(s, i);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(28, 8);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Procedural court. Axes: X = width, Z = length, Y = up.
 * @param {'pro-mat'|'wood-hall'} styleId
 */
export function buildProceduralCourt(styleId = DEFAULT_COURT_STYLE) {
  const isWood = styleId === 'wood-hall';
  const root = new THREE.Group();
  root.name = isWood ? 'CourtWoodHall' : 'CourtProMat';
  root.userData.courtStyle = styleId;

  const hl = COURT_LENGTH / 2;
  const hw = COURT_WIDTH / 2;
  const lw = 0.04;
  const ly = 0.028;
  const floorPad = isWood ? 3.2 : 2.8;

  // MeshBasicMaterial so court/lines read vividly without depending on lights.
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const tapeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const cordMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

  let surroundMat;
  let surfaceMat;
  let postMat;
  let baseMat;

  if (isWood) {
    const woodTex = makeWoodTexture();
    surroundMat = new THREE.MeshBasicMaterial({ map: woodTex });
    const courtTex = woodTex.clone();
    courtTex.repeat.set(1.5, 3.2);
    courtTex.needsUpdate = true;
    surfaceMat = new THREE.MeshBasicMaterial({ map: courtTex });
    postMat = new THREE.MeshBasicMaterial({ color: 0xf2f4f8 });
    baseMat = new THREE.MeshBasicMaterial({ color: 0x1e4f9c });
  } else {
    // pro-mat: vivid green court, navy surround — Basic so they never go black/gray
    const greenTex = makeMatTexture('#2f8f3a', 22);
    const navyTex = makeMatTexture('#152a4a', 12);
    surfaceMat = new THREE.MeshBasicMaterial({ map: greenTex, color: 0x2f8f3a });
    surroundMat = new THREE.MeshBasicMaterial({ map: navyTex, color: 0x152a4a });
    postMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
    baseMat = new THREE.MeshBasicMaterial({ color: 0x2a1810 });
  }

  // Surround / outer floor — X=width, Z=length
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(COURT_WIDTH + floorPad * 2, 0.06, COURT_LENGTH + floorPad * 2),
    surroundMat,
  );
  floor.position.y = -0.03;
  floor.receiveShadow = true;
  root.add(floor);

  const surface = new THREE.Mesh(
    new THREE.BoxGeometry(COURT_WIDTH, 0.02, COURT_LENGTH),
    surfaceMat,
  );
  surface.position.y = 0.012;
  surface.receiveShadow = true;
  root.add(surface);

  const addLine = (sx, sy, sz, x, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), lineMat);
    m.position.set(x, ly, z);
    m.receiveShadow = true;
    root.add(m);
  };

  // BWF lines (X = width, Z = length)
  addLine(COURT_WIDTH, 0.01, lw, 0, hl);
  addLine(COURT_WIDTH, 0.01, lw, 0, -hl);
  addLine(lw, 0.01, COURT_LENGTH, hw, 0);
  addLine(lw, 0.01, COURT_LENGTH, -hw, 0);

  const singlesX = hw - SINGLES_INSET;
  addLine(lw, 0.01, COURT_LENGTH, singlesX, 0);
  addLine(lw, 0.01, COURT_LENGTH, -singlesX, 0);

  addLine(COURT_WIDTH, 0.01, lw, 0, SHORT_SERVICE);
  addLine(COURT_WIDTH, 0.01, lw, 0, -SHORT_SERVICE);

  const longZ = hl - LONG_SERVICE_INSET;
  addLine(COURT_WIDTH, 0.01, lw, 0, longZ);
  addLine(COURT_WIDTH, 0.01, lw, 0, -longZ);

  const centerLen = hl - SHORT_SERVICE;
  addLine(lw, 0.01, centerLen, 0, (hl + SHORT_SERVICE) / 2);
  addLine(lw, 0.01, centerLen, 0, -(hl + SHORT_SERVICE) / 2);

  // Posts + bases
  const postGeo = new THREE.CylinderGeometry(0.035, 0.035, NET_POST_HEIGHT, 16);
  const wheelMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
  for (const x of [hw, -hw]) {
    const postGroup = new THREE.Group();
    postGroup.position.set(x, 0, 0);

    if (isWood) {
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.7), baseMat);
      base.position.y = 0.06;
      base.castShadow = true;
      base.receiveShadow = true;
      postGroup.add(base);
      const wheelGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.04, 12);
      for (const [wx, wz] of [
        [-0.2, -0.28],
        [0.2, -0.28],
        [-0.2, 0.28],
        [0.2, 0.28],
      ]) {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wx, 0.045, wz);
        postGroup.add(wheel);
      }
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.y = NET_POST_HEIGHT / 2 + 0.1;
      post.castShadow = true;
      postGroup.add(post);
    } else {
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.1, 0.55), baseMat);
      base.position.y = 0.05;
      base.castShadow = true;
      base.receiveShadow = true;
      postGroup.add(base);
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.y = NET_POST_HEIGHT / 2 + 0.08;
      post.castShadow = true;
      postGroup.add(post);
    }
    root.add(postGroup);
  }

  // White mesh net + top tape + bottom cord
  const netTex = makeNetTexture();
  const netMat = new THREE.MeshBasicMaterial({
    map: netTex,
    color: 0xffffff,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const netH = NET_CENTER_HEIGHT - 0.08;
  const net = new THREE.Mesh(new THREE.PlaneGeometry(COURT_WIDTH - 0.08, netH), netMat);
  net.position.set(0, 0.08 + netH / 2, 0);
  root.add(net);

  const tape = new THREE.Mesh(new THREE.BoxGeometry(COURT_WIDTH - 0.04, 0.055, 0.03), tapeMat);
  tape.position.set(0, NET_CENTER_HEIGHT - 0.01, 0);
  tape.castShadow = true;
  root.add(tape);

  const cord = new THREE.Mesh(new THREE.BoxGeometry(COURT_WIDTH - 0.08, 0.015, 0.015), cordMat);
  cord.position.set(0, 0.09, 0);
  root.add(cord);

  // Far backdrop only — cannot occlude court from default camera at -Z.
  // No side walls, pillars, corrugated bands, ceiling, or roof beams.
  const backdropMat = new THREE.MeshBasicMaterial({
    color: isWood ? 0xa8b85a : 0x2a3540,
    side: THREE.DoubleSide,
  });
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), backdropMat);
  backdrop.position.set(0, 8, 28);
  root.add(backdrop);

  return root;
}

export function normalizeCourtOrientation(root) {
  // Procedural courts already use X=width / Z=length; no hall to reorient.
  if (root?.userData?.courtStyle) return;
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (size.x > size.z + 1 && size.x > 10) {
    root.rotation.y = Math.PI / 2;
    root.updateMatrixWorld(true);
  }
}
