/**
 * Main Menu / Garage shell. Hosts: Play, Daily Tasks, Armory (upgrades + skins),
 * and "Watch Ad to Double Daily Rewards". Premium glassmorphism layout.
 *
 * Scaffold: structure + navigation hooks; wires to DailyTasks/Armory/Wallet modules
 * and the CrazyGames SDK in the meta-game milestone.
 */
export class Menu {
  constructor(root, { onPlay } = {}) {
    this.root = root;
    this.onPlay = onPlay;
    this.el = null;
  }

  mount() {
    const el = document.createElement('div');
    el.className =
      'pointer-auto absolute inset-0 flex flex-col items-center justify-center gap-8 bg-ink-900/60 backdrop-blur-sm';
    el.innerHTML = `
      <div class="text-center animate-slide-up">
        <h1 class="text-5xl font-black tracking-[0.2em] text-neon-cyan drop-shadow-[0_0_24px_rgba(34,211,238,0.6)]">NEON HAUL</h1>
        <p class="mt-2 text-xs uppercase tracking-[0.5em] text-white/40">Truck Simulator</p>
      </div>
      <div class="flex flex-col gap-3 animate-slide-up">
        <button data-menu="play" class="btn-neon text-lg">▶ START HAUL</button>
        <button data-menu="garage" class="btn-ghost">🔧 Garage / Armory</button>
        <button data-menu="daily" class="btn-ghost">📋 Daily Tasks</button>
      </div>
    `;
    this.root.appendChild(el);
    this.el = el;
    el.querySelector('[data-menu="play"]').addEventListener('click', () => {
      this.onPlay?.();
    });
    return this;
  }

  unmount() {
    this.el?.remove();
    this.el = null;
  }
}
