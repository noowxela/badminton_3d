import { SCORE_TO_WIN, SCORE_CAP, WIN_BY, TEAM } from '../court/constants.js';

export class MatchScore {
  constructor() {
    this.a = 0;
    this.b = 0;
    this.winner = null;
    /** Side that serves next */
    this.serverTeam = TEAM.A;
  }

  reset() {
    this.a = 0;
    this.b = 0;
    this.winner = null;
    this.serverTeam = TEAM.A;
  }

  /**
   * Rally-point scoring. Point to `team`.
   * @returns {{ pointTo: string, matchOver: boolean }}
   */
  awardPoint(team) {
    if (this.winner) return { pointTo: team, matchOver: true };

    if (team === TEAM.A) this.a += 1;
    else this.b += 1;

    this.serverTeam = team;

    if (this.checkWin()) {
      return { pointTo: team, matchOver: true };
    }
    return { pointTo: team, matchOver: false };
  }

  checkWin() {
    const a = this.a;
    const b = this.b;
    // Cap at 30
    if (a >= SCORE_CAP || b >= SCORE_CAP) {
      this.winner = a > b ? TEAM.A : TEAM.B;
      return true;
    }
    if (a >= SCORE_TO_WIN || b >= SCORE_TO_WIN) {
      if (Math.abs(a - b) >= WIN_BY) {
        this.winner = a > b ? TEAM.A : TEAM.B;
        return true;
      }
    }
    return false;
  }
}
