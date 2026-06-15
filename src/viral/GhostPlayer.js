import * as THREE from 'three';
import { GhostRecorder } from './GhostRecorder.js';

/**
 * Plays back a friend's recorded run as a translucent "ghost" truck so the current
 * player can race against it. Interpolates between recorded frames at the ghost's
 * own sample rate for smooth motion regardless of the local framerate.
 */
export class GhostPlayer {
  /**
   * @param {THREE.Scene} scene
   * @param {object} serializedGhost result of GhostRecorder#serialize()
   */
  constructor(scene, serializedGhost) {
    this.scene = scene;
    const decoded = GhostRecorder.deserialize(serializedGhost);
    this.frames = decoded?.frames || [];
    this.hz = decoded?.hz || 15;
    this.meta = decoded?.meta || {};
    this._t = 0;
    this.finished = this.frames.length === 0;

    // Translucent magenta ghost rig — visually distinct from the player.
    this.mesh = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xff00ff,
      emissive: 0xff00ff,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 6.8), mat);
    body.position.y = 1;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.6, 2.0), mat);
    cab.position.set(0, 1.6, 2.2);
    this.mesh.add(body, cab);
    this.mesh.visible = this.frames.length > 0;
    scene.add(this.mesh);
  }

  start() {
    this._t = 0;
    this.finished = this.frames.length === 0;
  }

  /** Advance playback by dt seconds and update the ghost transform. */
  update(dt) {
    if (this.finished || this.frames.length < 2) return;
    this._t += dt;
    const fpos = this._t * this.hz; // fractional frame index
    const i = Math.floor(fpos);
    if (i >= this.frames.length - 1) {
      const last = this.frames[this.frames.length - 1];
      this.mesh.position.copy(last.position);
      this.mesh.quaternion.copy(last.quaternion);
      this.finished = true;
      return;
    }
    const a = this.frames[i];
    const b = this.frames[i + 1];
    const f = fpos - i;
    this.mesh.position.set(
      a.position.x + (b.position.x - a.position.x) * f,
      a.position.y + (b.position.y - a.position.y) * f,
      a.position.z + (b.position.z - a.position.z) * f
    );
    // Slerp rotation between frames.
    const qa = new THREE.Quaternion(a.quaternion.x, a.quaternion.y, a.quaternion.z, a.quaternion.w);
    const qb = new THREE.Quaternion(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
    this.mesh.quaternion.copy(qa.slerp(qb, f));
  }

  setVisible(v) {
    this.mesh.visible = v && this.frames.length > 0;
  }

  dispose() {
    this.scene.remove(this.mesh);
  }
}
