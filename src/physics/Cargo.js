import * as CANNON from 'cannon-es';
import { CARGO } from '../core/constants.js';

/**
 * Dynamic cargo crate. Each crate is a real rigid body riding the trailer bed.
 * Drive smoothly and they stay put; corner too hard and they slide off → spilled.
 *
 * Scaffold: spawning/stacking + Three.js mesh sync land in the rendering milestone.
 */
export class Cargo {
  /**
   * @param {import('../core/PhysicsWorld.js').PhysicsWorld} physics
   * @param {{x:number,y:number,z:number}} position spawn position on the trailer bed
   * @param {{ explosive?: boolean }} [opts]
   */
  constructor(physics, position, opts = {}) {
    this.physics = physics;
    this.explosive = opts.explosive ?? false;
    this.spawnY = position.y;
    this.spilled = false;

    const s = CARGO.SIZE;
    this.body = new CANNON.Body({
      mass: CARGO.MASS,
      material: physics.materials.cargo,
      shape: new CANNON.Box(new CANNON.Vec3(s.x, s.y, s.z)),
    });
    this.body.position.set(position.x, position.y, position.z);
    physics.addBody(this.body);
  }

  /** A crate counts as spilled once it drops below the bed beyond the threshold. */
  update() {
    if (this.spilled) return;
    if (this.body.position.y < this.spawnY - CARGO.SPILL_HEIGHT) {
      this.spilled = true;
    }
  }

  dispose() {
    this.physics.removeBody(this.body);
  }
}
