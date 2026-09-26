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

    const server =
      team === TEAM.A
        ? this.human
        : this.players.find((p) => p.team === TEAM.B && p.id.includes('Back')) ||
          this.players.find((p) => p.team === TEAM.B);
    if (server) {
      server.position.set(pos.x, 0, pos.z - (team === TEAM.A ? 0.5 : -0.5));
      server.clampToHalf();
    }

    // Reset non-servers toward home
    for (const p of this.players) {
      if (p === server) continue;
      p.position.copy(p.home);
      p.clampToHalf();
    }

    const who = team === TEAM.A ? 'Your serve — Space / Click to serve' : 'AI serving…';
    this.hud.setStatus(who);
    this.hud.setScore(this.score.a, this.score.b);

    if (team === TEAM.B) {
      this.messageTimer = 0.7;
      this._aiServePending = true;
    } else {
      this._aiServePending = false;
      this._attachShuttleToServer();
    }
  }

  /** Keep shuttle perched near human racket while waiting to serve. */
  _attachShuttleToServer() {
    if (this.state !== 'serving' || this.score.serverTeam !== TEAM.A) return;
    const hp = this.human.position;
    this.shuttle.position.set(hp.x + 0.32, 1.12, hp.z + 0.42);
    this.shuttle.velocity.set(0, 0, 0);
    this.shuttle.inPlay = false;
    this.shuttle.syncMesh();
  }

  doServe(team) {
    // Serve from current shuttle pose (near server)
    const from = this.shuttle.position.clone();
    from.y = Math.max(from.y, 1.05);

    const target = new THREE.Vector3(
      (Math.random() - 0.5) * 2.2,
      0.05,
      team === TEAM.A ? 3.8 + Math.random() * 1.8 : -(3.8 + Math.random() * 1.8),
    );
    const dist = from.distanceTo(target);
    const flightTime = THREE.MathUtils.clamp(dist / 9.5, 0.9, 1.15);
    const vel = computeHitVelocity(from, target, 4.0, flightTime);
    vel.y = Math.max(vel.y, 4.2);
    this.shuttle.serve(from, vel, team);
    this.state = 'playing';
    this.hud.setStatus('Rally!');
    this._aiServePending = false;
  }

  setAimFromMouse(mouseNdc, camera) {
    this.raycaster.setFromCamera(mouseNdc, camera);
    const hit = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.groundPlane, hit)) {
      hit.x = THREE.MathUtils.clamp(hit.x, -HALF_WIDTH + 0.2, HALF_WIDTH - 0.2);
      hit.z = THREE.MathUtils.clamp(hit.z, 0.6, HALF_LENGTH - 0.3);
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
    if (event === 'net' || event === 'out') {
      // Fault by the team that last hit
      pointTo = this.shuttle.lastHitBy === TEAM.A ? TEAM.B : TEAM.A;
    } else if (event === 'floor') {
      // In-bounds floor: point to the team on the *other* half
      // land z>0 (B half) → A scores; land z<0 (A half) → B scores
      pointTo = this.shuttle.position.z > 0 ? TEAM.A : TEAM.B;
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

    // Shuttle stays near human while waiting to serve
    if (this.state === 'serving' && this.score.serverTeam === TEAM.A) {
      this._attachShuttleToServer();
    }

    this.ai.update(dt, this.shuttle, this.state);
  }
}
