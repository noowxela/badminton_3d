import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { COURT_LENGTH, COURT_WIDTH, NET_CENTER_HEIGHT } from './constants.js';

/**
 * Load court.glb. If missing/fail, build a procedural fallback court.
 * @returns {Promise<{ root: THREE.Group, netHeight: number }>}
 */
export async function loadCourt(scene) {
  const loader = new GLTFLoader();
  const url = '/assets/court.glb';

  try {
    const gltf = await loader.loadAsync(url);
    const root = gltf.scene;
    root.name = 'CourtGLB';

    // Blender Y-up export should already match Three.js Y-up.
    // Ensure shadows on meshes.
    root.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });

    scene.add(root);
    console.info('[court] Loaded', url);
    return { root, netHeight: NET_CENTER_HEIGHT, fromGlb: true };
  } catch (err) {
    console.warn('[court] GLB load failed, using procedural fallback:', err.message);
    const root = buildProceduralCourt();
    scene.add(root);
    return { root, netHeight: NET_CENTER_HEIGHT, fromGlb: false };
  }
}

function buildProceduralCourt() {
  const root = new THREE.Group();
  root.name = 'CourtProcedural';

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x1f5a2e, roughness: 0.85 });
  const courtMat = new THREE.MeshStandardMaterial({ color: 0x266b38, roughness: 0.8 });
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 });
  const netMat = new THREE.MeshStandardMaterial({ color: 0xd8dce8, roughness: 0.45, transparent: true, opacity: 0.85 });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.35, metalness: 0.2 });

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(COURT_LENGTH + 4, 0.05, COURT_WIDTH + 4),
    floorMat,
  );
  floor.position.y = -0.025;
  floor.receiveShadow = true;
  root.add(floor);

  const surface = new THREE.Mesh(
    new THREE.BoxGeometry(COURT_LENGTH, 0.02, COURT_WIDTH),
    courtMat,
  );
  surface.position.y = 0.01;
  surface.receiveShadow = true;
  root.add(surface);

  const hl = COURT_LENGTH / 2;
  const hw = COURT_WIDTH / 2;
  const lw = 0.04;
  const lz = 0.025;

  const addLine = (sx, sy, sz, x, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), lineMat);
    m.position.set(x, lz, z);
    root.add(m);
  };

  // Outer bounds (X = length axis in Three after remapping? )
  // Convention: X = width (±), Z = length (±), Y = up
  // Back lines (constant Z)
  addLine(COURT_WIDTH, 0.008, lw, 0, hl);
  addLine(COURT_WIDTH, 0.008, lw, 0, -hl);
  // Sidelines (constant X)
  addLine(lw, 0.008, COURT_LENGTH, hw, 0);
  addLine(lw, 0.008, COURT_LENGTH, -hw, 0);
  // Short service
  addLine(COURT_WIDTH, 0.008, lw, 0, 1.98);
  addLine(COURT_WIDTH, 0.008, lw, 0, -1.98);
  // Long service
  addLine(COURT_WIDTH, 0.008, lw, 0, hl - 0.76);
  addLine(COURT_WIDTH, 0.008, lw, 0, -(hl - 0.76));
  // Center
  addLine(lw, 0.008, hl - 1.98, 0, (hl + 1.98) / 2);
  addLine(lw, 0.008, hl - 1.98, 0, -(hl + 1.98) / 2);

  // Posts
  const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.55, 12);
  for (const x of [hw, -hw]) {
    const p = new THREE.Mesh(postGeo, postMat);
    p.position.set(x, 1.55 / 2, 0);
    p.castShadow = true;
    root.add(p);
  }

  const net = new THREE.Mesh(
    new THREE.BoxGeometry(COURT_WIDTH, NET_CENTER_HEIGHT, 0.02),
    netMat,
  );
  net.position.set(0, NET_CENTER_HEIGHT / 2, 0);
  root.add(net);

  return root;
}

/**
 * Blender scene used Y = length (court along Y). GLTF Y-up export maps
 * Blender Y -> Three.js Y (up), Blender X -> Three X, Blender Z -> Three -Z
 * or similar depending on export_yup.
 *
 * Our Blender script places length along Y and width along X, Z up.
 * With export_yup=True: Blender Z-up -> Three Y-up:
 *   Blender X -> Three X
 *   Blender Y -> Three -Z  (or Z depending on version)
 *   Blender Z -> Three Y
 *
 * We detect orientation from net empties / mesh bounds and normalize so
 * court length is along Three.js Z, width along X, up along Y.
 */
export function normalizeCourtOrientation(root) {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);

  // If the long axis is along Y (unexpected) or X, rotate into Z-length.
  // Expected after yup: length (~13.4) along Z or -Z, width (~6.1) along X.
  if (size.x > size.z + 1 && size.x > 10) {
    // Length ended up on X — rotate 90° around Y
    root.rotation.y = Math.PI / 2;
    root.updateMatrixWorld(true);
  }
}
