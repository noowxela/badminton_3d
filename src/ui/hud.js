export class Hud {
  constructor() {
    this.scoreA = document.getElementById('score-a');
    this.scoreB = document.getElementById('score-b');
    this.status = document.getElementById('status');
  }

  setScore(a, b) {
    this.scoreA.textContent = String(a);
    this.scoreB.textContent = String(b);
  }

  setStatus(text) {
    this.status.textContent = text;
  }
}
