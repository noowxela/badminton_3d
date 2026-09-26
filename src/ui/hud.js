import { COURT_STYLES } from '../court/loadCourt.js';

export class Hud {
  constructor() {
    this.scoreA = document.getElementById('score-a');
    this.scoreB = document.getElementById('score-b');
    this.status = document.getElementById('status');
    this.styleBar = document.getElementById('court-style');
    this.camControls = document.getElementById('cam-controls');
    this.controlsHint = document.getElementById('controls-hint');
    if (this.controlsHint) {
      this.controlsHint.textContent =
        'WASD move · Mouse aim · Click / Space hit · Right-drag orbit · Wheel zoom · R reset rally';
    }
  }

  setScore(a, b) {
    this.scoreA.textContent = String(a);
    this.scoreB.textContent = String(b);
  }

  setStatus(text) {
    this.status.textContent = text;
  }

  /**
   * Wire court-style toggle buttons. Calls onChange(styleId) when user picks.
   */
  setCourtStyle(activeId, onChange) {
    if (!this.styleBar) return;
    this.styleBar.innerHTML = '';
    const label = document.createElement('span');
    label.className = 'style-label';
    label.textContent = 'Court';
    this.styleBar.appendChild(label);

    for (const id of Object.keys(COURT_STYLES)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'style-btn' + (id === activeId ? ' active' : '');
      btn.dataset.style = id;
      btn.textContent = COURT_STYLES[id].label;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (btn.classList.contains('active')) return;
        for (const b of this.styleBar.querySelectorAll('.style-btn')) {
          b.classList.toggle('active', b === btn);
        }
        onChange(id);
      });
      this.styleBar.appendChild(btn);
    }
  }

  /** Wire Reset view button that restores the default broadcast camera. */
  setResetView(onReset) {
    if (!this.camControls) return;
    this.camControls.innerHTML = '';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cam-btn';
    btn.id = 'reset-view';
    btn.textContent = 'Reset view';
    btn.title = 'Restore broadcast camera';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      onReset();
    });
    this.camControls.appendChild(btn);
  }
}
