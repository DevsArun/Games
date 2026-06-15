import { buildShareText, copyToClipboard, shareResult } from '../viral/ShareCard.js';
import { createChallenge } from '../viral/Challenge.js';

/**
 * The Flex Screen — the aesthetic, shareable post-match scorecard.
 * Shows Rank, Top Speed, Cargo Intact %, time, and coins earned, plus:
 *   - "Copy Result"        (Wordle-style emoji text → clipboard)
 *   - "Challenge a Friend" (generates the ?challenge= ghost link; success runs only)
 *   - "Haul Again" / "Main Menu"
 */
export class FlexScreen {
  constructor(root) {
    this.root = root;
    this.el = null;
  }

  /**
   * @param {object} result { success, reason, rank, topSpeedKmh, cargoIntactPct, timeSeconds, reward, runNumber }
   * @param {object|null} ghost serialized ghost (null on failed runs)
   * @param {{ onAgain:Function, onMenu:Function }} cb
   */
  show(result, ghost, cb = {}) {
    const challenge = ghost ? createChallenge(ghost) : { url: '' };
    const shareObj = { ...result, challengeUrl: challenge.url };

    const m = Math.floor(result.timeSeconds / 60);
    const s = String(Math.floor(result.timeSeconds % 60)).padStart(2, '0');
    const headline = result.success ? 'Delivery Complete' : 'Mission Failed';
    const rankColor = result.success ? 'text-neon-cyan' : 'text-neon-red';
    const rankGlow = result.success
      ? 'drop-shadow-[0_0_20px_rgba(34,211,238,0.6)]'
      : 'drop-shadow-[0_0_20px_rgba(251,59,83,0.6)]';

    const el = document.createElement('div');
    el.className =
      'pointer-auto absolute inset-0 flex items-center justify-center bg-ink-900/75 backdrop-blur-md';
    el.dataset.time = `${m}:${s}`;
    this.root.appendChild(el);
    this.el = el;
    this._renderInner(el, result, headline, rankColor, rankGlow, `${m}:${s}`);
    this._wire(el, result, shareObj, ghost, cb);
  }


  _renderInner(el, result, headline, rankColor, rankGlow, timeStr) {
    el.innerHTML = `
      <div class="glass-strong w-[min(92vw,420px)] p-6 animate-slide-up">
        <div class="text-center">
          <div class="text-[11px] uppercase tracking-[0.4em] text-white/40">${headline}</div>
          <div class="mt-1 text-7xl font-black ${rankColor} ${rankGlow}">${result.rank}</div>
          <div class="text-xs uppercase tracking-widest text-white/40">Rank</div>
          ${
            result.reason && !result.success
              ? `<div class="mt-1 text-xs text-neon-red/80">${result.reason}</div>`
              : ''
          }
        </div>

        <div class="mt-6 grid grid-cols-2 gap-3">
          <div class="glass p-3">
            <div class="text-[10px] uppercase tracking-widest text-white/40">Top Speed</div>
            <div class="readout text-2xl font-bold text-white">${Math.round(result.topSpeedKmh)}<span class="text-sm text-white/40"> km/h</span></div>
          </div>
          <div class="glass p-3">
            <div class="text-[10px] uppercase tracking-widest text-white/40">Cargo Intact</div>
            <div class="readout text-2xl font-bold text-neon-lime">${Math.round(result.cargoIntactPct)}<span class="text-sm text-white/40">%</span></div>
          </div>
          <div class="glass p-3">
            <div class="text-[10px] uppercase tracking-widest text-white/40">Time</div>
            <div class="readout text-2xl font-bold text-white">${timeStr}</div>
          </div>
          <div class="glass p-3">
            <div class="text-[10px] uppercase tracking-widest text-white/40">Earned</div>
            <div class="readout text-2xl font-bold text-neon-amber">◈ ${result.reward ?? 0}</div>
          </div>
        </div>

        <div class="mt-5 flex flex-col gap-2">
          <button data-flex="copy" class="btn-neon w-full">📋 Copy Result</button>
          ${
            result.success
              ? `<button data-flex="challenge" class="btn-ghost w-full">🏁 Challenge a Friend</button>`
              : ''
          }
          <div class="flex gap-2">
            <button data-flex="again" class="btn-ghost flex-1">↻ Haul Again</button>
            <button data-flex="menu" class="btn-ghost flex-1">☰ Menu</button>
          </div>
        </div>
      </div>
    `;
  }


  _wire(el, result, shareObj, ghost, cb) {
    const copyBtn = el.querySelector('[data-flex="copy"]');
    copyBtn.addEventListener('click', async () => {
      const ok = await copyToClipboard(buildShareText(shareObj));
      copyBtn.textContent = ok ? '✓ Copied!' : '⚠ Copy failed';
      setTimeout(() => (copyBtn.textContent = '📋 Copy Result'), 1500);
    });

    el.querySelector('[data-flex="challenge"]')?.addEventListener('click', () =>
      shareResult(shareObj)
    );

    el.querySelector('[data-flex="again"]').addEventListener('click', () => cb.onAgain?.());
    el.querySelector('[data-flex="menu"]').addEventListener('click', () => cb.onMenu?.());
  }

  hide() {
    this.el?.remove();
    this.el = null;
  }
}
