import { CATALOG } from '../progression/Armory.js';
import { CrazyGames } from '../sdk/CrazyGames.js';

/**
 * Garage / Armory + Daily Tasks — the retention meta-game screen.
 *   - Daily Tasks: claim rewards; "Watch Ad to Double" via the CrazyGames rewarded ad.
 *   - Upgrades: Engine + Suspension (spend Neon Coins).
 *   - Skins: cosmetic paint/rims; equip the owned ones.
 *
 * Re-renders itself after any purchase/claim so balances + states stay in sync, and
 * calls onTruckChange() so the showcase truck rebuilds with the new look/upgrades.
 */
export class Garage {
  constructor(root, { wallet, armory, daily, onClose } = {}) {
    this.root = root;
    this.wallet = wallet;
    this.armory = armory;
    this.daily = daily;
    this.onClose = onClose;
    this.el = null;
    this._onTruckChange = null;
  }

  show(onTruckChange) {
    this._onTruckChange = onTruckChange;
    this._render();
    return this;
  }

  _render() {
    this.el?.remove();
    const el = document.createElement('div');
    el.className =
      'pointer-auto absolute inset-0 flex justify-center overflow-y-auto bg-ink-900/80 backdrop-blur-md';
    el.innerHTML = `
      <div class="my-6 w-[min(94vw,560px)] animate-slide-up">
        <div class="flex items-center justify-between px-1">
          <h2 class="text-2xl font-black tracking-widest text-neon-cyan">GARAGE</h2>
          <div class="glass flex items-center gap-2 px-3 py-1.5">
            <span class="text-neon-amber">◈</span>
            <span class="readout font-bold text-white">${this.wallet.balance.toLocaleString()}</span>
          </div>
        </div>

        ${this._dailySection()}
        ${this._upgradesSection()}
        ${this._skinsSection()}

        <button data-g="close" class="btn-neon mt-5 w-full">← Back to Menu</button>
      </div>
    `;
    this.root.appendChild(el);
    this.el = el;
    this._wire(el);
  }

  _dailySection() {
    const rows = this.daily.state.tasks
      .map((t) => {
        const done = this.daily.isComplete(t);
        const pct = Math.min(100, Math.round((t.progress / t.target) * 100));
        const btn = t.claimed
          ? `<span class="text-xs text-white/30">Claimed ✓</span>`
          : done
            ? `<div class="flex gap-1">
                 <button data-claim="${t.id}" class="rounded-lg border border-neon-lime/40 bg-neon-lime/10 px-3 py-1 text-xs text-neon-lime">Claim</button>
                 <button data-claim2x="${t.id}" class="rounded-lg border border-neon-amber/40 bg-neon-amber/10 px-3 py-1 text-xs text-neon-amber">▶ Ad 2×</button>
               </div>`
            : `<span class="text-xs text-white/40">${Math.min(t.progress, t.target)}/${t.target}</span>`;
        return `
          <div class="flex items-center justify-between gap-3 border-t border-white/5 py-2">
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm text-white/80">${t.label}</div>
              <div class="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div class="h-full bg-neon-cyan" style="width:${pct}%"></div>
              </div>
            </div>
            ${btn}
          </div>`;
      })
      .join('');
    return `
      <div class="glass-strong mt-4 p-4">
        <div class="text-[11px] uppercase tracking-[0.3em] text-white/40">Daily Tasks</div>
        ${rows}
      </div>`;
  }

  _upgradesSection() {
    const row = (key) => {
      const u = CATALOG.upgrades[key];
      const level = this.armory.state.levels[key];
      const maxed = level >= u.maxLevel;
      const cost = this.armory.upgradeCost(key);
      const pips = Array.from({ length: u.maxLevel }, (_, i) =>
        `<span class="h-2 w-5 rounded-sm ${i < level ? 'bg-neon-cyan' : 'bg-white/10'}"></span>`
      ).join('');
      return `
        <div class="flex items-center justify-between gap-3 border-t border-white/5 py-3">
          <div>
            <div class="text-sm font-semibold text-white/90">${u.name}</div>
            <div class="mt-1 flex gap-1">${pips}</div>
          </div>
          ${
            maxed
              ? `<span class="text-xs text-neon-lime">MAX</span>`
              : `<button data-upg="${key}" class="rounded-lg border border-neon-cyan/40 bg-neon-cyan/10 px-3 py-1.5 text-xs text-neon-cyan">◈ ${cost}</button>`
          }
        </div>`;
    };
    return `
      <div class="glass-strong mt-4 p-4">
        <div class="text-[11px] uppercase tracking-[0.3em] text-white/40">Upgrades</div>
        ${row('engine')}
        ${row('suspension')}
      </div>`;
  }

  _skinsSection() {
    const cards = CATALOG.skins
      .map((s) => {
        const owned = this.armory.state.skins.includes(s.id);
        const equipped = this.armory.state.equippedSkin === s.id;
        const action = equipped
          ? `<span class="text-xs text-neon-cyan">Equipped</span>`
          : owned
            ? `<button data-equip="${s.id}" class="rounded-lg border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80">Equip</button>`
            : `<button data-buyskin="${s.id}" class="rounded-lg border border-neon-amber/40 bg-neon-amber/10 px-3 py-1 text-xs text-neon-amber">◈ ${s.cost}</button>`;
        return `
          <div class="glass flex items-center justify-between p-3">
            <span class="text-sm text-white/85">${s.name}</span>
            ${action}
          </div>`;
      })
      .join('');
    return `
      <div class="glass-strong mt-4 p-4">
        <div class="mb-2 text-[11px] uppercase tracking-[0.3em] text-white/40">Skins</div>
        <div class="grid gap-2">${cards}</div>
      </div>`;
  }

  _wire(el) {
    el.querySelector('[data-g="close"]').addEventListener('click', () => this.onClose?.());

    el.querySelectorAll('[data-upg]').forEach((b) =>
      b.addEventListener('click', () => {
        if (this.armory.buyUpgrade(b.dataset.upg)) {
          this._onTruckChange?.();
          this._render();
        } else {
          this._flash(b, 'Not enough ◈');
        }
      })
    );

    el.querySelectorAll('[data-buyskin]').forEach((b) =>
      b.addEventListener('click', () => {
        if (this.armory.buySkin(b.dataset.buyskin)) this._render();
        else this._flash(b, 'Not enough ◈');
      })
    );

    el.querySelectorAll('[data-equip]').forEach((b) =>
      b.addEventListener('click', () => {
        this.armory.equipSkin(b.dataset.equip);
        this._onTruckChange?.();
        this._render();
      })
    );

    el.querySelectorAll('[data-claim]').forEach((b) =>
      b.addEventListener('click', () => {
        this.daily.claim(b.dataset.claim);
        this._render();
      })
    );

    // "Watch Ad to Double" — rewarded ad via the CrazyGames SDK wrapper.
    el.querySelectorAll('[data-claim2x]').forEach((b) =>
      b.addEventListener('click', async () => {
        b.textContent = '…loading';
        try {
          await CrazyGames.requestAd('rewarded');
          this.daily.claim(b.dataset.claim2x, { adBoosted: true });
        } catch {
          this.daily.claim(b.dataset.claim2x); // ad failed → grant base reward
        }
        this._render();
      })
    );
  }

  _flash(btn, msg) {
    const original = btn.textContent;
    btn.textContent = msg;
    setTimeout(() => (btn.textContent = original), 1200);
  }

  hide() {
    this.el?.remove();
    this.el = null;
  }
}
