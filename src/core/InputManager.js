/**
 * Unifies desktop (WASD / Arrows) and mobile (on-screen pedals + steering) into a
 * single normalized control vector that the truck consumes. The truck code never
 * needs to know whether input came from a keyboard or a thumb.
 *
 *   throttle: 0..1   (gas)
 *   brake:    0..1   (brake / reverse)
 *   steer:   -1..1   (-1 = full left, +1 = full right)
 *   handbrake: bool
 */
export class InputManager {
  constructor() {
    this.state = { throttle: 0, brake: 0, steer: 0, handbrake: false };

    // Raw key flags; resolved into normalized state each read.
    this._keys = new Set();

    // Touch axes are written directly by the on-screen TouchControls UI.
    this._touch = { throttle: 0, brake: 0, steer: 0, handbrake: false };
    this._touchActive = false;

    this._onKeyDown = (e) => this._setKey(e, true);
    this._onKeyUp = (e) => this._setKey(e, false);
  }

  attach() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  detach() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }

  _setKey(e, isDown) {
    const code = e.code;
    const tracked = [
      'KeyW', 'KeyA', 'KeyS', 'KeyD',
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'Space',
    ];
    if (!tracked.includes(code)) return;
    e.preventDefault();
    if (isDown) this._keys.add(code);
    else this._keys.delete(code);
  }

  /** Called by the TouchControls UI module to feed mobile input. */
  setTouchAxes({ throttle, brake, steer, handbrake }) {
    this._touchActive = true;
    if (throttle !== undefined) this._touch.throttle = throttle;
    if (brake !== undefined) this._touch.brake = brake;
    if (steer !== undefined) this._touch.steer = steer;
    if (handbrake !== undefined) this._touch.handbrake = handbrake;
  }

  /** Resolve raw inputs into the normalized control vector. Call once per frame. */
  sample() {
    const k = this._keys;
    const kThrottle = k.has('KeyW') || k.has('ArrowUp') ? 1 : 0;
    const kBrake = k.has('KeyS') || k.has('ArrowDown') ? 1 : 0;
    const kSteer =
      (k.has('KeyA') || k.has('ArrowLeft') ? -1 : 0) +
      (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0);
    const kHandbrake = k.has('Space');

    // Keyboard takes priority when keys are held; otherwise fall back to touch.
    this.state.throttle = Math.max(kThrottle, this._touch.throttle);
    this.state.brake = Math.max(kBrake, this._touch.brake);
    this.state.steer = kSteer !== 0 ? kSteer : this._touch.steer;
    this.state.handbrake = kHandbrake || this._touch.handbrake;

    return this.state;
  }

  /** True if the device is touch-first (drives whether on-screen controls render). */
  static isTouchDevice() {
    return (
      typeof window !== 'undefined' &&
      ('ontouchstart' in window || navigator.maxTouchPoints > 0)
    );
  }
}
