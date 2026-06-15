import { buildShareText, copyToClipboard, shareResult } from '../viral/ShareCard.js';
import { createChallenge } from '../viral/Challenge.js';

/**
 * The Flex Screen — an aesthetic, shareable post-match scorecard.
 * Shows Top Speed, Cargo Intact %, Rank, and offers:
 *   - "Copy Result" (Wordle-style emoji text → clipboard)
 *   - "Challenge a Friend" (generates the ?challenge= ghost link)
 *
 * Scaffold: full layout + share wiring. Animated rank reveal polish comes later.
 */
export class FlexScreen {
  /** @param {HTMLElement} root */
  constructor(root) {
    this.root = root;
    this.el = null;
  }

  /**
   * @param {object} result { rank, topSpeedKmh, cargoIntactPct, timeSeconds, runNumber }
   * @param {object} ghost  serialized ghost from GhostRecorder (for the challenge link)
   */
  show(result, ghost) {
    const { url } = ghost ? createChallenge(ghost) : { url: '' };
    const shareResultObj = { ...result, challengeUrl: url };

    const el = document.createElement('div');
    el.className =
      'pointer-auto absolute inset-0 flex items-center justify-center bg-ink-900/70 backdrop-blur-md';
    el.innerHTML = `
      <div class="glass-strong w-[min(92vw,420px)] p-6 animate-slide-up">
        <div class="text-center">
          <div class="text-[11px] uppercase tracking-[0.4em] text-white/40">Delivery Complete</div>
          <div class="mt-1 text-6xl font-black text-neon-cyan drop-shadow-[0_0_20px_rgba(34,211,238,0.6)]">${result.rank}</div>
          <div class="text-xs uppercase tracking-widest text-white/40">Rank</div>
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
        </div>

        <div class="mt-5 flex flex-col gap-2">
          <button data-flex="copy" class="btn-neon w-full">📋 Copy Result</button>
          <button data-flex="challenge" class="btn-ghost w-full">🏁 Challenge a Friend</button>
          <button data-flex="again" class="btn-ghost w-full">↻ Haul Again</button>
        </div>
      </div>
    `;
    this.root.appendChild(el);
    this.el = el;

    const copyBtn = el.querySelector('[data-flex="copy"]');
    copyBtn.addEventListener('click', async () => {
      const ok = await copyToClipboard(buildShareText(shareResultObj));
      copyBtn.textContent = ok ? '✓ Copied!' : '⚠ Copy failed';
      setTimeout(() => (copyBtn.textContent = '📋 Copy Result'), 1500);
    });

    el.querySelector('[data-flex="challenge"]').addEventListener('click', () =>
      shareResult(shareResultObj)
    );

    return { url };
  }

  hide() {
    this.el?.remove();
    this.el = null;
  }
}
