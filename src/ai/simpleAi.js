import * as THREE from 'three';
import { TEAM, HALF_WIDTH, HALF_LENGTH } from '../court/constants.js';

/**
 * Simple doubles AI: nearest player to predicted landing covers;
 * partner holds home / mid; hit when in reach toward opponent court.
 */
export class SimpleAi {
  constructor(players) {
    this.players = players;
  }

  update(dt, shuttle, gameState) {
    const ais = this.players.filter((p) => !p.isHuman);
    for (const p of ais) {
      p.updateCooldown(dt);
      p.updateVisual(dt);
    }

    if (gameState !== 'playing' && gameState !== 'serving') {
      for (const p of ais) {
        p.moveToward(p.home, dt, p.speed * 0.7);
      }
      return;
    }

    // Group by team
    const byTeam = {
      [TEAM.A]: ais.filter((p) => p.team === TEAM.A),
      [TEAM.B]: ais.filter((p) => p.team === TEAM.B),
    };

    for (const team of [TEAM.A, TEAM.B]) {
      const mates = byTeam[team];
      if (!mates.length) continue;

      const landing = shuttle.inPlay ? shuttle.predictLanding() : null;
      const comingToUs =
        shuttle.inPlay &&
        shuttle.lastHitBy !== team &&
        (team === TEAM.A ? landing.z < 0.5 : landing.z > -0.5);

      if (comingToUs && landing) {
        // Assign closest to cover landing
        let best = mates[0];
        let bestD = Infinity;
        for (const p of mates) {
          const d = Math.hypot(p.position.x - landing.x, p.position.z - landing.z);
          if (d < bestD) {
            bestD = d;
            best = p;
          }
        }
        const cover = landing.clone();
        cover.y = 0;
        // Stay slightly behind contact
        cover.z += team === TEAM.A ? -0.35 : 0.35;
        best.moveToward(cover, dt);

        for (const p of mates) {
          if (p === best) continue;
          // Partner: balanced home / mid-court
          const support = p.home.clone();
          support.x = THREE.MathUtils.clamp(-best.position.x * 0.4 + p.home.x * 0.6, -HALF_WIDTH + 0.5, HALF_WIDTH - 0.5);
          p.moveToward(support, dt, p.speed * 0.85);
        }

        // Try hit
        if (best.canHit(shuttle)) {
          const target = this.pickTarget(team);
          best.tryHit(shuttle, target);
        }
      } else {
        // Idle / return home gently; if shuttle on our side but not predicted well, chase shuttle
        for (const p of mates) {
          if (
            shuttle.inPlay &&
            shuttle.lastHitBy !== team &&
            ((team === TEAM.A && shuttle.position.z < 0) ||
              (team === TEAM.B && shuttle.position.z > 0))
          ) {
            const chase = shuttle.position.clone();
            chase.y = 0;
            // Only closest chases
            const closest = mates.reduce((a, b) =>
              a.position.distanceTo(chase) < b.position.distanceTo(chase) ? a : b,
            );
            if (p === closest) p.moveToward(chase, dt);
            else p.moveToward(p.home, dt, p.speed * 0.6);
            if (p.canHit(shuttle)) p.tryHit(shuttle, this.pickTarget(team));
          } else {
            p.moveToward(p.home, dt, p.speed * 0.55);
          }
        }
      }
    }
  }

  pickTarget(team) {
    // Aim deep / cross-court with jitter
    const x = (Math.random() - 0.5) * HALF_WIDTH * 1.6;
    const z =
      team === TEAM.A
        ? HALF_LENGTH * (0.45 + Math.random() * 0.4)
        : -HALF_LENGTH * (0.45 + Math.random() * 0.4);
    return new THREE.Vector3(x, 0.05, z);
  }
}
