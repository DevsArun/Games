import * as THREE from 'three';
import { CAMERA } from './constants.js';

/**
 * Smooth third-person chase camera. Trails the truck from behind + above and aims
 * slightly ahead of it, with framerate-independent damping for a cinematic feel.
 */
export class CameraController {
  /** @param {THREE.PerspectiveCamera} camera */
  constructor(camera) {
    this.camera = camera;
    this._desired = new THREE.Vector3();
    this._lookAt = new THREE.Vector3();
    this._tmpForward = new THREE.Vector3();
    this.enabled = false;
    this.mode = 'cockpit'; // 'cockpit' (first-person) | 'chase'
  }

  setMode(mode) {
    this.mode = mode;
  }

  /** Snap instantly to the target (used when a run starts). */
  snap(target) {
    if (this.mode === 'cockpit') this._computeCockpit(target);
    else this._computeChase(target);
    this.camera.position.copy(this._desired);
    this.camera.lookAt(this._lookAt);
  }

  _computeChase(truck) {
    const pos = truck.position;
    truck.getForward(this._tmpForward);

    this._desired.set(
      pos.x - this._tmpForward.x * CAMERA.BACK,
      pos.y + CAMERA.HEIGHT,
      pos.z - this._tmpForward.z * CAMERA.BACK
    );
    this._lookAt.set(
      pos.x + this._tmpForward.x * CAMERA.LOOK_AHEAD,
      pos.y + 1.5,
      pos.z + this._tmpForward.z * CAMERA.LOOK_AHEAD
    );
  }

  /** First-person view: camera sits at the driver's seat, looking down the road. */
  _computeCockpit(truck) {
    const pos = truck.position;
    truck.getForward(this._tmpForward);
    this._desired.set(
      pos.x + this._tmpForward.x * 0.3,
      pos.y + 2.3,
      pos.z + this._tmpForward.z * 0.3
    );
    this._lookAt.set(
      pos.x + this._tmpForward.x * 24,
      pos.y + 1.8,
      pos.z + this._tmpForward.z * 24
    );
  }

  /**
   * @param {number} dt
   * @param {import('../physics/Truck.js').Truck} truck
   */
  update(dt, truck) {
    if (!this.enabled || !truck) return;
    if (this.mode === 'cockpit') {
      // Rigidly attached to the cab → no lag, no jitter.
      this._computeCockpit(truck);
      this.camera.position.copy(this._desired);
      this.camera.lookAt(this._lookAt);
      return;
    }
    this._computeChase(truck);
    const a = 1 - Math.pow(1 - CAMERA.LERP, dt * 60);
    this.camera.position.lerp(this._desired, a);
    this.camera.lookAt(this._lookAt);
  }
}
