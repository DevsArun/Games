import { APP } from '../core/constants.js';

/**
 * Builds the Wordle-style shareable text for the Flex Screen "Copy Result" button.
 * Emoji bars make it instantly recognizable and screenshot-free on social feeds.
 *
 * Example output:
 *   NEON HAUL 🚛 #042
 *   🏁 Rank: S
 *   ⚡ Top Speed: 142 km/h
 *   📦 Cargo Intact: 🟩🟩🟩🟩⬛ 92%
 *   ⏱️ 1:47
 *   Beat me 👉 <url>
 */

function bar(pct, segments = 5) {
  const filled = Math.round((pct / 100) * segments);
  return '🟩'.repeat(filled) + '⬛'.repeat(Math.max(0, segments - filled));
}

const RANK_EMOJI = { S: '🏆', A: '🥇', B: '🥈', C: '🥉', D: '🟫' };

/**
 * @param {object} r result summary
 * @param {string} r.rank  'S'|'A'|'B'|'C'|'D'
 * @param {number} r.topSpeedKmh
 * @param {number} r.cargoIntactPct
 * @param {number} r.timeSeconds
 * @param {number} [r.runNumber]
 * @param {string} [r.challengeUrl]
 */
export function buildShareText(r) {
  const m = Math.floor(r.timeSeconds / 60);
  const s = String(Math.floor(r.timeSeconds % 60)).padStart(2, '0');
  const lines = [
    `NEON HAUL 🚛 #${String(r.runNumber ?? 1).padStart(3, '0')}`,
    `${RANK_EMOJI[r.rank] ?? '🏁'} Rank: ${r.rank}`,
    `⚡ Top Speed: ${Math.round(r.topSpeedKmh)} km/h`,
    `📦 Cargo Intact: ${bar(r.cargoIntactPct)} ${Math.round(r.cargoIntactPct)}%`,
    `⏱️ ${m}:${s}`,
  ];
  if (r.challengeUrl) lines.push(`Beat me 👉 ${r.challengeUrl}`);
  return lines.join('\n');
}

/**
 * Copy text to clipboard with a robust fallback for older / sandboxed browsers.
 * @returns {Promise<boolean>} success
 */
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Optional native share sheet (mobile) with clipboard fallback. */
export async function shareResult(r) {
  const text = buildShareText(r);
  if (navigator.share) {
    try {
      await navigator.share({ title: APP.TITLE, text, url: r.challengeUrl });
      return true;
    } catch {
      /* user cancelled or unsupported → fall back */
    }
  }
  return copyToClipboard(text);
}
