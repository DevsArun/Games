import './style.css';
import * as THREE from 'three';

import { APP } from './core/constants.js';
import { PhysicsWorld } from './core/PhysicsWorld.js';
import { InputManager } from './core/InputManager.js';
import { hasIncomingChallenge, parseIncomingChallenge } from './viral/Challenge.js';
import { CrazyGames } from './sdk/CrazyGames.js';
import { Game } from './game/Game.js';

/**
 * ──────────────────────────────────────────────────────────────────────────────
 *  NEON HAUL: TRUCK SIMULATOR — Bootstrap / Engine init
 * ──────────────────────────────────────────────────────────────────────────────
 *  Responsibilities of this file:
 *    1. Create the Three.js renderer/scene/camera bound to #game-canvas.
 *    2. Create the Cannon-es physics world (deterministic fixed step).
 *    3. Handle responsive resize for BOTH mobile and desktop (DPR-capped).
 *    4. Run a decoupled render/physics loop (accumulator → fixed-step sim).
 *    5. Detect an incoming ?challenge= link so we can race a friend's ghost.
 *
 *  Heavy gameplay systems (truck assembly, track loading, cargo, UI screens) are
 *  attached to this Engine in later milestones — this file owns lifecycle only.
 */
class Engine {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.uiRoot = document.getElementById('ui-root');

    this._clock = new THREE.Clock();
    this._accumulator = 0;
    this._maxFrameDelta = 0.1; // clamp huge tab-switch deltas (s)
    this._running = false;
    this._updaters = new Set(); // per-frame callbacks (truck, cargo, HUD, ghost)
    this.composer = null; // post-processing pipeline (set async by _initPostFX)

    this._initRenderer();
    this._initScene();
    this._initPhysics();
    this._initInput();
    this._initResize();
    this._detectChallenge();
    this._initPostFX(); // fire-and-forget; falls back to direct render if it fails
  }

  // ── Renderer ────────────────────────────────────────────────────────────────
  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: window.devicePixelRatio < 2, // skip MSAA on hi-DPI mobile (perf)
      powerPreference: 'high-performance',
      stencil: false,
    });
    // Cap DPR at 2 → sharp on retina without melting mid-range phones.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
  }

  // ── Scene + camera + lights ───────────────────────────────────────────────────
  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05060a);
    // Neon-night fog gives depth and lets us cull distant geometry cheaply.
    this.scene.fog = new THREE.Fog(0x05060a, 60, 320);

    this.camera = new THREE.PerspectiveCamera(
      62,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 8, -14);
    this.camera.lookAt(0, 1, 0);

    // Key light (sun/moon) with shadows + soft ambient fill.
    const ambient = new THREE.HemisphereLight(0x335577, 0x0a0c14, 0.7);
    this.scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(40, 80, 30);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 220;
    key.shadow.camera.left = -80;
    key.shadow.camera.right = 80;
    key.shadow.camera.top = 80;
    key.shadow.camera.bottom = -80;
    this.scene.add(key);

    // Brand neon rim lights for that ultra-premium look.
    const rimCyan = new THREE.PointLight(0x22d3ee, 0.8, 120);
    rimCyan.position.set(-30, 12, -20);
    const rimMagenta = new THREE.PointLight(0xff00ff, 0.6, 120);
    rimMagenta.position.set(30, 12, 20);
    this.scene.add(rimCyan, rimMagenta);
  }

  // ── Physics ───────────────────────────────────────────────────────────────────
  _initPhysics() {
    this.physics = new PhysicsWorld();
  }

  // ── Post-processing (neon bloom) ────────────────────────────────────────────────
  // Dynamically imported + fully guarded: if anything fails, we silently fall back
  // to direct rendering so the game always boots.
  async _initPostFX() {
    try {
      const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }] = await Promise.all([
        import('three/examples/jsm/postprocessing/EffectComposer.js'),
        import('three/examples/jsm/postprocessing/RenderPass.js'),
        import('three/examples/jsm/postprocessing/UnrealBloomPass.js'),
      ]);
      const vw = window.visualViewport?.width ?? window.innerWidth;
      const vh = window.visualViewport?.height ?? window.innerHeight;

      const composer = new EffectComposer(this.renderer);
      composer.addPass(new RenderPass(this.scene, this.camera));
      // (resolution, strength, radius, threshold) — tuned so only neon pops.
      const bloom = new UnrealBloomPass(new THREE.Vector2(vw, vh), 0.7, 0.5, 0.82);
      composer.addPass(bloom);
      composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      composer.setSize(vw, vh);

      this.composer = composer;
      this.bloom = bloom;
      console.info('%c[NEON HAUL] Bloom post-processing online ✨', 'color:#22d3ee');
    } catch (err) {
      console.warn('[NEON HAUL] PostFX unavailable, using direct render.', err);
      this.composer = null;
    }
  }

  // ── Input (desktop + mobile unified) ───────────────────────────────────────────
  _initInput() {
    this.input = new InputManager();
    this.input.attach();
  }

  // ── Responsive resize (mobile + desktop) ───────────────────────────────────────
  _initResize() {
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize, { passive: true });
    window.addEventListener('orientationchange', this._onResize, { passive: true });

    // visualViewport handles mobile browser chrome (URL bar) show/hide accurately.
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this._onResize, { passive: true });
    }
    this.resize();
  }

  resize() {
    // Use visualViewport when available so the canvas tracks the *visible* area
    // on mobile (accounts for the collapsing address bar), else fall back to window.
    const vw = window.visualViewport?.width ?? window.innerWidth;
    const vh = window.visualViewport?.height ?? window.innerHeight;

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(vw, vh, false); // false → don't override CSS size

    this.camera.aspect = vw / vh;
    this.camera.updateProjectionMatrix();

    if (this.composer) {
      this.composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.composer.setSize(vw, vh);
    }
  }

  // ── Incoming "Challenge a Friend" link ──────────────────────────────────────────
  _detectChallenge() {
    this.incomingChallenge = hasIncomingChallenge();
    if (this.incomingChallenge) {
      const { id, ghost } = parseIncomingChallenge();
      this.challenge = { id, ghost };
      console.info(
        `%c[NEON HAUL] Challenge accepted (id=${id}, frames=${ghost?.n ?? 0}) — racing ghost!`,
        'color:#f0f'
      );
      // The game state machine will spawn a translucent ghost truck from this data.
    }
  }

  // ── Loop registration ───────────────────────────────────────────────────────────
  /** Register a per-frame updater. @returns unsubscribe fn */
  onUpdate(fn) {
    this._updaters.add(fn);
    return () => this._updaters.delete(fn);
  }

  // ── Main loop: decoupled render + fixed-step physics ─────────────────────────────
  start() {
    if (this._running) return;
    this._running = true;
    CrazyGames.gameplayStart();
    this._clock.start();
    this.renderer.setAnimationLoop(() => this._frame());
  }

  stop() {
    this._running = false;
    this.renderer.setAnimationLoop(null);
    CrazyGames.gameplayStop();
  }

  _frame() {
    let dt = this._clock.getDelta();
    if (dt > this._maxFrameDelta) dt = this._maxFrameDelta; // tab-switch guard

    // Step physics (Cannon clamps internally to fixed sub-steps for determinism).
    this.physics.step(dt);

    // Sample input + run gameplay updaters (truck, cargo, ghost, HUD, camera...).
    const controls = this.input.sample();
    for (const fn of this._updaters) fn(dt, controls);

    // Render through the bloom composer when available, else straight to screen.
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.stop();
    this.input.detach();
    this.physics.dispose();
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('orientationchange', this._onResize);
    window.visualViewport?.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
  }
}

// ── Boot ─────────────────────────────────────────────────────────────────────────
function boot() {
  const bar = document.getElementById('boot-bar');
  if (bar) bar.style.width = '40%';

  const engine = new Engine();
  window.__NEON_HAUL__ = engine; // dev handle for debugging in the console

  // Boot the full game (track, truck, cargo, UI state machine).
  const game = new Game(engine);
  engine.game = game;

  if (bar) bar.style.width = '100%';

  // Remove the splash on the next frame, once the first render is guaranteed.
  requestAnimationFrame(() => {
    document.getElementById('boot-splash')?.remove();
  });

  engine.start();

  console.info(
    `%c${APP.TITLE} v${APP.VERSION} booted ✓`,
    'color:#22d3ee;font-weight:bold'
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}

export { Engine };
