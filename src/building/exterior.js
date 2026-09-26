import * as THREE from 'three';
import {
  COURT_LENGTH,
  COURT_WIDTH,
  HALL_FLOOR_PAD,
  HALL_WALL_H,
  HALL_DOOR_W,
  HALL_DOOR_H,
} from '../court/constants.js';

/** Shared hall footprint (matches procedural court surround). */
export const HALL = Object.freeze({
  floorPad: HALL_FLOOR_PAD,
  wallH: HALL_WALL_H,
  wallT: 0.22,
  get roomW() {
    return COURT_WIDTH + this.floorPad * 2 + 0.2;
  },
  get roomL() {
    return COURT_LENGTH + this.floorPad * 2 + 0.2;
  },
});

export const DOOR = Object.freeze({
  width: HALL_DOOR_W,
  height: HALL_DOOR_H,
  thickness: 0.08,
});

/**
 * Exterior badminton-hall shell: facade, roof, sides, ground, hinged door.
 * Door sits on the near (−Z) face; hinge on −X side of opening.
 */
export function createExteriorBuilding() {
  const group = new THREE.Group();
  group.name = 'ExteriorBuilding';

  const { roomW, roomL, wallH, wallT } = HALL;
  const extW = roomW + 0.6;
  // Facade flush with interior near wall so doorways line up.
  const nearZ = -roomL / 2;
  const farZ = roomL / 2 + 0.4;
  const extL = farZ - nearZ;
  const extCenterZ = (nearZ + farZ) / 2;
  const extH = wallH + 0.4;

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xb8bcc2,
    roughness: 0.92,
    metalness: 0.05,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x3a5a8c,
    roughness: 0.7,
    metalness: 0.1,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x4a5560,
    roughness: 0.85,
    metalness: 0.15,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xe8ecf0,
    roughness: 0.6,
    metalness: 0.05,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x7ec8e8,
    roughness: 0.2,
    metalness: 0.3,
    transparent: true,
    opacity: 0.65,
  });
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x5a7a4a,
    roughness: 1,
  });
  const pathMat = new THREE.MeshStandardMaterial({
    color: 0x8a8e94,
    roughness: 0.95,
  });
  const doorMat = new THREE.MeshStandardMaterial({
    color: 0x2c4a6e,
    roughness: 0.55,
    metalness: 0.15,
  });
  const handleMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    roughness: 0.35,
    metalness: 0.7,
  });

  // Ground plane around building
  const ground = new THREE.Mesh(new THREE.BoxGeometry(60, 0.08, 60), groundMat);
  ground.position.y = -0.08;
  ground.receiveShadow = true;
  group.add(ground);

  // Approach path to door
  const path = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.04, 8), pathMat);
  path.position.set(0, 0.01, nearZ - 4);
  path.receiveShadow = true;
  group.add(path);

  // Side walls (exterior)
  for (const x of [-extW / 2, extW / 2]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(wallT, extH, extL), wallMat);
    side.position.set(x, extH / 2, extCenterZ);
    side.castShadow = true;
    side.receiveShadow = true;
    group.add(side);
  }

  // Far wall
  const far = new THREE.Mesh(new THREE.BoxGeometry(extW, extH, wallT), wallMat);
  far.position.set(0, extH / 2, farZ);
  far.castShadow = true;
  far.receiveShadow = true;
  group.add(far);

  // Near facade — left / right / lintel around door opening
  const doorW = DOOR.width;
  const doorH = DOOR.height;
  const sidePanelW = (extW - doorW) / 2;

  const facadeLeft = new THREE.Mesh(
    new THREE.BoxGeometry(sidePanelW, extH, wallT),
    wallMat,
  );
  facadeLeft.position.set(-(doorW / 2 + sidePanelW / 2), extH / 2, nearZ);
  facadeLeft.castShadow = true;
  facadeLeft.receiveShadow = true;
  group.add(facadeLeft);

  const facadeRight = facadeLeft.clone();
  facadeRight.position.x = doorW / 2 + sidePanelW / 2;
  group.add(facadeRight);

  const lintelH = extH - doorH;
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorW, lintelH, wallT), wallMat);
  lintel.position.set(0, doorH + lintelH / 2, nearZ);
  lintel.castShadow = true;
  lintel.receiveShadow = true;
  group.add(lintel);

  // Accent band above windows
  const band = new THREE.Mesh(new THREE.BoxGeometry(extW + 0.1, 0.35, wallT * 1.1), accentMat);
  band.position.set(0, extH - 1.2, nearZ - 0.02);
  group.add(band);

  // Windows on facade side panels
  const winGeo = new THREE.PlaneGeometry(1.4, 1.6);
  for (const x of [-(doorW / 2 + sidePanelW * 0.55), doorW / 2 + sidePanelW * 0.55]) {
    const win = new THREE.Mesh(winGeo, glassMat);
    win.position.set(x, 4.2, nearZ - wallT / 2 - 0.01);
    group.add(win);
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(1.55, 1.75, 0.06),
      trimMat,
    );
    frame.position.set(x, 4.2, nearZ - wallT / 2);
    group.add(frame);
  }

  // Sign above door
  const sign = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.55, 0.08), accentMat);
  sign.position.set(0, doorH + 0.55, nearZ - wallT / 2 - 0.04);
  group.add(sign);

  // Simple pitched roof (two slabs)
  const roofOverhang = 0.6;
  const roofLen = extL + roofOverhang * 2;
  const roofW = extW / 2 + 0.4;
  const pitch = 0.22;
  for (const side of [-1, 1]) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(roofW, 0.18, roofLen), roofMat);
    slab.position.set(side * (roofW / 2 - 0.15), extH + 0.6, extCenterZ);
    slab.rotation.z = side * -pitch;
    slab.castShadow = true;
    group.add(slab);
  }

  // Door pivot at left hinge (world −X of opening), on near face
  const doorPivot = new THREE.Group();
  doorPivot.name = 'DoorPivot';
  doorPivot.position.set(-doorW / 2, 0, nearZ);
  group.add(doorPivot);

  const doorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(doorW, doorH, DOOR.thickness),
    doorMat,
  );
  doorMesh.name = 'HallDoor';
  doorMesh.position.set(doorW / 2, doorH / 2, 0);
  doorMesh.castShadow = true;
  doorMesh.receiveShadow = true;
  doorMesh.userData.isDoor = true;
  doorPivot.add(doorMesh);

  // Door panels / handle for readability
  const panelInset = new THREE.Mesh(
    new THREE.BoxGeometry(doorW * 0.38, doorH * 0.35, 0.02),
    trimMat,
  );
  panelInset.position.set(doorW / 2, doorH * 0.65, -DOOR.thickness / 2 - 0.01);
  doorPivot.add(panelInset);
  const panelInset2 = panelInset.clone();
  panelInset2.position.y = doorH * 0.28;
  doorPivot.add(panelInset2);

  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 10), handleMat);
  handle.rotation.z = Math.PI / 2;
  handle.position.set(doorW - 0.2, doorH * 0.5, -DOOR.thickness / 2 - 0.04);
  doorPivot.add(handle);

  // Invisible slightly larger hit target for easier raycast
  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(doorW + 0.8, doorH + 0.45, 0.8),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hit.name = 'HallDoorHit';
  hit.position.set(doorW / 2, doorH / 2, 0);
  hit.userData.isDoor = true;
  doorPivot.add(hit);

  let openAmount = 0; // 0 closed → 1 fully open
  let targetOpen = 0;

  function setDoorHover(hovered) {
    targetOpen = hovered ? 1 : 0;
  }

  function setDoorOpenImmediate(amount) {
    openAmount = THREE.MathUtils.clamp(amount, 0, 1);
    targetOpen = openAmount;
    doorPivot.rotation.y = -openAmount * (Math.PI * 0.72);
  }

  function updateDoor(dt) {
    const speed = 3.2;
    if (Math.abs(openAmount - targetOpen) < 0.001) {
      openAmount = targetOpen;
    } else {
      openAmount = THREE.MathUtils.damp(openAmount, targetOpen, speed, dt);
    }
    // Swing inward (+ into hall = negative Y rot for hinge on −X)
    doorPivot.rotation.y = -openAmount * (Math.PI * 0.72);
    return openAmount;
  }

  const doorTargets = [doorMesh, hit];

  return {
    group,
    doorPivot,
    doorMesh,
    doorTargets,
    nearZ,
    extW,
    extL,
    extH,
    doorW,
    doorH,
    get openAmount() {
      return openAmount;
    },
    setDoorHover,
    setDoorOpenImmediate,
    updateDoor,
  };
}

/** Outdoor sky / fog while in exterior view. */
export function applyExteriorAtmosphere(scene) {
  scene.background = new THREE.Color(0x87b5d9);
  scene.fog = new THREE.Fog(0x9ec4e0, 40, 90);
}
