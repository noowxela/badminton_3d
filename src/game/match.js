import * as THREE from 'three';
import { TEAM, HALF_LENGTH, HALF_WIDTH } from '../court/constants.js';
import { MatchScore } from './scoring.js';
import { computeHitVelocity } from '../physics/shuttle.js';

/**
 * Match / rally state machine.
 * States: idle | serving | playing | point | matchover
 * Modes: play (human) | spectator (AI vs AI watch rally)
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

    /** @type {'play'|'spectator'} */
    this.mode = 'play';
    this._humanWasHuman = true;
    this._spectatorPointDone = false;
    this._stuckTimer = 0;
    this.onSpectatorPointEnd = null;

    this.aim = new THREE.Vector3(0, 0, 4);
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }

  start({ spectator = false } = {}) {
    this.score.reset();
    this.hud.setScore(0, 0);
    this._spectatorPointDone = false;
    this._stuckTimer = 0;
    this.setMode(spectator ? 'spectator' : 'play');
    this.prepareServe();
  }

  setMode(mode) {
    this.mode = mode === 'spectator' ? 'spectator' : 'play';
    if (this.mode === 'spectator') {
      this._humanWasHuman = this.human.isHuman;
      this.human.isHuman = false;
      this.human.speed = 5.0;
    } else {
      this.human.isHuman = true;
      this.human.speed = 5.8;
    }
    this._refreshTouchUi();
  }

  /** Switch from watch-rally into human control mid-match. */
  takeControl() {
    this.setMode('play');
    this._spectatorPointDone = false;
    this.hud.setPlayCtaVisible(false);
    this.prepareServe();
    this.hud.setStatus('Your serve — tap Serve / Space / Click');
  }

  _serveLabels() {
    const team = this.score.serverTeam;
    const youServe = team === TEAM.A;
    const serverLabel = youServe
      ? 'Serve: You · Near side (−Z)'
      : 'Serve: AI · Far side (+Z)';
    const sideLabel = 'You vs AI · You −Z · AI +Z';
    return { serverLabel, sideLabel, youServe };
  }

  prepareServe() {
    this.state = 'serving';
    this._stuckTimer = 0;
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

    const labels = this._serveLabels();
    this.hud.setMatchInfo(labels);
    this.hud.setScore(this.score.a, this.score.b);

    if (this.mode === 'spectator') {
      this.hud.setStatus('Watching rally — AI vs AI');
      this.messageTimer = 0.55;
      this._aiServePending = true;
    } else if (team === TEAM.B) {
      this.hud.setStatus('AI serving…');
      this.messageTimer = 0.7;
      this._aiServePending = true;
    } else {
      this.hud.setStatus('Your serve — tap Serve / Space / Click');
      this._aiServePending = false;
      this._attachShuttleToServer();
    }
    this._refreshTouchUi();
  }

  /** Keep shuttle perched near human racket while waiting to serve. */
  _attachShuttleToServer() {
    if (this.state !== 'serving' || this.score.serverTeam !== TEAM.A) return;
    if (this.mode === 'spectator') return;
    const hp = this.human.position;
    this.shuttle.position.set(hp.x + 0.32, 1.12, hp.z + 0.42);
    this.shuttle.velocity.set(0, 0, 0);
    this.shuttle.inPlay = false;
    this.shuttle.syncMesh();
  }

  doServe(team) {
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
    this._stuckTimer = 0;
    this.hud.setStatus(this.mode === 'spectator' ? 'Watching rally…' : 'Rally!');
    this._aiServePending = false;
    this._refreshTouchUi();
  }

  setAimFromMouse(mouseNdc, camera) {
    if (this.mode === 'spectator') return;
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
    if (this.mode === 'spectator') return;
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
      this.start({ spectator: this.mode === 'spectator' });
      return;
    }
    this._stuckTimer = 0;
    this.pendingPoint = false;
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
      pointTo = this.shuttle.lastHitBy === TEAM.A ? TEAM.B : TEAM.A;
    } else if (event === 'floor') {
      pointTo = this.shuttle.position.z > 0 ? TEAM.A : TEAM.B;
    }

    if (!pointTo) return;

    this.state = 'point';
    this._stuckTimer = 0;
    const result = this.score.awardPoint(pointTo);
    this.hud.setScore(this.score.a, this.score.b);
    this.hud.setMatchInfo(this._serveLabels());

    const label = pointTo === TEAM.A ? 'Point — You' : 'Point — AI';

    if (this.mode === 'spectator') {
      this._spectatorPointDone = true;
      this.hud.setStatus(`${label}  (${this.score.a}–${this.score.b}) — tap Play to take control`);
      this.hud.setPlayCtaVisible(true);
      this._refreshTouchUi();
      if (typeof this.onSpectatorPointEnd === 'function') {
        this.onSpectatorPointEnd({ pointTo, score: { a: this.score.a, b: this.score.b } });
      }
      return;
    }

    if (result.matchOver) {
      this.state = 'matchover';
      const w = this.score.winner === TEAM.A ? 'You win!' : 'AI wins!';
      this.hud.setStatus(`${w}  (${this.score.a}–${this.score.b})  Space / New rally to rematch`);
    } else {
      this.hud.setStatus(`${label}  (${this.score.a}–${this.score.b})`);
      this.messageTimer = 1.2;
      this.pendingPoint = true;
    }
    this._refreshTouchUi();
  }

  _refreshTouchUi() {
    if (this.mode === 'spectator') {
      this.hud.setTouchButtons({ serve: false, hit: false, rallyUrgent: false });
      return;
    }
    const youServe = this.state === 'serving' && this.score.serverTeam === TEAM.A;
    const canHit = this.state === 'playing';
    const dead =
      this.state === 'point' ||
      this.state === 'idle' ||
      this.state === 'matchover' ||
      (this.state === 'playing' && !this.shuttle.inPlay);
    this.hud.setTouchButtons({
      serve: youServe,
      hit: canHit,
      rallyUrgent: dead && this.state !== 'serving',
    });
  }

  /**
   * True when shuttle is dead / off-play and rally is stuck waiting for reset.
   */
  needsRallyReset() {
    if (this.mode === 'spectator' && this._spectatorPointDone) return false;
    if (this.state === 'matchover' || this.state === 'idle') return true;
    if (this.state === 'point' && !this.pendingPoint) return true;
    if (this.state === 'playing' && !this.shuttle.inPlay) return true;
    return false;
  }

  update(dt, input) {
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0 && this._aiServePending && this.state === 'serving') {
        this.doServe(this.score.serverTeam);
      }
      if (this.messageTimer <= 0 && this.pendingPoint && this.state === 'point') {
        this.pendingPoint = false;
        this.prepareServe();
      }
    }

    // Stuck / dead shuttle watchdog — never leave play frozen.
    if (this.state === 'playing') {
      if (!this.shuttle.inPlay) {
        this._stuckTimer += dt;
        if (this._stuckTimer > 0.6) {
          this._stuckTimer = 0;
          // Treat as out if last-hit known, else soft reset.
          if (this.shuttle.lastHitBy) {
            this.onShuttleEvent('out');
          } else {
            this.hud.setStatus('Shuttle dead — New rally');
            this._refreshTouchUi();
          }
        }
      } else {
        this._stuckTimer = 0;
        // Off-screen / runaway bird
        const p = this.shuttle.position;
        if (
          Math.abs(p.x) > HALF_WIDTH + 4 ||
          Math.abs(p.z) > HALF_LENGTH + 4 ||
          p.y > 14 ||
          p.y < -0.5
        ) {
          this.onShuttleEvent('out');
        }
      }
    }

    this.human.updateCooldown(dt);
    this.human.updateVisual(dt);

    if (this.mode === 'play' && (this.state === 'playing' || this.state === 'serving')) {
      this.human.moveHuman(input, dt);
    }

    if (
      this.mode === 'play' &&
      this.state === 'serving' &&
      this.score.serverTeam === TEAM.A
    ) {
      this._attachShuttleToServer();
    }

    // In spectator mode human is treated as AI by SimpleAi (!isHuman).
    this.ai.update(dt, this.shuttle, this.state);

    // Keep touch button state fresh (serve/hit/urgent).
    if (this.mode === 'play') this._refreshTouchUi();
  }
}
