import * as CANNON from 'cannon-es';
import { PHYSICS } from './constants.js';

/**
 * Thin, opinionated wrapper around the Cannon-es world.
 * Owns the broadphase, solver, contact materials, and a deterministic fixed step.
 */
export class PhysicsWorld {
  constructor() {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, PHYSICS.GRAVITY, 0),
    });

    // SAP broadphase is a good default for vehicles + scattered cargo bodies.
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;
    this.world.solver.iterations = PHYSICS.SOLVER_ITERATIONS;

    this._setupMaterials();

    // Bodies that need a per-step callback (e.g. truck applying engine force).
    this._tickHandlers = new Set();
  }

  /** Named contact materials so tires grip asphalt and cargo slides realistically. */
  _setupMaterials() {
    this.materials = {
      ground: new CANNON.Material('ground'),
      wheel: new CANNON.Material('wheel'),
      cargo: new CANNON.Material('cargo'),
      trailer: new CANNON.Material('trailer'),
    };

    const m = this.materials;

    // Tire ↔ road: high friction, low restitution.
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(m.wheel, m.ground, {
        friction: 0.9,
        restitution: 0,
        contactEquationStiffness: 1000,
      })
    );

    // Cargo ↔ trailer bed: moderate friction so hard turns can slide the load.
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(m.cargo, m.trailer, {
        friction: 0.45,
        restitution: 0.05,
      })
    );

    // Cargo ↔ cargo: stacking behaviour.
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(m.cargo, m.cargo, {
        friction: 0.4,
        restitution: 0.1,
      })
    );
  }

  addBody(body) {
    this.world.addBody(body);
    return body;
  }

  removeBody(body) {
    this.world.removeBody(body);
  }

  /** Register a callback invoked every fixed physics tick. Returns an unsubscribe fn. */
  onTick(handler) {
    this._tickHandlers.add(handler);
    return () => this._tickHandlers.delete(handler);
  }

  /**
   * Advance the simulation. Cannon internally clamps to fixed sub-steps,
   * giving frame-rate-independent, deterministic results for ghost replays.
   * @param {number} dt real frame delta in seconds
   */
  step(dt) {
    for (const handler of this._tickHandlers) handler(PHYSICS.FIXED_TIMESTEP);
    this.world.step(PHYSICS.FIXED_TIMESTEP, dt, PHYSICS.MAX_SUBSTEPS);
  }

  dispose() {
    this._tickHandlers.clear();
    // Cannon has no global dispose; drop references so GC can reclaim.
    this.world.bodies.length = 0;
  }
}
