import * as THREE from 'three';
import { loadCourt, normalizeCourtOrientation } from './court/loadCourt.js';
import { Shuttle } from './physics/shuttle.js';
import { createDoublesRoster } from './players/player.js';
import { SimpleAi } from './ai/simpleAi.js';
import { Hud } from './ui/hud.js';
import { Match } from './game/match.js';

const canvas = document.getElementById('game-canvas');
const hud = new Hud();

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87a0c0);
scene.fog = new THREE.Fog(0x87a0c0, 28, 55);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
// Human side view: look from -Z toward net
camera.position.set(0, 9.5, -14.5);
camera.lookAt(0, 0.5, 0);

// Lights
const hemi = new THREE.HemisphereLight(0xddeeff, 0x3a4a2a, 0.7);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff5e6, 1.35);
sun.position.set(6, 14, -4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -12;
sun.shadow.camera.right = 12;
sun.shadow.camera.top = 12;
sun.shadow.camera.bottom = -12;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xb0c4ff, 0.35);
fill.position.set(-8, 6, 6);
scene.add(fill);

// Input
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
  if (e.button === 0) match?.onHitRequest();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let match = null;
let shuttle = null;
let roster = null;

async function init() {
  hud.setStatus('Loading court…');
  const { root, fromGlb } = await loadCourt(scene);
  normalizeCourtOrientation(root);

  // Hide baked Blender player stubs if present — we use gameplay players
  root.traverse((obj) => {
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

  hud.setStatus(
    fromGlb
      ? 'Court loaded — Space to serve'
      : 'Procedural court (no GLB) — Space to serve',
  );

  // Aim marker
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

    // Soft camera follow human a bit
    const targetCamX = roster.human.position.x * 0.25;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, targetCamX, 2, dt);

    renderer.render(scene, camera);
  }

  frame();
  console.info('[badminton-3d] ready');
}

init().catch((err) => {
  console.error(err);
  hud.setStatus('Init failed — see console');
});
