/**
 * CrazyGames SDK wrapper (DUMMY).
 *
 * In production this lazy-loads the real SDK from the CrazyGames CDN. Here we provide
 * fully-working dummy implementations with the EXACT same async surface, so gameplay
 * code can call these today and we just swap the internals at submission time.
 *
 * Docs surface mirrored: ad.requestAd, game.gameplayStart/gameplayStop, game.happytime.
 */

const isProd = import.meta.env?.PROD ?? false;

let _sdk = null; // real window.CrazyGames.SDK once loaded
let _initialized = false;

/** Lazy-load + init the real SDK in production; no-op otherwise. */
async function ensureInit() {
  if (_initialized) return _sdk;
  _initialized = true;

  if (isProd && typeof window !== 'undefined') {
    try {
      // Real integration (uncomment when shipping & SDK script tag is present):
      // await window.CrazyGames.SDK.init();
      // _sdk = window.CrazyGames.SDK;
    } catch (err) {
      console.warn('[CrazyGames] SDK init failed, using dummy.', err);
    }
  }
  return _sdk;
}

/**
 * Request an ad. Resolves on success, rejects/{error} on failure or skip.
 * @param {'rewarded'|'midgame'} type
 * @param {{ onStart?: Function, onComplete?: Function, onError?: Function }} [cb]
 */
export async function requestAd(type = 'rewarded', cb = {}) {
  await ensureInit();

  if (_sdk) {
    return new Promise((resolve, reject) => {
      _sdk.ad.requestAd(type, {
        adStarted: () => cb.onStart?.(),
        adFinished: () => {
          cb.onComplete?.();
          resolve({ type, completed: true });
        },
        adError: (e) => {
          cb.onError?.(e);
          reject(e);
        },
      });
    });
  }

  // ── DUMMY: simulate a short ad with a console banner ──────────────────────
  console.info(`%c[AD:${type}] ▶ dummy ad playing…`, 'color:#22d3ee');
  cb.onStart?.();
  gameplayStop(); // pause session tracking during ad, mirroring real behaviour
  await new Promise((r) => setTimeout(r, isProd ? 0 : 600));
  console.info(`%c[AD:${type}] ✓ dummy ad complete`, 'color:#a3e635');
  cb.onComplete?.();
  gameplayStart();
  return { type, completed: true, dummy: true };
}

/** Mark the start of an active gameplay session (for session-length analytics). */
export async function gameplayStart() {
  await ensureInit();
  if (_sdk) return _sdk.game.gameplayStart();
  console.debug('[CrazyGames] gameplayStart()');
}

/** Mark the end of an active gameplay session (menus, pause, ad breaks). */
export async function gameplayStop() {
  await ensureInit();
  if (_sdk) return _sdk.game.gameplayStop();
  console.debug('[CrazyGames] gameplayStop()');
}

/** Celebratory moment hook (e.g. successful delivery / new rank). */
export async function happytime() {
  await ensureInit();
  if (_sdk) return _sdk.game.happytime();
  console.debug('[CrazyGames] happytime() 🎉');
}

export const CrazyGames = { requestAd, gameplayStart, gameplayStop, happytime };
export default CrazyGames;
