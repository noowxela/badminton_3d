import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  loadCourt,
  normalizeCourtOrientation,
  setCourtStyle,
  applyStyleAtmosphere,
  getSavedCourtStyle,
  COURT_STYLES,
} from './court/loadCourt.js';
import { Shuttle } from './physics/shuttle.js';
import { createDoublesRoster } from './players/player.js';
import { SimpleAi } from './ai/simpleAi.js';
import { Hud } from './ui/hud.js';
import { Match } from './game/match.js';

/** Broadcast / TV high-angle — pulled back so full green court frames clearly. */
const DEFAULT_CAMERA_POS = Object.freeze({ x: 0, y: 12, z: -16 });
const DEFAULT_CAMERA_TARGET = Object.freeze({ x: 0, y: 0, z: 0 });

const canvas = document.getElementById('game-canvas');
const hud = new Hud();

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
applyStyleAtmosphere(scene, getSavedCourtStyle());

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(DEFAULT_CAMERA_POS.x, DEFAULT_CAMERA_POS.y, DEFAULT_CAMERA_POS.z);

const controls = new OrbitControls(camera, canvas);
controls.target.set(DEFAULT_CAMERA_TARGET.x, DEFAULT_CAMERA_TARGET.y, DEFAULT_CAMERA_TARGET.z);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 6;
controls.maxDistance = 36;
controls.minPolarAngle = 0.2;
controls.maxPolarAngle = Math.PI / 2 - 0.08;
controls.enablePan = true;
controls.screenSpacePanning = false;
// Left-click stays hit/serve; right-drag orbits; middle pans; wheel zooms.
controls.mouseButtons = {
  LEFT: null,
  MIDDLE: THREE.MOUSE.PAN,
  RIGHT: THREE.MOUSE.ROTATE,
};
controls.touches = {
  ONE: THREE.TOUCH.ROTATE,
  TWO: THREE.TOUCH.DOLLY_PAN,
};
controls.update();
controls.saveState();

function resetCameraView() {
  controls.reset();
}

function clampOrbitTarget() {
  controls.target.x = THREE.MathUtils.clamp(controls.target.x, -5, 5);
  controls.target.y = THREE.MathUtils.clamp(controls.target.y, 0, 3);
  controls.target.z = THREE.MathUtils.clamp(controls.target.z, -8, 8);
}

// Soft indoor lighting
const hemi = new THREE.HemisphereLight(0xf0f4ff, 0x4a4030, 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff5e6, 1.25);
sun.position.set(4, 16, -2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -14;
sun.shadow.camera.right = 14;
sun.shadow.camera.top = 14;
sun.shadow.camera.bottom = -14;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xc8d4ff, 0.4);
fill.position.set(-8, 8, 6);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xffffff, 0.25);
rim.position.set(0, 10, 10);
scene.add(rim);

const input = { left: false, right: false, forward: false, back: false };
const mouseNdc = new THREE.Vector2(0, 0);
const keys = new Set();

function onKey(e, down) {
  const k = e.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'r'].includes(k)) {
    e.preventDefault();
  }
  if (down) keys.add(k);
  else keys.delete(k);

  input.forward = keys.has('w') || keys.has('arrowup');
  input.back = keys.has('s') || keys.has('arrowdown');
  input.left = keys.has('a') || keys.has('arrowleft');
  input.right = keys.has('d') || keys.has('arrowright');

  if (down && k === ' ') match?.onHitRequest();
  if (down && k === 'r') match?.resetRally();
}

window.addEventListener('keydown', (e) => onKey(e, true));
window.addEventListener('keyup', (e) => onKey(e, false));
window.addEventListener('mousemove', (e) => {
  mouseNdc.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouseNdc.y = -(e.clientY / window.innerHeight) * 2 + 1;
  match?.setAimFromMouse(mouseNdc, camera);
});
window.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  // Ignore HUD / court-style / reset UI clicks
  if (e.target.closest && e.target.closest('#hud button, #court-style, .style-btn, #cam-controls')) return;
  match?.onHitRequest();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let match = null;
let shuttle = null;
let roster = null;
let courtRoot = null;

async function init() {
  hud.setStatus('Loading court…');
  const initialStyle = getSavedCourtStyle();
  const loaded = await loadCourt(scene, initialStyle);
  courtRoot = loaded.root;
  normalizeCourtOrientation(courtRoot);
  applyStyleAtmosphere(scene, loaded.style);

  // Lock broadcast defaults for Reset view (full court framed).
  camera.position.set(DEFAULT_CAMERA_POS.x, DEFAULT_CAMERA_POS.y, DEFAULT_CAMERA_POS.z);
  controls.target.set(DEFAULT_CAMERA_TARGET.x, DEFAULT_CAMERA_TARGET.y, DEFAULT_CAMERA_TARGET.z);
  controls.update();
  controls.saveState();

  courtRoot.traverse((obj) => {
    const n = obj.name || '';
    if (
      n.startsWith('Player_') ||
      n.includes('_Body') ||
      n.includes('_Head') ||
      n.includes('_Racket') ||
      n.includes('_Handle') ||
      n === 'Shuttle_Ref'
    ) {
      obj.visible = false;
    }
  });

  shuttle = new Shuttle();
  scene.add(shuttle.mesh);

  roster = createDoublesRoster(scene);
  const ai = new SimpleAi(roster.players);

  match = new Match({
    shuttle,
    human: roster.human,
    players: roster.players,
    hud,
    ai,
  });
  match.start();

  hud.setCourtStyle(loaded.style, (nextId) => {
    const result = setCourtStyle(scene, courtRoot, nextId);
    courtRoot = result.root;
    applyStyleAtmosphere(scene, result.style);
  });

  hud.setResetView(resetCameraView);

  hud.setStatus('Your serve — Space / Click to serve');

  const aimGeo = new THREE.RingGeometry(0.25, 0.32, 24);
  const aimMat = new THREE.MeshBasicMaterial({
    color: 0xffee88,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.7,
  });
  const aimMarker = new THREE.Mesh(aimGeo, aimMat);
  aimMarker.rotation.x = -Math.PI / 2;
  aimMarker.position.y = 0.03;
  scene.add(aimMarker);

  const clock = new THREE.Clock();
  let running = true;

  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);

    match.setAimFromMouse(mouseNdc, camera);
    aimMarker.position.x = match.aim.x;
    aimMarker.position.z = match.aim.z;

    match.update(dt, input);
    const ev = shuttle.update(dt);
    if (ev !== 'none') match.onShuttleEvent(ev);

    clampOrbitTarget();
    controls.update();

    renderer.render(scene, camera);
  }

  frame();
  console.info('[badminton-3d] ready', {
    style: loaded.style,
    styles: Object.keys(COURT_STYLES),
    camera: DEFAULT_CAMERA_POS,
    target: DEFAULT_CAMERA_TARGET,
  });
}

init().catch((err) => {
  console.error(err);
  hud.setStatus('Init failed — see console');
});
