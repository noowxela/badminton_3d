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
import { createExteriorBuilding, applyExteriorAtmosphere } from './building/exterior.js';
import { EnterFlow, ViewState } from './building/enterFlow.js';

/**
 * Interior broadcast camera — inside the enlarged sealed hall (near wall ~−13),
 * looking down the full court.
 */
const INTERIOR_CAMERA_POS = Object.freeze({ x: 0, y: 9.4, z: -9.4 });
const INTERIOR_CAMERA_TARGET = Object.freeze({ x: 0, y: 0.5, z: 1.7 });

const canvas = document.getElementById('game-canvas');
const hud = new Hud();

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
applyExteriorAtmosphere(scene);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 120);
camera.position.set(0, 3.6, -22);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1.6, -10);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 6;
controls.maxDistance = 28;
controls.minPolarAngle = 0.15;
controls.maxPolarAngle = Math.PI / 2 - 0.05;
controls.enablePan = true;
controls.screenSpacePanning = false;
// Left-click: door enter (exterior) / hit-serve (inside); right-drag orbits when inside.
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
  if (!enterFlow?.isInside) return;
  controls.reset();
}

function clampOrbitTarget() {
  if (!enterFlow?.isInside) return;
  controls.target.x = THREE.MathUtils.clamp(controls.target.x, -5, 5);
  controls.target.y = THREE.MathUtils.clamp(controls.target.y, 0, 3);
  controls.target.z = THREE.MathUtils.clamp(controls.target.z, -8, 8);
}

// Soft lighting (works outdoors + indoors)
const hemi = new THREE.HemisphereLight(0xf0f4ff, 0x4a4030, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff5e6, 1.3);
sun.position.set(6, 18, -8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -18;
sun.shadow.camera.right = 18;
sun.shadow.camera.top = 18;
sun.shadow.camera.bottom = -18;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xc8d4ff, 0.45);
fill.position.set(-8, 8, 6);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xffffff, 0.3);
rim.position.set(0, 10, 10);
scene.add(rim);

const input = { left: false, right: false, forward: false, back: false };
const mouseNdc = new THREE.Vector2(0, 0);
const keys = new Set();

let match = null;
let shuttle = null;
let roster = null;
let courtRoot = null;
let exterior = null;
let enterFlow = null;
let aimMarker = null;
let gameplayReady = false;

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

  if (!gameplayReady || !enterFlow?.isInside) return;
  if (down && k === ' ') match?.onHitRequest();
  if (down && k === 'r') match?.resetRally();
}

window.addEventListener('keydown', (e) => onKey(e, true));
window.addEventListener('keyup', (e) => onKey(e, false));

function setPointerFromClient(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  mouseNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  mouseNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  if (enterFlow) enterFlow.updatePointer(mouseNdc.x, mouseNdc.y);
}

window.addEventListener('mousemove', (e) => {
  setPointerFromClient(e.clientX, e.clientY);
  if (gameplayReady && enterFlow?.isInside) {
    match?.setAimFromMouse(mouseNdc, camera);
  }
});
window.addEventListener('mousedown', (e) => {
  setPointerFromClient(e.clientX, e.clientY);
  if (e.button !== 0) return;
  if (e.target.closest && e.target.closest('#hud button, #court-style, .style-btn, #cam-controls')) {
    return;
  }
  if (!enterFlow) return;

  if (enterFlow.isExterior) {
    if (enterFlow.tryEnter()) {
      hud.setStatus('Entering hall…');
      canvas.style.cursor = 'default';
    }
    return;
  }

  if (enterFlow.isInside && gameplayReady) {
    match?.onHitRequest();
  }
});

canvas.addEventListener(
  'touchstart',
  (e) => {
    const touch = e.touches[0];
    if (!touch) return;
    setPointerFromClient(touch.clientX, touch.clientY);
    if (enterFlow?.isExterior && enterFlow.updateHover()) {
      // Keep a door tap from being consumed by OrbitControls.
      e.preventDefault();
    }
  },
  { passive: false },
);

canvas.addEventListener(
  'touchend',
  (e) => {
    const touch = e.changedTouches[0];
    if (!touch) return;
    setPointerFromClient(touch.clientX, touch.clientY);
    if (!enterFlow?.isExterior) return;

    enterFlow.updateHover();
    if (enterFlow.tryEnter()) {
      e.preventDefault();
      hud.setStatus('Entering hall…');
      canvas.style.cursor = 'default';
    }
  },
  { passive: false },
);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function onEnterState(state) {
  if (state === ViewState.EXTERIOR) {
    applyExteriorAtmosphere(scene);
    hud.setGameplayVisible(false);
    hud.setEnterButtonVisible(true);
    hud.setStatus('Tap the door or Enter hall to go inside');
    if (hud.controlsHint) {
      hud.controlsHint.textContent = 'Tap the door or Enter hall to go inside';
    }
    canvas.style.cursor = 'default';
  } else if (state === ViewState.ENTERING) {
    hud.setGameplayVisible(false);
    hud.setEnterButtonVisible(false);
    hud.setStatus('Entering hall…');
    canvas.style.cursor = 'default';
  } else if (state === ViewState.INSIDE) {
    applyStyleAtmosphere(scene, getSavedCourtStyle());
    hud.setGameplayVisible(true);
    hud.setEnterButtonVisible(false);
    sun.position.set(4, 16, -2);
    if (!gameplayReady) {
      beginGameplay();
    } else {
      hud.setStatus('Your serve — Space / Click to serve');
    }
    if (hud.controlsHint) {
      hud.controlsHint.textContent =
        'WASD move · Mouse aim · Click / Space hit · Right-drag orbit · Wheel zoom · R reset rally';
    }
    canvas.style.cursor = 'crosshair';
  }
}

function beginGameplay() {
  if (gameplayReady) return;
  gameplayReady = true;

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

  const aimGeo = new THREE.RingGeometry(0.25, 0.32, 24);
  const aimMat = new THREE.MeshBasicMaterial({
    color: 0xffee88,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.7,
  });
  aimMarker = new THREE.Mesh(aimGeo, aimMat);
  aimMarker.rotation.x = -Math.PI / 2;
  aimMarker.position.y = 0.03;
  scene.add(aimMarker);

  hud.setCourtStyle(getSavedCourtStyle(), (nextId) => {
    const result = setCourtStyle(scene, courtRoot, nextId);
    courtRoot = result.root;
    if (enterFlow?.isInside) applyStyleAtmosphere(scene, result.style);
  });
  hud.setResetView(resetCameraView);
}

async function init() {
  hud.setStatus('Loading…');
  hud.setGameplayVisible(false);

  exterior = createExteriorBuilding();
  scene.add(exterior.group);

  const initialStyle = getSavedCourtStyle();
  const loaded = await loadCourt(scene, initialStyle);
  courtRoot = loaded.root;
  normalizeCourtOrientation(courtRoot);

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

  enterFlow = new EnterFlow({
    camera,
    controls,
    exterior,
    interiorCamPos: INTERIOR_CAMERA_POS,
    interiorCamTarget: INTERIOR_CAMERA_TARGET,
    onStateChange: onEnterState,
  });
  hud.setEnterAction(() => {
    if (enterFlow?.forceEnter()) {
      hud.setStatus('Entering hall…');
      canvas.style.cursor = 'default';
    }
  });
  enterFlow.setupExteriorCamera();
  onEnterState(ViewState.EXTERIOR);

  const clock = new THREE.Clock();
  let running = true;

  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);

    if (enterFlow.isExterior) {
      const hovered = enterFlow.updateHover();
      canvas.style.cursor = hovered ? 'pointer' : 'default';
      if (hovered) {
        hud.setStatus('Tap the door or Enter hall to go inside');
      } else if (enterFlow.state === ViewState.EXTERIOR) {
        hud.setStatus('Tap the door or Enter hall to go inside');
      }
    }

    const ev = enterFlow.update(dt);
    if (ev === 'entered') {
      // onStateChange already fired
    }

    if (gameplayReady && enterFlow.isInside && match) {
      match.setAimFromMouse(mouseNdc, camera);
      if (aimMarker) {
        aimMarker.position.x = match.aim.x;
        aimMarker.position.z = match.aim.z;
      }
      match.update(dt, input);
      const sev = shuttle.update(dt);
      if (sev !== 'none') match.onShuttleEvent(sev);
      clampOrbitTarget();
    }

    if (controls.enabled) controls.update();

    renderer.render(scene, camera);
  }

  frame();
  console.info('[badminton-3d] ready', {
    view: enterFlow.state,
    style: loaded.style,
    styles: Object.keys(COURT_STYLES),
    interiorCam: INTERIOR_CAMERA_POS,
  });
}

init().catch((err) => {
  console.error(err);
  hud.setStatus('Init failed — see console');
});
