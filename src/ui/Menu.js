import { InputManager } from '../core/InputManager.js';

/**
 * Main Menu — premium glassmorphism title screen overlaying the live 3D showcase.
 * Shows the Neon Coins balance, an optional "incoming challenge" banner, Play +
 * Garage actions, and a context-aware controls hint (desktop vs mobile).
 */
export class Menu {
  constructor(root, { wallet, challengeMeta = null, onPlay, onGarage } = {}) {
    this.root = root;
    this.wallet = wallet;
    this.challengeMeta = challengeMeta;
    this.onPlay = onPlay;
    this.onGarage = onGarage;
    this.el = null;
    this._unsub = null;
  }

  mount() {
    const isTouch = InputManager.isTouchDevice();
    const coins = this.wallet?.balance ?? 0;

    const challengeBanner = this.challengeMeta
      ? `
      <div class="glass-strong mb-2 w-full max-w-sm px-4 py-3 text-center animate-slide-up">
        <div class="text-[10px] uppercase tracking-[0.3em] text-neon-magenta">Challenge Received</div>
        <div class="mt-1 text-sm text-white/80">
          Beat a ghost: <span class="font-bold text-neon-cyan">${Math.round(this.challengeMeta.topSpeedKmh ?? 0)} km/h</span>
          · Rank <span class="font-bold text-neon-lime">${this.challengeMeta.rank ?? '?'}</span>
        </div>
      </div>`
      : '';

    const el = document.createElement('div');
    el.className =
      'pointer-auto absolute inset-0 flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-ink-900/40 via-ink-900/30 to-ink-900/80';
    el.innerHTML = `
      <!-- Coins (top-right) -->
      <div class="glass absolute right-4 top-4 flex items-center gap-2 px-4 py-2">
        <span class="text-neon-amber">◈</span>
        <span data-menu="coins" class="readout font-bold text-white">${coins.toLocaleString()}</span>
        <span class="text-[10px] uppercase tracking-widest text-white/40">Neon Coins</span>
      </div>

      ${challengeBanner}

      <div class="text-center animate-slide-up">
        <h1 class="text-6xl font-black tracking-[0.18em] text-neon-cyan drop-shadow-[0_0_28px_rgba(34,211,238,0.65)]">NEON HAUL</h1>
        <p class="mt-2 text-xs uppercase tracking-[0.55em] text-white/40">Truck Simulator</p>
      </div>

      <div class="flex w-64 flex-col gap-3 animate-slide-up">
        <button data-menu="play" class="btn-neon text-lg">${this.challengeMeta ? '🏁 RACE THE GHOST' : '▶ START HAUL'}</button>
        <button data-menu="garage" class="btn-ghost">🔧 Garage &amp; Daily Tasks</button>
      </div>

      <div class="glass mt-2 px-4 py-2 text-center text-[11px] text-white/50 animate-slide-up">
        ${
          isTouch
            ? 'Use the on-screen wheel &amp; pedals. Deliver the cargo to the finish gate!'
            : '<span class="text-white/70">W/↑</span> gas · <span class="text-white/70">S/↓</span> brake · <span class="text-white/70">A/D</span> steer · <span class="text-white/70">Space</span> handbrake'
        }
      </div>
    `;
    this.root.appendChild(el);
    this.el = el;

    el.querySelector('[data-menu="play"]').addEventListener('click', () => this.onPlay?.());
    el.querySelector('[data-menu="garage"]').addEventListener('click', () => this.onGarage?.());

    // Live-update coins if a reward lands while the menu is open.
    const coinsEl = el.querySelector('[data-menu="coins"]');
    this._unsub = this.wallet?.onChange?.((b) => {
      coinsEl.textContent = b.toLocaleString();
    });

    return this;
  }

  unmount() {
    this._unsub?.();
    this._unsub = null;
    this.el?.remove();
    this.el = null;
  }
}
