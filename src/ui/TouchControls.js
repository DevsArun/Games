import { InputManager } from '../core/InputManager.js';

/**
 * Responsive, transparent on-screen controls for mobile web:
 *   - Left: steering wheel (drag arc → steer axis -1..1)
 *   - Right: gas + brake pedals (press → throttle/brake)
 *   - Handbrake button
 *
 * Feeds the shared InputManager via setTouchAxes(), so the truck is agnostic to source.
 * Scaffold: layout + pointer wiring stubbed; haptics & wheel-rotation visuals come later.
 */
export class TouchControls {
  /** @param {HTMLElement} root @param {InputManager} input */
  constructor(root, input) {
    this.root = root;
    this.input = input;
    this.el = null;
  }

  mount() {
    if (!InputManager.isTouchDevice()) return this; // desktop → no overlay
    const el = document.createElement('div');
    el.className = 'absolute inset-x-0 bottom-0 z-20 flex items-end justify-between p-6';
    el.innerHTML = `
      <!-- Steering (left thumb) -->
      <div data-touch="steer"
           class="pointer-auto grid h-32 w-32 place-items-center rounded-full border border-white/15 bg-white/5 backdrop-blur-md shadow-glow">
        <span class="text-xs uppercase tracking-widest text-white/40">Steer</span>
      </div>

      <!-- Pedals (right thumb) -->
      <div class="flex flex-col gap-3">
        <button data-touch="throttle"
          class="pointer-auto h-20 w-24 rounded-2xl border border-neon-lime/40 bg-neon-lime/10 text-neon-lime active:scale-95">GAS</button>
        <button data-touch="brake"
          class="pointer-auto h-16 w-24 rounded-2xl border border-neon-red/40 bg-neon-red/10 text-neon-red active:scale-95">BRAKE</button>
      </div>
    `;
    this.root.appendChild(el);
    this.el = el;
    this._wire(el);
    return this;
  }

  _wire(el) {
    const gas = el.querySelector('[data-touch="throttle"]');
    const brake = el.querySelector('[data-touch="brake"]');
    const steer = el.querySelector('[data-touch="steer"]');

    const press = (axis, val) => () => this.input.setTouchAxes({ [axis]: val });

    gas.addEventListener('pointerdown', press('throttle', 1));
    gas.addEventListener('pointerup', press('throttle', 0));
    gas.addEventListener('pointerleave', press('throttle', 0));
    brake.addEventListener('pointerdown', press('brake', 1));
    brake.addEventListener('pointerup', press('brake', 0));
    brake.addEventListener('pointerleave', press('brake', 0));

    // Steering: map horizontal drag within the wheel to a -1..1 axis.
    const rect = () => steer.getBoundingClientRect();
    const onMove = (e) => {
      const r = rect();
      const cx = r.left + r.width / 2;
      const norm = Math.max(-1, Math.min(1, ((e.clientX ?? cx) - cx) / (r.width / 2)));
      this.input.setTouchAxes({ steer: norm });
    };
    steer.addEventListener('pointerdown', (e) => {
      steer.setPointerCapture(e.pointerId);
      onMove(e);
    });
    steer.addEventListener('pointermove', (e) => {
      if (e.pressure > 0 || e.buttons) onMove(e);
    });
    steer.addEventListener('pointerup', () => this.input.setTouchAxes({ steer: 0 }));
  }

  unmount() {
    this.el?.remove();
    this.el = null;
  }
}
