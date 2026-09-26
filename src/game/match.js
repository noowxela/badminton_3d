import * as THREE from 'three';
import { TEAM, HALF_LENGTH, HALF_WIDTH } from '../court/constants.js';
import { MatchScore } from './scoring.js';
import { computeHitVelocity } from '../physics/shuttle.js';

/**
 * Match / rally state machine.
 * States: idle | serving | playing | point | matchover
 */
export class Match {
  constructor({ shuttle, human, players, hud, ai }) {
    this.shuttle = shuttle;
    this.human = human;
    this.players = players;
    this.hud = hud;
    this.ai = ai;
    this.score = new MatchScore();
    this.state = 'idle';
    this.messageTimer = 0;
    this.pendingPoint = null;

    this.aim = new THREE.Vector3(0, 0, 4);
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }

  start() {
    this.score.reset();
    this.hud.setScore(0, 0);
    this.prepareServe();
  }

  prepareServe() {
    this.state = 'serving';
    const team = this.score.serverTeam;
    const z = team === TEAM.A ? -HALF_LENGTH + 1.2 : HALF_LENGTH - 1.2;
    const x = 1.5;
    const pos = new THREE.Vector3(team === TEAM.A ? x : -x, 1.15, z);
    this.shuttle.reset(pos);
    this.shuttle.inPlay = false;
    this.shuttle.lastHitBy = null;

    // Place server near shuttle
    const server =
      team === TEAM.A
        ? this.human
        : this.players.find((p) => p.team === TEAM.B && p.id.includes('Back')) ||
          this.players.find((p) => p.team === TEAM.B);
    if (server) {
      server.position.set(pos.x, 0, pos.z - (team === TEAM.A ? 0.5 : -0.5));
      server.clampToHalf();
    }

    const who = team === TEAM.A ? 'Your serve — Space / Click to serve' : 'AI serving…';
    this.hud.setStatus(who);
    this.hud.setScore(this.score.a, this.score.b);

    if (team === TEAM.B) {
      // Auto-serve after short delay
      this.messageTimer = 0.7;
      this._aiServePending = true;
    } else {
      this._aiServePending = false;
    }
  }

  doServe(team) {
    const from = this.shuttle.position.clone();
    const target = new THREE.Vector3(
      (Math.random() - 0.5) * 2.5,
      0.05,
      team === TEAM.A ? 3.5 + Math.random() * 2 : -(3.5 + Math.random() * 2),
    );
    const vel = computeHitVelocity(from, target, 2.2, 0.9);
    // Serve should clear net — ensure enough upward
    vel.y = Math.max(vel.y, 3.5);
    this.shuttle.serve(from, vel, team);
    this.state = 'playing';
    this.hud.setStatus('Rally!');
    this._aiServePending = false;
  }

  setAimFromMouse(mouseNdc, camera) {
    this.raycaster.setFromCamera(mouseNdc, camera);
    const hit = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.groundPlane, hit)) {
      // Clamp aim to opponent half
      hit.x = THREE.MathUtils.clamp(hit.x, -HALF_WIDTH, HALF_WIDTH);
      hit.z = THREE.MathUtils.clamp(hit.z, 0.5, HALF_LENGTH);
      hit.y = 0.05;
      this.aim.copy(hit);
      this.human.aimPoint.copy(hit);
    }
  }

  onHitRequest() {
    if (this.state === 'serving' && this.score.serverTeam === TEAM.A) {
      this.doServe(TEAM.A);
      return;
    }
    if (this.state === 'playing') {
      this.human.tryHit(this.shuttle, this.aim);
    }
    if (this.state === 'matchover') {
      this.start();
    }
    if (this.state === 'idle') {
      this.prepareServe();
    }
  }

  resetRally() {
    if (this.score.winner) {
      this.start();
      return;
    }
    this.prepareServe();
  }

  /**
   * Resolve shuttle contact result into a point.
   */
  onShuttleEvent(event) {
    if (this.state !== 'playing') return;
    if (event === 'none') return;

    let pointTo = null;
    // lastHitBy failed if net / out; floor on opponent side = point to hitter
    if (event === 'net' || event === 'out') {
      pointTo = this.shuttle.lastHitBy === TEAM.A ? TEAM.B : TEAM.A;
    } else if (event === 'floor') {
      // Landed in bounds: point to the team that hit it (opponent failed to return)
      pointTo = this.shuttle.lastHitBy;
    }

    if (!pointTo) return;

    this.state = 'point';
    const result = this.score.awardPoint(pointTo);
    this.hud.setScore(this.score.a, this.score.b);

    const label = pointTo === TEAM.A ? 'Point — You' : 'Point — AI';
    if (result.matchOver) {
      this.state = 'matchover';
      const w = this.score.winner === TEAM.A ? 'You win!' : 'AI wins!';
      this.hud.setStatus(`${w}  (${this.score.a}–${this.score.b})  Space to rematch`);
    } else {
      this.hud.setStatus(`${label}  (${this.score.a}–${this.score.b})`);
      this.messageTimer = 1.2;
      this.pendingPoint = true;
    }
  }

  update(dt, input) {
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0 && this._aiServePending && this.state === 'serving') {
        this.doServe(TEAM.B);
      }
      if (this.messageTimer <= 0 && this.pendingPoint && this.state === 'point') {
        this.pendingPoint = false;
        this.prepareServe();
      }
    }

    this.human.updateCooldown(dt);
    this.human.updateVisual(dt);

    if (this.state === 'playing' || this.state === 'serving') {
      this.human.moveHuman(input, dt);
    }

    this.ai.update(dt, this.shuttle, this.state);

    // Human auto-assist: if very close and clicking held — handled via input
  }
}
