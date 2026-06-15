import { APP } from '../core/constants.js';

/**
 * Records a run as a compact "ghost": a fixed-rate trace of the truck's transform
 * plus headline stats. Designed to be small enough to live in a URL query param
 * so a friend can race the ghost just by clicking a link.
 *
 * Binary packing:
 *   - Sample at GHOST_HZ (default 15 Hz). Each frame = 7 int16s:
 *       position x,y,z  → quantized to centimeters (±327.67 m)
 *       quaternion x,y,z,w → quantized to 1/32767
 *   - That's 14 bytes/frame → a 3-minute run ≈ 15*180*14 ≈ 37.8 KB raw,
 *     ~a few KB after base64url + gzip on the wire. Easily URL/clipboard friendly.
 */
export const GHOST_HZ = 15;
const POS_SCALE = 100; // meters → centimeters
const ROT_SCALE = 32767; // unit quaternion component → int16

export class GhostRecorder {
  constructor(hz = GHOST_HZ) {
    this.hz = hz;
    this.interval = 1 / hz;
    this._acc = 0;
    this._frames = []; // flat array of int16 values (7 per frame)
    this._stats = { topSpeedKmh: 0, distance: 0 };
    this._recording = false;
  }

  start() {
    this._acc = 0;
    this._frames.length = 0;
    this._stats = { topSpeedKmh: 0, distance: 0 };
    this._recording = true;
  }

  stop() {
    this._recording = false;
  }

  /**
   * Feed each frame. Captures a sample only when the fixed interval elapses,
   * keeping the trace device-frame-rate independent.
   * @param {number} dt seconds since last frame
   * @param {{position:{x,y,z}, quaternion:{x,y,z,w}}} body the truck chassis
   * @param {number} speedKmh current speed
   */
  sample(dt, body, speedKmh) {
    if (!this._recording) return;
    this._stats.topSpeedKmh = Math.max(this._stats.topSpeedKmh, speedKmh);

    this._acc += dt;
    if (this._acc < this.interval) return;
    this._acc -= this.interval;

    const p = body.position;
    const q = body.quaternion;
    this._frames.push(
      clamp16(p.x * POS_SCALE),
      clamp16(p.y * POS_SCALE),
      clamp16(p.z * POS_SCALE),
      clamp16(q.x * ROT_SCALE),
      clamp16(q.y * ROT_SCALE),
      clamp16(q.z * ROT_SCALE),
      clamp16(q.w * ROT_SCALE)
    );
  }

  get frameCount() {
    return this._frames.length / 7;
  }

  /**
   * Produce the serializable ghost object.
   * @param {object} meta headline stats for the Flex Screen (rank, intact %, etc.)
   */
  serialize(meta = {}) {
    const int16 = Int16Array.from(this._frames);
    const bytes = new Uint8Array(int16.buffer);
    return {
      v: APP.GHOST_SCHEMA,
      hz: this.hz,
      n: this.frameCount,
      meta: { topSpeedKmh: Math.round(this._stats.topSpeedKmh), ...meta },
      // base64url of the packed binary frame data
      data: bytesToBase64Url(bytes),
    };
  }

  /** Static: decode a serialized ghost back into playable frames. */
  static deserialize(ghost) {
    if (!ghost || ghost.v !== APP.GHOST_SCHEMA) return null;
    const bytes = base64UrlToBytes(ghost.data);
    const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
    const frames = [];
    for (let i = 0; i < int16.length; i += 7) {
      frames.push({
        position: {
          x: int16[i] / POS_SCALE,
          y: int16[i + 1] / POS_SCALE,
          z: int16[i + 2] / POS_SCALE,
        },
        quaternion: {
          x: int16[i + 3] / ROT_SCALE,
          y: int16[i + 4] / ROT_SCALE,
          z: int16[i + 5] / ROT_SCALE,
          w: int16[i + 6] / ROT_SCALE,
        },
      });
    }
    return { hz: ghost.hz, meta: ghost.meta, frames };
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────
function clamp16(v) {
  v = Math.round(v);
  return v < -32768 ? -32768 : v > 32767 ? 32767 : v;
}

export function bytesToBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBytes(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
