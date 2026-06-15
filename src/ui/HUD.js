/**
 * In-game HUD: digital speedometer (km/h), minimalist damage bar, mission timer.
 * Pure DOM + Tailwind glassmorphism overlaying the canvas — no per-frame allocations.
 *
 * Scaffold: render() builds the markup; bind() caches nodes; update() mutates text/width.
 */
export class HUD {
  constructor(root) {
    this.root = root;
    this.el = null;
  }

  mount() {
    const el = document.createElement('div');
    el.className = 'absolute inset-x-0 top-0 flex items-start justify-between p-4';
    el.innerHTML = `
      <!-- Timer -->
      <div class="glass px-4 py-2">
        <div class="text-[10px] uppercase tracking-widest text-white/40">Time</div>
        <div data-hud="timer" class="readout text-2xl font-bold text-neon-cyan">3:00</div>
      </div>

      <!-- Damage -->
      <div class="glass min-w-44 px-4 py-2">
        <div class="text-[10px] uppercase tracking-widest text-white/40">Integrity</div>
        <div class="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div data-hud="damage" class="h-full w-full bg-neon-lime transition-[width,background-color] duration-200"></div>
        </div>
      </div>

      <!-- Speedometer -->
      <div class="glass px-4 py-2 text-right">
        <div data-hud="speed" class="readout text-3xl font-black leading-none text-white">0</div>
        <div class="text-[10px] uppercase tracking-widest text-white/40">km/h</div>
      </div>
    `;
    this.root.appendChild(el);
    this.el = el;
    this.nodes = {
      timer: el.querySelector('[data-hud="timer"]'),
      damage: el.querySelector('[data-hud="damage"]'),
      speed: el.querySelector('[data-hud="speed"]'),
    };
    return this;
  }

  /** @param {{ speedKmh:number, damage:number, timeLeft:number }} s */
  update(s) {
    if (!this.nodes) return;
    this.nodes.speed.textContent = Math.round(s.speedKmh);
    const integrity = Math.max(0, 100 - s.damage);
    this.nodes.damage.style.width = `${integrity}%`;
    this.nodes.damage.style.backgroundColor =
      integrity > 50 ? '#a3e635' : integrity > 20 ? '#fbbf24' : '#fb3b53';
    const m = Math.floor(s.timeLeft / 60);
    const sec = String(Math.floor(s.timeLeft % 60)).padStart(2, '0');
    this.nodes.timer.textContent = `${m}:${sec}`;
  }

  unmount() {
    this.el?.remove();
    this.el = null;
  }
}
