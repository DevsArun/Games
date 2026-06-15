import { STORAGE_KEYS, URL_PARAMS } from '../core/constants.js';
import {
  GhostRecorder,
  bytesToBase64Url,
  base64UrlToBytes,
} from './GhostRecorder.js';

/**
 * ──────────────────────────────────────────────────────────────────────────────
 *  "CHALLENGE A FRIEND" — ASYNCHRONOUS MULTIPLAYER
 * ──────────────────────────────────────────────────────────────────────────────
 *
 *  Flow:
 *   1. Player finishes a successful run. We hold a serialized ghost (GhostRecorder).
 *   2. createChallenge(ghost) → persists the ghost locally AND returns a short id +
 *      a shareable URL of the form:  https://game.url/?challenge=<id>#g=<blob>
 *        - The short id is the canonical key (works with a backend if/when added).
 *        - The blob after the hash carries the FULL ghost so the link is fully
 *          self-contained TODAY with zero backend (CrazyGames-friendly). The hash
 *          fragment is never sent to a server and keeps the query string clean.
 *   3. Friend opens the link → parseIncomingChallenge() decodes the ghost so the
 *      game can spawn the opponent "Ghost" truck to race against.
 *
 *  Why hash + query?
 *   - ?challenge=<id> is human-recognizable and analytics-trackable.
 *   - #g=<blob> keeps the (potentially few-KB) payload out of server logs and
 *     under typical URL length limits while staying 100% serverless.
 */

const HASH_KEY = 'g'; // #g=<base64url ghost blob>

/** Short, URL-safe, collision-resistant id for the challenge (analytics key). */
function makeChallengeId() {
  const rnd = crypto.getRandomValues(new Uint8Array(6));
  return bytesToBase64Url(rnd); // 8-char base64url id, e.g. "xyz123ab"
}

/** Encode a ghost object into a compact base64url blob for the URL fragment. */
export function encodeGhost(ghost) {
  const json = JSON.stringify(ghost);
  // UTF-8 → bytes → base64url. (Frames are already binary-packed inside `ghost.data`.)
  const bytes = new TextEncoder().encode(json);
  return bytesToBase64Url(bytes);
}

/** Decode a base64url blob back into a ghost object. */
export function decodeGhost(blob) {
  try {
    const bytes = base64UrlToBytes(blob);
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Create a challenge from a finished run's ghost.
 * @param {object} ghost result of GhostRecorder#serialize()
 * @param {{ baseUrl?: string }} [opts]
 * @returns {{ id:string, url:string, blob:string }}
 */
export function createChallenge(ghost, opts = {}) {
  const id = makeChallengeId();
  const blob = encodeGhost(ghost);

  // Persist locally so the creator can re-share, and so a backend can sync later.
  saveGhost(id, ghost);
  saveLastGhost(ghost);

  const base =
    opts.baseUrl ||
    (typeof location !== 'undefined'
      ? `${location.origin}${location.pathname}`
      : 'https://neonhaul.game/');

  const url = `${base}?${URL_PARAMS.CHALLENGE}=${id}#${HASH_KEY}=${blob}`;
  return { id, url, blob };
}

/**
 * Read an incoming challenge from the current URL (call on boot).
 * @returns {{ id:string|null, ghost:object|null }}
 */
export function parseIncomingChallenge() {
  if (typeof location === 'undefined') return { id: null, ghost: null };

  const params = new URLSearchParams(location.search);
  const id = params.get(URL_PARAMS.CHALLENGE);

  // Prefer the self-contained blob in the hash fragment.
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const blob = hash.get(HASH_KEY);

  let ghost = blob ? decodeGhost(blob) : null;

  // Fallback: a previously cached ghost for this id (e.g. creator re-opening).
  if (!ghost && id) ghost = loadGhost(id);

  return { id: id || null, ghost: ghost || null };
}

/** True if the current session was opened from a challenge link. */
export function hasIncomingChallenge() {
  const { ghost } = parseIncomingChallenge();
  return !!ghost;
}

// ── Ghost persistence (localStorage; swappable for a backend KV store) ─────────

export function saveGhost(id, ghost) {
  try {
    localStorage.setItem(STORAGE_KEYS.CHALLENGE_PREFIX + id, JSON.stringify(ghost));
  } catch {
    /* storage may be unavailable in some embeds — link still works via hash blob */
  }
}

export function loadGhost(id) {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CHALLENGE_PREFIX + id);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveLastGhost(ghost) {
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_GHOST, JSON.stringify(ghost));
  } catch {
    /* ignore */
  }
}

export function loadLastGhost() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LAST_GHOST);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Convenience: rebuild playable frames from a stored/decoded ghost. */
export function toPlayableGhost(ghost) {
  return GhostRecorder.deserialize(ghost);
}
