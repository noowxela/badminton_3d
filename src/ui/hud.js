import { COURT_STYLES } from '../court/loadCourt.js';

export class Hud {
  constructor() {
    this.scoreA = document.getElementById('score-a');
    this.scoreB = document.getElementById('score-b');
    this.status = document.getElementById('status');
    this.enterButton = document.getElementById('enter-hall');
    this.watchButton = document.getElementById('watch-rally');
    this.playCta = document.getElementById('play-cta');
    this.styleBar = document.getElementById('court-style');
    this.camControls = document.getElementById('cam-controls');
    this.controlsHint = document.getElementById('controls-hint');
    this.scoreboard = document.getElementById('scoreboard');
    this.matchInfo = document.getElementById('match-info');
    this.serveInfo = document.getElementById('serve-info');
    this.sideInfo = document.getElementById('side-info');
    this.touchControls = document.getElementById('touch-controls');
    this.btnServe = document.getElementById('btn-serve');
    this.btnHit = document.getElementById('btn-hit');
    this.btnNewRally = document.getElementById('btn-new-rally');
    this.fadeEl = document.getElementById('enter-fade');
    if (this.controlsHint) {
      this.controlsHint.textContent = 'Tap the door or Enter hall to go inside';
    }
    if (this.sideInfo) {
      this.sideInfo.textContent = 'You −Z · AI +Z';
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
   * Serve / side clarity line under the scoreboard.
   * @param {{ serverLabel: string, sideLabel?: string }} info
   */
  setMatchInfo(info) {
    if (!this.matchInfo || !this.serveInfo) return;
    this.serveInfo.textContent = info.serverLabel;
    if (info.sideLabel && this.sideInfo) this.sideInfo.textContent = info.sideLabel;
  }

  setEnterButtonVisible(visible) {
    if (this.enterButton) this.enterButton.hidden = !visible;
    if (this.watchButton) this.watchButton.hidden = !visible;
  }

  setEnterAction(onEnter) {
    if (!this.enterButton) return;
    this.enterButton.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      onEnter();
    };
  }

  setWatchAction(onWatch) {
    if (!this.watchButton) return;
    this.watchButton.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      onWatch();
    };
  }

  setPlayCtaVisible(visible) {
    if (this.playCta) this.playCta.hidden = !visible;
  }

  setPlayCtaAction(onPlay) {
    if (!this.playCta) return;
    this.playCta.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      onPlay();
    };
  }

  /**
   * Dim / hide match HUD while outside the hall.
   * Status + hint stay visible for enter prompts.
   */
  setGameplayVisible(visible) {
    if (this.scoreboard) {
      this.scoreboard.classList.toggle('hud-dim', !visible);
      this.scoreboard.style.visibility = visible ? 'visible' : 'hidden';
    }
    if (this.matchInfo) {
      this.matchInfo.hidden = !visible;
      this.matchInfo.classList.toggle('hud-dim', !visible);
    }
    if (this.styleBar) {
      this.styleBar.classList.toggle('hud-dim', !visible);
      this.styleBar.style.visibility = visible ? 'visible' : 'hidden';
    }
    if (this.camControls) {
      this.camControls.classList.toggle('hud-dim', !visible);
      this.camControls.style.visibility = visible ? 'visible' : 'hidden';
    }
    if (this.touchControls) {
      this.touchControls.hidden = !visible;
    }
    if (!visible) {
      this.setPlayCtaVisible(false);
      this.setTouchButtons({ serve: false, hit: false, rallyUrgent: false });
    }
  }

  /**
   * Large on-screen Hit / Serve / New rally controls (especially for touch).
   */
  setTouchButtons({ serve = false, hit = false, rallyUrgent = false } = {}) {
    if (this.btnServe) this.btnServe.hidden = !serve;
    if (this.btnHit) this.btnHit.hidden = !hit;
    if (this.btnNewRally) {
      this.btnNewRally.classList.toggle('urgent', !!rallyUrgent);
    }
  }

  setTouchActions({ onServe, onHit, onNewRally }) {
    const bind = (el, fn) => {
      if (!el || !fn) return;
      const handler = (e) => {
        e.stopPropagation();
        e.preventDefault();
        fn();
      };
      el.onclick = handler;
      // Extra touchstart for snappier mobile response without waiting for click.
      el.ontouchend = (e) => {
        e.stopPropagation();
        e.preventDefault();
        fn();
      };
    };
    bind(this.btnServe, onServe);
    bind(this.btnHit, onHit);
    bind(this.btnNewRally, onNewRally);
  }

  /** Full-screen fade for enter transition. opacity 0..1 */
  setFade(opacity) {
    if (!this.fadeEl) return;
    const o = Math.max(0, Math.min(1, opacity));
    if (o > 0.02) this.fadeEl.classList.add('active');
    else this.fadeEl.classList.remove('active');
    this.fadeEl.style.opacity = String(o);
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
