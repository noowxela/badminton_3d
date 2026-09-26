import * as THREE from 'three';
import { HALF_LENGTH, HALF_WIDTH, TEAM } from '../court/constants.js';
import { computeHitVelocity } from '../physics/shuttle.js';

const REACH = 1.55;
const HIT_COOLDOWN = 0.28;

/**
 * Low-poly player (procedural stub).
 */
export class Player {
  constructor({ id, team, home, isHuman = false, color = 0x3a7bd5 }) {
    this.id = id;
    this.team = team;
    this.home = home.clone();
    this.isHuman = isHuman;
    this.speed = isHuman ? 5.8 : 5.0;
    this.reach = isHuman ? REACH + 0.15 : REACH;
    this.cooldown = 0;
    this.aimPoint = new THREE.Vector3(0, 0, team === TEAM.A ? 4 : -4);

    this.group = new THREE.Group();
    this.group.name = id;
    this.group.position.copy(home);

    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.55 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 1.0, 10), bodyMat);
    body.position.y = 0.7;
    body.castShadow = true;
    this.group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), bodyMat);
    head.position.y = 1.35;
    head.castShadow = true;
    this.group.add(head);

    const racketMat = new THREE.MeshStandardMaterial({
      color: 0x2a2e35,
      roughness: 0.3,
      metalness: 0.4,
    });
    this.racket = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.35, 8), racketMat);
    handle.position.y = -0.05;
    this.racket.add(handle);
    const headR = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.012, 6, 14), racketMat);
    headR.rotation.x = Math.PI / 2;
    headR.position.y = 0.18;
    this.racket.add(headR);
    this.racket.position.set(0.35, 0.95, 0.1);
    this.group.add(this.racket);

    this._faceSign = team === TEAM.A ? 1 : -1;
  }

  get position() {
    return this.group.position;
  }

  getHitPoint() {
    return new THREE.Vector3(
      this.position.x + 0.2 * this._faceSign,
      1.05,
      this.position.z + 0.25 * this._faceSign,
    );
  }

  clampToHalf() {
    const p = this.position;
    p.x = THREE.MathUtils.clamp(p.x, -HALF_WIDTH + 0.3, HALF_WIDTH - 0.3);
    if (this.team === TEAM.A) {
      p.z = THREE.MathUtils.clamp(p.z, -HALF_LENGTH + 0.3, -0.4);
    } else {
      p.z = THREE.MathUtils.clamp(p.z, 0.4, HALF_LENGTH - 0.3);
    }
    p.y = 0;
  }

  moveToward(target, dt, maxSpeed = null) {
    const speed = maxSpeed ?? this.speed;
    const p = this.position;
    const dx = target.x - p.x;
    const dz = target.z - p.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) return;
    const step = Math.min(dist, speed * dt);
    p.x += (dx / dist) * step;
    p.z += (dz / dist) * step;
    this.clampToHalf();
    this.group.rotation.y = Math.atan2(dx, dz);
  }

  /** WASD relative to camera looking from -Z toward +Z (net / opponent). */
  moveHuman(input, dt) {
    if (!this.isHuman) return;
    const p = this.position;
    let dx = 0;
    let dz = 0;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;
    if (input.forward) dz += 1; // toward net
    if (input.back) dz -= 1;
    if (dx === 0 && dz === 0) return;
    const len = Math.hypot(dx, dz);
    dx /= len;
    dz /= len;
    p.x += dx * this.speed * dt;
    p.z += dz * this.speed * dt;
    this.clampToHalf();
    this.group.rotation.y = Math.atan2(dx, dz);
  }

  updateCooldown(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
  }

  canHit(shuttle) {
    if (this.cooldown > 0 || !shuttle.inPlay) return false;
    const hit = this.getHitPoint();
    const d = hit.distanceTo(shuttle.position);
    const onSide =
      this.team === TEAM.A ? shuttle.position.z < 0.45 : shuttle.position.z > -0.45;
    return onSide && d < this.reach && shuttle.position.y < 2.6 && shuttle.position.y > 0.25;
  }

  tryHit(shuttle, aimWorld = null) {
    if (!this.canHit(shuttle)) return false;
    const from = shuttle.position.clone();
    const target =
      aimWorld?.clone() ??
      this.aimPoint.clone() ??
      new THREE.Vector3(
        (Math.random() - 0.5) * (HALF_WIDTH * 1.4),
        0,
        this.team === TEAM.A ? 3 + Math.random() * 3 : -(3 + Math.random() * 3),
      );
    target.y = 0.05;
    // Keep aim on opponent half
    if (this.team === TEAM.A) target.z = Math.max(0.8, target.z);
    else target.z = Math.min(-0.8, target.z);

    const dist = from.distanceTo(target);
    const flightTime = THREE.MathUtils.clamp(dist / 9, 0.7, 1.15);
    const loft = 3.2 + Math.random() * 1.0;
    const vel = computeHitVelocity(from, target, loft, flightTime);
    vel.x += (Math.random() - 0.5) * 0.35;
    vel.z += (Math.random() - 0.5) * 0.25;

    shuttle.hit(vel, this.team);
    this.cooldown = HIT_COOLDOWN;
    this.racket.rotation.x = -0.8;
    return true;
  }

  updateVisual(dt) {
    this.racket.rotation.x = THREE.MathUtils.damp(this.racket.rotation.x, 0, 8, dt);
  }
}

export function createDoublesRoster(scene) {
  const human = new Player({
    id: 'P1_Human',
    team: TEAM.A,
    home: new THREE.Vector3(1.4, 0, -4.5),
    isHuman: true,
    color: 0x3a7bd5,
  });
  const partner = new Player({
    id: 'P2_Partner',
    team: TEAM.A,
    home: new THREE.Vector3(-1.4, 0, -3.0),
    isHuman: false,
    color: 0x5a9bf0,
  });
  const aiFront = new Player({
    id: 'P3_AI_Front',
    team: TEAM.B,
    home: new THREE.Vector3(-1.4, 0, 3.0),
    isHuman: false,
    color: 0xe85d3a,
  });
  const aiBack = new Player({
    id: 'P4_AI_Back',
    team: TEAM.B,
    home: new THREE.Vector3(1.4, 0, 4.8),
    isHuman: false,
    color: 0xc44a2d,
  });

  const players = [human, partner, aiFront, aiBack];
  for (const p of players) scene.add(p.group);
  return { human, partner, aiFront, aiBack, players };
}
