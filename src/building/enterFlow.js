import * as THREE from 'three';

/** App view states: outside building → dolly through door → gameplay. */
export const ViewState = Object.freeze({
  EXTERIOR: 'exterior',
  ENTERING: 'entering',
  INSIDE: 'inside',
});

/**
 * Raycast door hover/click + camera enter lerp + door-open polish + fade hooks.
 * Left-click only enters while exterior; once inside, caller resumes hit/serve.
 */
export class EnterFlow {
  /**
   * @param {object} opts
   * @param {THREE.Camera} opts.camera
   * @param {import('three/addons/controls/OrbitControls.js').OrbitControls} opts.controls
   * @param {ReturnType<import('./exterior.js').createExteriorBuilding>} opts.exterior
   * @param {{ x:number,y:number,z:number }} opts.interiorCamPos
   * @param {{ x:number,y:number,z:number }} opts.interiorCamTarget
   * @param {(state: string) => void} [opts.onStateChange]
   * @param {(opacity: number) => void} [opts.onFade]
   */
  constructor({
    camera,
    controls,
    exterior,
    interiorCamPos,
    interiorCamTarget,
    onStateChange,
    onFade,
  }) {
    this.camera = camera;
    this.controls = controls;
    this.exterior = exterior;
    this.interiorCamPos = interiorCamPos;
    this.interiorCamTarget = interiorCamTarget;
    this.onStateChange = onStateChange || (() => {});
    this.onFade = onFade || (() => {});

    this.state = ViewState.EXTERIOR;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.doorHovered = false;

    this._enterT = 0;
    this._enterDuration = 2.4;
    this._fromPos = new THREE.Vector3();
    this._fromTarget = new THREE.Vector3();
    this._toPos = new THREE.Vector3();
    this._toTarget = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this._doorWarmup = 0;
    this._doorWarmupDone = false;
  }

  get isExterior() {
    return this.state === ViewState.EXTERIOR;
  }

  get isEntering() {
    return this.state === ViewState.ENTERING;
  }

  get isInside() {
    return this.state === ViewState.INSIDE;
  }

  setState(next) {
    if (this.state === next) return;
    this.state = next;
    this.onStateChange(next);
  }

  /** Place camera outside facing the facade/door. */
  setupExteriorCamera() {
    const z = this.exterior.nearZ - 11;
    this.camera.position.set(0, 3.6, z);
    this.controls.target.set(0, 1.6, this.exterior.nearZ);
    this.controls.enabled = false;
    this.controls.enableRotate = false;
    this.controls.enablePan = false;
    this.controls.enableZoom = true;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 28;
    this.controls.update();
    this.controls.saveState();
    this.exterior.setDoorOpenImmediate(0);
    this.onFade(0);
    this.setState(ViewState.EXTERIOR);
  }

  updatePointer(ndcX, ndcY) {
    this.pointer.set(ndcX, ndcY);
  }

  /** Raycast door; returns whether door is under pointer (exterior only). */
  updateHover() {
    if (this.state !== ViewState.EXTERIOR) {
      this.doorHovered = false;
      this.exterior.setDoorHover(false);
      return false;
    }
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.exterior.doorTargets, true);
    const hovered = hits.length > 0;
    this.doorHovered = hovered;
    this.exterior.setDoorHover(hovered);
    return hovered;
  }

  /** Start enter transition if hovering / clicking door. Returns true if handled. */
  tryEnter() {
    if (this.state !== ViewState.EXTERIOR) return false;
    // Allow click even if slightly off hover — re-raycast.
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.exterior.doorTargets, true);
    if (!hits.length) return false;
    return this._startEnter();
  }

  /** Start entering without a raycast, for the always-visible HUD fallback. */
  forceEnter() {
    if (this.state !== ViewState.EXTERIOR) return false;
    return this._startEnter();
  }

  _startEnter() {
    // Deliberate door-open: swing fully open before / while camera moves.
    this.exterior.setDoorHover(true);
    this.exterior.setDoorOpenImmediate(Math.max(this.exterior.openAmount, 0.15));
    // Nudge target open so updateDoor animates the rest of the swing.
    this.exterior.setDoorHover(true);

    this._fromPos.copy(this.camera.position);
    this._fromTarget.copy(this.controls.target);
    this._toPos.set(this.interiorCamPos.x, this.interiorCamPos.y, this.interiorCamPos.z);
    this._toTarget.set(
      this.interiorCamTarget.x,
      this.interiorCamTarget.y,
      this.interiorCamTarget.z,
    );

    // Mid waypoint through doorway so path clears the frame
    this._midPos = new THREE.Vector3(0, 2.2, this.exterior.nearZ + 1.5);
    this._midTarget = new THREE.Vector3(0, 1.2, 2);

    this._enterT = 0;
    this._doorWarmup = 0;
    this._doorWarmupDone = false;
    this.controls.enabled = false;
    this.onFade(0);
    this.setState(ViewState.ENTERING);
    return true;
  }

  /**
   * Advance door + enter camera + fade. Call every frame.
   * @returns {'none'|'hover'|'entered'}
   */
  update(dt) {
    this.exterior.updateDoor(dt);

    if (this.state === ViewState.ENTERING) {
      // Brief door-open beat before camera commits through the frame.
      if (!this._doorWarmupDone) {
        this._doorWarmup += dt;
        this.exterior.setDoorHover(true);
        // Soft fade-up as door swings
        const warm = Math.min(1, this._doorWarmup / 0.45);
        this.onFade(warm * 0.35);
        if (this._doorWarmup >= 0.45 || this.exterior.openAmount > 0.85) {
          this._doorWarmupDone = true;
          this.exterior.setDoorOpenImmediate(1);
        }
        return 'none';
      }

      this._enterT += dt / this._enterDuration;
      const t = Math.min(1, this._enterT);
      // Smoothstep ease
      const e = t * t * (3 - 2 * t);

      // Two-segment path: outside → doorway → interior broadcast
      if (e < 0.45) {
        const u = e / 0.45;
        const eu = u * u * (3 - 2 * u);
        this.camera.position.lerpVectors(this._fromPos, this._midPos, eu);
        this.controls.target.lerpVectors(this._fromTarget, this._midTarget, eu);
      } else {
        const u = (e - 0.45) / 0.55;
        const eu = u * u * (3 - 2 * u);
        this.camera.position.lerpVectors(this._midPos, this._toPos, eu);
        this.controls.target.lerpVectors(this._midTarget, this._toTarget, eu);
      }
      this.camera.lookAt(this.controls.target);

      // Full-screen fade: peak near doorway, clear as we settle inside.
      // Triangle peak around e≈0.4–0.55 so the cut feels intentional.
      let fade = 0;
      if (e < 0.35) fade = (e / 0.35) * 0.85;
      else if (e < 0.55) fade = 0.85;
      else fade = 0.85 * (1 - (e - 0.55) / 0.45);
      this.onFade(Math.max(0, Math.min(1, fade)));

      // Keep door open during enter
      this.exterior.setDoorHover(true);

      if (t >= 1) {
        this._finishEnter();
        return 'entered';
      }
      return 'none';
    }

    return this.doorHovered ? 'hover' : 'none';
  }

  _finishEnter() {
    this.camera.position.set(this.interiorCamPos.x, this.interiorCamPos.y, this.interiorCamPos.z);
    this.controls.target.set(
      this.interiorCamTarget.x,
      this.interiorCamTarget.y,
      this.interiorCamTarget.z,
    );
    this.controls.enabled = true;
    this.controls.enableRotate = true;
    this.controls.enablePan = true;
    this.controls.enableZoom = true;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 22;
    this.controls.update();
    this.controls.saveState();
    // Leave door open after enter
    this.exterior.setDoorOpenImmediate(1);
    this.onFade(0);
    this.setState(ViewState.INSIDE);
  }
}
