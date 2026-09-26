import * as THREE from 'three';
import { NET_CENTER_HEIGHT, HALF_LENGTH, HALF_WIDTH } from '../court/constants.js';

/** Lightweight shuttle physics: gravity + quadratic drag (tuned for playable rallies). */
export class Shuttle {
  constructor() {
    this.position = new THREE.Vector3(0, 1.2, -3);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.inPlay = false;
    this.gravity = -9.8;
    // Was 0.55 — killed serves before the net. 0.12 feels shuttle-like but playable.
    this.drag = 0.12;
    this.radius = 0.035;
    this.lastHitBy = null; // 'A' | 'B'
    this.bounces = 0;

    const geo = new THREE.SphereGeometry(this.radius, 10, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0xf5f2e8, roughness: 0.4 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.mesh.visible = false;
  }

  reset(pos, vel = null) {
    this.position.copy(pos);
    if (vel) this.velocity.copy(vel);
    else this.velocity.set(0, 0, 0);
    this.inPlay = false;
    this.bounces = 0;
    this.mesh.visible = true;
    this.syncMesh();
  }

  serve(pos, vel, team) {
    this.reset(pos, vel);
    this.inPlay = true;
    this.lastHitBy = team;
  }

  hit(velocity, team) {
    this.velocity.copy(velocity);
    this.inPlay = true;
    this.lastHitBy = team;
    this.mesh.visible = true;
  }

  syncMesh() {
    this.mesh.position.copy(this.position);
  }

  /**
   * @returns {'none'|'floor'|'out'|'net'} event
   */
  update(dt) {
    if (!this.inPlay) {
      this.syncMesh();
      return 'none';
    }

    const v = this.velocity;
    const speed = v.length();
    const ax = -this.drag * speed * v.x;
    const ay = this.gravity - this.drag * speed * v.y;
    const az = -this.drag * speed * v.z;

    v.x += ax * dt;
    v.y += ay * dt;
    v.z += az * dt;

    this.position.x += v.x * dt;
    this.position.y += v.y * dt;
    this.position.z += v.z * dt;

    // Net collision (thin plane at z=0)
    if (
      Math.abs(this.position.z) < 0.06 &&
      this.position.y < NET_CENTER_HEIGHT + 0.02 &&
      this.position.y > 0.1 &&
      Math.abs(this.position.x) < HALF_WIDTH + 0.1
    ) {
      const crossing =
        (this.position.z - v.z * dt) * this.position.z <= 0 || Math.abs(this.position.z) < 0.06;
      if (crossing && this.position.y < NET_CENTER_HEIGHT) {
        this.inPlay = false;
        this.velocity.set(0, 0, 0);
        this.syncMesh();
        return 'net';
      }
    }

    if (this.position.y <= this.radius) {
      this.position.y = this.radius;
      this.inPlay = false;
      this.velocity.set(0, 0, 0);
      this.syncMesh();

      const inBounds =
        Math.abs(this.position.x) <= HALF_WIDTH && Math.abs(this.position.z) <= HALF_LENGTH;
      return inBounds ? 'floor' : 'out';
    }

    if (
      Math.abs(this.position.x) > HALF_WIDTH + 3 ||
      Math.abs(this.position.z) > HALF_LENGTH + 3 ||
      this.position.y > 12
    ) {
      this.inPlay = false;
      this.syncMesh();
      return 'out';
    }

    this.syncMesh();
    return 'none';
  }

  predictLandingZ() {
    return this.predictLanding().z;
  }

  predictLanding() {
    const p = this.position.clone();
    const v = this.velocity.clone();
    const dt = 1 / 60;
    for (let i = 0; i < 240; i++) {
      const speed = v.length();
      v.x += -this.drag * speed * v.x * dt;
      v.y += (this.gravity - this.drag * speed * v.y) * dt;
      v.z += -this.drag * speed * v.z * dt;
      p.addScaledVector(v, dt);
      if (p.y <= this.radius) break;
    }
    return p;
  }
}

/**
 * Drag-compensated hit velocity toward a landing target; clears the net.
 */
export function computeHitVelocity(from, target, loft = 3.5, flightTime = 0.95) {
  const dx = target.x - from.x;
  const dz = target.z - from.z;
  const dy = target.y - from.y;
  const t = Math.max(0.55, flightTime);
  const g = -9.8;
  const drag = 0.12;

  // Boost horizontal for quadratic drag over the flight
  const comp = 1 + drag * t * 3.5;
  let vx = (dx / t) * comp;
  let vz = (dz / t) * comp;
  let vy = (dy - 0.5 * g * t * t) / t + loft * 0.35;

  // Ensure clearance over net at z=0
  const distZ = Math.abs(dz) || 0.01;
  const tNet = t * (Math.abs(from.z) / distZ);
  if (tNet > 0.08 && tNet < t * 1.2) {
    const clearNet = 2.05;
    const yAtNet = from.y + vy * tNet + 0.5 * g * tNet * tNet;
    if (yAtNet < clearNet) {
      vy += (clearNet - yAtNet) / tNet;
    }
  }
  // Extra loft pad so drag doesn't drop the bird into the tape
  vy += 1.0 + drag * t * 1.5;
  vy = Math.max(vy, 3.8);

  return new THREE.Vector3(vx, vy, vz);
}
