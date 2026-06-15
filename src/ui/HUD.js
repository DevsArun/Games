/**
 * In-game HUD — a premium digital instrument cluster overlaying the cockpit view.
 *
 * Built from pure DOM + CSS (conic-gradient rings) so it renders pixel-perfect on
 * every device with zero asset weight. Mimics a real truck-sim dash: a glowing
 * radial speedometer with gear indicator, an integrity ring, mission timer, and a
 * distance-to-delivery readout. update() only mutates text + CSS variables.
 */
export class HUD {
  constructor(root) {
    this.root = root;
    this.el = null;
    this.nodes = null;
    this.maxSpeed = 160; // km/h → full gauge sweep
  }

  mount() {
    const el = document.createElement('div');
    el.className = 'absolute inset-0 z-20 select-none';
    el.innerHTML = this._markup();
    this.root.appendChild(el);
    this.el = el;
    this.nodes = {
      speed: el.querySelector('[data-hud="speed"]'),
      gauge: el.querySelector('[data-hud="gauge"]'),
      gear: el.querySelector('[data-hud="gear"]'),
      timer: el.querySelector('[data-hud="timer"]'),
      integrity: el.querySelector('[data-hud="integrity"]'),
      ring: el.querySelector('[data-hud="integrity-ring"]'),
      dist: el.querySelector('[data-hud="dist"]'),
    };
    return this;
  }


  _markup() {
    return `
      <!-- Top bar: objective + timer -->
      <div class="absolute inset-x-0 top-0 flex items-start justify-between p-3 sm:p-4">
        <div class="glass px-4 py-2">
          <div class="text-[9px] uppercase tracking-[0.25em] text-white/40">Objective</div>
          <div class="text-sm font-semibold text-white/90">Deliver to the gate</div>
          <div class="mt-0.5 text-[11px] text-neon-cyan">
            <span data-hud="dist">--</span> remaining
          </div>
        </div>
        <div class="glass px-4 py-2 text-center">
          <div class="text-[9px] uppercase tracking-[0.25em] text-white/40">Time</div>
          <div data-hud="timer" class="readout text-2xl font-black text-neon-cyan">0:00</div>
        </div>
      </div>

      <!-- Bottom instrument cluster -->
      <div class="absolute inset-x-0 bottom-0 flex items-end justify-center gap-4 p-3 pb-5 sm:gap-6">
        <!-- Integrity ring -->
        <div class="hud-cluster flex flex-col items-center gap-1 pb-2">
          <div data-hud="integrity-ring" class="gauge-mini">
            <span data-hud="integrity" class="readout text-sm font-bold text-white">100</span>
          </div>
          <div class="text-[9px] uppercase tracking-[0.2em] text-white/40">Integrity</div>
        </div>

        <!-- Speedometer -->
        <div class="flex flex-col items-center">
          <div data-hud="gauge" class="speedo">
            <div class="speedo-core">
              <div data-hud="speed" class="readout text-4xl font-black leading-none text-white">0</div>
              <div class="text-[10px] uppercase tracking-[0.3em] text-white/45">km/h</div>
              <div data-hud="gear" class="mt-1 text-sm font-black text-neon-cyan">D</div>
            </div>
          </div>
        </div>

        <!-- View hint -->
        <div class="hud-cluster flex flex-col items-center gap-1 pb-2 opacity-70">
          <div class="glass grid h-12 w-12 place-items-center text-lg">🎥</div>
          <div class="text-[9px] uppercase tracking-[0.2em] text-white/40">V&nbsp;= view</div>
        </div>
      </div>
    `;
  }


  /**
   * @param {{ speedKmh:number, damage:number, timeLeft:number,
   *           distToGate?:number, gear?:string }} s
   */
  update(s) {
    if (!this.nodes) return;
    const speed = Math.max(0, Math.round(s.speedKmh));
    this.nodes.speed.textContent = speed;

    // Speed gauge sweep (0..270deg arc).
    const frac = Math.min(1, speed / this.maxSpeed);
    this.nodes.gauge.style.setProperty('--p', `${(frac * 270).toFixed(1)}deg`);
    this.nodes.gear.textContent = s.gear || (speed < 1 ? 'N' : 'D');

    // Integrity ring + colour shift.
    const integrity = Math.max(0, Math.round(100 - s.damage));
    this.nodes.integrity.textContent = integrity;
    const color = integrity > 50 ? '#a3e635' : integrity > 20 ? '#fbbf24' : '#fb3b53';
    this.nodes.ring.style.setProperty('--i', `${((integrity / 100) * 270).toFixed(1)}deg`);
    this.nodes.ring.style.setProperty('--ic', color);

    // Timer (turns red in the final 10s).
    const m = Math.floor(s.timeLeft / 60);
    const sec = String(Math.floor(s.timeLeft % 60)).padStart(2, '0');
    this.nodes.timer.textContent = `${m}:${sec}`;
    this.nodes.timer.style.color = s.timeLeft <= 10 ? '#fb3b53' : '';

    if (this.nodes.dist) {
      this.nodes.dist.textContent =
        s.distToGate != null ? `${Math.max(0, Math.round(s.distToGate))} m` : '--';
    }
  }

  unmount() {
    this.el?.remove();
    this.el = null;
    this.nodes = null;
  }
}
