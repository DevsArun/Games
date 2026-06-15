import { Track } from '../world/Track.js';
import { Truck } from '../physics/Truck.js';
import { Cargo } from '../physics/Cargo.js';
import { CameraController } from '../core/CameraController.js';
import { GhostRecorder } from '../viral/GhostRecorder.js';
import { GhostPlayer } from '../viral/GhostPlayer.js';

import { HUD } from '../ui/HUD.js';
import { Menu } from '../ui/Menu.js';
import { Garage } from '../ui/Garage.js';
import { FlexScreen } from '../ui/FlexScreen.js';
import { TouchControls } from '../ui/TouchControls.js';

import { Wallet } from '../progression/Wallet.js';
import { Armory } from '../progression/Armory.js';
import { DailyTasks } from '../progression/DailyTasks.js';
import { CrazyGames } from '../sdk/CrazyGames.js';

import { TRACK, CARGO, MISSION, RANKS, STORAGE_KEYS } from '../core/constants.js';

/**
 * The game orchestrator / state machine: menu → playing → result.
 * Owns the truck, cargo, track, camera, UI screens, and the meta-game economy,
 * and drives them all from the engine's per-frame update.
 */
export class Game {
  /** @param {import('../main.js').Engine} engine */
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;
    this.camera = engine.camera;
    this.physics = engine.physics;
    this.input = engine.input;
    this.uiRoot = engine.uiRoot;

    // Meta-game.
    this.wallet = new Wallet();
    this.armory = new Armory(this.wallet);
    this.daily = new DailyTasks(this.wallet);

    // World + camera (persistent across runs).
    this.track = new Track(this.physics, this.scene);
    this.camCtrl = new CameraController(this.camera);

    // Run actors.
    this.truck = null;
    this.cargo = [];
    this.ghostRecorder = new GhostRecorder();
    this.ghostPlayer = null;
    this.incomingGhost = engine.challenge?.ghost || null;

    // UI screens.
    this.hud = new HUD(this.uiRoot);
    this.flex = new FlexScreen(this.uiRoot);
    this.touch = new TouchControls(this.uiRoot, this.input);
    this.menu = new Menu(this.uiRoot, {
      wallet: this.wallet,
      challengeMeta: this.incomingGhost?.meta || null,
      onPlay: () => this.startRun(),
      onGarage: () => this.openGarage(),
    });
    this.garage = new Garage(this.uiRoot, {
      wallet: this.wallet,
      armory: this.armory,
      daily: this.daily,
      onClose: () => this.closeGarage(),
    });

    // Run/session state.
    this.state = 'boot';
    this.runNumber = this._loadRunNumber();
    this._menuT = 0;
    this.mission = null;

    engine.onUpdate((dt, controls) => this.update(dt, controls));
    this.enterMenu();
  }

  _loadRunNumber() {
    try {
      return parseInt(localStorage.getItem(STORAGE_KEYS.PROFILE + ':runs') || '0', 10) || 0;
    } catch {
      return 0;
    }
  }
  _saveRunNumber() {
    try {
      localStorage.setItem(STORAGE_KEYS.PROFILE + ':runs', String(this.runNumber));
    } catch {
      /* ignore */
    }
  }

  // ── Truck lifecycle ────────────────────────────────────────────────────────────
  _buildTruck() {
    this._disposeTruck();
    this.truck = new Truck(this.physics, this.scene, {
      ...this.armory.getTruckUpgrades(),
      skin: this.armory.state.equippedSkin,
    });
    this.truck.reset(TRACK.START);
    this.truck.setControls({ throttle: 0, brake: 0, steer: 0, handbrake: false });
  }

  _disposeTruck() {
    this.truck?.dispose();
    this.truck = null;
  }

  _spawnCargo() {
    this._clearCargo();
    const startY = TRACK.START.y + this.truck.bedTop + CARGO.SIZE.y + 0.05;
    const cols = [-0.45, 0.45];
    const rows = [-2.6, -1.2, 0.2];
    let idx = 0;
    for (const rz of rows) {
      for (const cx of cols) {
        const pos = { x: TRACK.START.x + cx, y: startY, z: TRACK.START.z + rz };
        const explosive = idx % 3 === 0;
        this.cargo.push(new Cargo(this.physics, this.scene, pos, { explosive }));
        idx++;
        if (idx >= CARGO.COUNT) break;
      }
      if (idx >= CARGO.COUNT) break;
    }
  }

  _clearCargo() {
    this.cargo.forEach((c) => c.dispose());
    this.cargo = [];
  }

  // ── States ───────────────────────────────────────────────────────────────────
  enterMenu() {
    this.state = 'menu';
    this.camCtrl.enabled = false;
    this._clearCargo();
    this.ghostPlayer?.setVisible(false);
    this._buildTruck(); // showcase the (possibly newly-skinned) rig in the menu
    this.truck.setVisible(true);
    this.hud.unmount();
    this.touch.unmount();
    this.flex.hide();
    this.garage.hide();
    this.menu.mount();
    this._menuT = 0;
  }

  openGarage() {
    this.menu.unmount();
    this.garage.show(() => this._buildTruck()); // rebuild truck when skin/upgrade changes
  }

  closeGarage() {
    this.garage.hide();
    this.enterMenu();
  }

  startRun() {
    this.menu.unmount();
    this.state = 'playing';
    this.runNumber += 1;
    this._saveRunNumber();

    this.truck.reset(TRACK.START);
    this.truck.setVisible(true);
    this._spawnCargo();

    // Ghost: record this run; replay the incoming challenge ghost if present.
    this.ghostRecorder.start();
    if (this.incomingGhost) {
      this.ghostPlayer?.dispose();
      this.ghostPlayer = new GhostPlayer(this.scene, this.incomingGhost);
      this.ghostPlayer.start();
    }

    this.camCtrl.enabled = true;
    this.camCtrl.snap(this.truck);

    this.hud.mount();
    this.touch.mount();

    this.mission = {
      timeLeft: MISSION.DEFAULT_TIME_LIMIT,
      topSpeedKmh: 0,
      driftSeconds: 0,
    };

    CrazyGames.gameplayStart();
  }

  endRun(success, reason) {
    if (this.state !== 'playing') return;
    this.state = 'result';
    this.camCtrl.enabled = false;
    this.truck.setControls({ throttle: 0, brake: 0, steer: 0, handbrake: false });

    const intactCount = this.cargo.filter((c) => !c.spilled).length;
    const intactFrac = this.cargo.length ? intactCount / this.cargo.length : 1;
    const intactPct = Math.round(intactFrac * 100);
    const timeRatio = Math.max(0, Math.min(1, this.mission.timeLeft / MISSION.DEFAULT_TIME_LIMIT));
    const timeSeconds = MISSION.DEFAULT_TIME_LIMIT - this.mission.timeLeft;

    let rank = 'F';
    let reward = 0;
    if (success) {
      const score = 0.55 * timeRatio + 0.45 * intactFrac;
      rank = RANKS.find((r) => score >= r.min)?.grade || 'D';
      reward = Math.round(80 + 220 * score);
      this.wallet.credit(reward);
      CrazyGames.happytime();
    }

    // Feed daily tasks.
    this.daily.report('topSpeed', Math.round(this.mission.topSpeedKmh));
    this.daily.report('driftSeconds', Math.floor(this.mission.driftSeconds));
    if (success) {
      this.daily.report('deliveries', 1);
      if (intactPct === 100) this.daily.report('perfectRuns', 1);
      const explosiveClean =
        this.cargo.filter((c) => c.explosive && !c.spilled).length;
      if (this.truck.damage === 0 && explosiveClean > 0) {
        this.daily.report('explosiveClean', explosiveClean);
      }
    }

    const result = {
      success,
      reason,
      rank,
      topSpeedKmh: this.mission.topSpeedKmh,
      cargoIntactPct: intactPct,
      timeSeconds,
      reward,
      runNumber: this.runNumber,
    };

    const ghost = this.ghostRecorder.serialize({
      rank,
      cargoIntactPct: intactPct,
      timeSeconds: Math.round(timeSeconds),
      runNumber: this.runNumber,
    });
    this.ghostRecorder.stop();

    this.hud.unmount();
    this.touch.unmount();
    this.flex.show(result, success ? ghost : null, {
      onAgain: () => {
        this.flex.hide();
        this.startRun();
      },
      onMenu: () => {
        this.flex.hide();
        this.enterMenu();
      },
    });

    CrazyGames.gameplayStop();
  }

  // ── Per-frame update ─────────────────────────────────────────────────────────
  update(dt, controls) {
    if (this.state === 'menu') {
      this._updateMenu(dt);
      return;
    }
    if (this.state === 'playing') {
      this._updatePlaying(dt, controls);
      return;
    }
    if (this.state === 'result') {
      // Keep the world ticking visually (truck settles) without input.
      this.truck?.syncMesh();
      this.cargo.forEach((c) => c.update());
    }
  }

  _updateMenu(dt) {
    this._menuT += dt * 0.25;
    this.truck?.syncMesh();
    const cx = TRACK.START.x;
    const cz = TRACK.START.z;
    this.camera.position.set(
      cx + Math.sin(this._menuT) * 13,
      6.5,
      cz + Math.cos(this._menuT) * 13
    );
    this.camera.lookAt(cx, 1.6, cz);
  }

  _updatePlaying(dt, controls) {
    const truck = this.truck;
    truck.setControls(controls);
    truck.syncMesh();
    this.cargo.forEach((c) => c.update());

    // Stats.
    this.mission.timeLeft -= dt;
    this.mission.topSpeedKmh = Math.max(this.mission.topSpeedKmh, truck.speedKmh);
    if (Math.abs(truck.lateralSpeed) > 4 && truck.speedKmh > 20) {
      this.mission.driftSeconds += dt;
    }

    // Ghost.
    this.ghostRecorder.sample(dt, truck.chassisBody, truck.speedKmh);
    this.ghostPlayer?.update(dt);

    // Camera.
    this.camCtrl.update(dt, truck);

    // HUD.
    this.hud.update({
      speedKmh: truck.speedKmh,
      damage: truck.damage,
      timeLeft: Math.max(0, this.mission.timeLeft),
    });

    // Win / lose checks.
    const intactCount = this.cargo.filter((c) => !c.spilled).length;
    const intactFrac = this.cargo.length ? intactCount / this.cargo.length : 1;

    if (truck.position.z >= this.track.finishZ) {
      this.endRun(true, 'delivered');
    } else if (this.mission.timeLeft <= 0) {
      this.endRun(false, 'Out of time');
    } else if (truck.damage >= MISSION.MAX_DAMAGE) {
      this.endRun(false, 'Truck wrecked');
    } else if (intactFrac < CARGO.INTACT_THRESHOLD) {
      this.endRun(false, 'Cargo spilled');
    } else if (truck.position.y < -20) {
      this.endRun(false, 'Fell off the map');
    }
  }
}
