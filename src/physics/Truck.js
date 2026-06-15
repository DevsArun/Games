import * as CANNON from 'cannon-es';
import { TRUCK } from '../core/constants.js';

/**
 * The heavy semi-truck. Built on Cannon's RaycastVehicle for stable suspension
 * without the cost/instability of modeling each wheel as a constrained rigid body.
 *
 * NOTE: This is the physics scaffold. The full wheel layout, engine curve, damage
 * model, and Three.js mesh sync are implemented in the rendering milestone.
 * The interface below is what InputManager + the game loop drive.
 */
export class Truck {
  /**
   * @param {import('../core/PhysicsWorld.js').PhysicsWorld} physics
   * @param {{ engineLevel?: number, suspensionLevel?: number }} [upgrades]
   */
  constructor(physics, upgrades = {}) {
    this.physics = physics;
    this.upgrades = { engineLevel: 1, suspensionLevel: 1, ...upgrades };

    const s = TRUCK.CHASSIS_SIZE;
    const chassisShape = new CANNON.Box(new CANNON.Vec3(s.x, s.y, s.z));

    this.chassisBody = new CANNON.Body({ mass: TRUCK.CHASSIS_MASS });
    // Offset the collision shape upward → effective center of mass sits LOW = stable.
    this.chassisBody.addShape(
      chassisShape,
      new CANNON.Vec3(0, -TRUCK.CENTER_OF_MASS_OFFSET.y, 0)
    );
    this.chassisBody.position.set(0, 2, 0);

    this.vehicle = new CANNON.RaycastVehicle({
      chassisBody: this.chassisBody,
      indexRightAxis: 0,
      indexUpAxis: 1,
      indexForwardAxis: 2,
    });

    this._addWheels();
    this.vehicle.addToWorld(physics.world);

    // Apply heavy engine force / steering every fixed tick.
    this._unsub = physics.onTick(() => this._fixedUpdate());
    this._controls = { throttle: 0, brake: 0, steer: 0, handbrake: false };
    this._currentSteer = 0;
  }

  _addWheels() {
    const w = TRUCK.WHEEL;
    const stiffMul = 1 + (this.upgrades.suspensionLevel - 1) * 0.15;
    const base = {
      radius: w.radius,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: w.suspensionStiffness * stiffMul,
      suspensionRestLength: w.suspensionRestLength,
      frictionSlip: w.frictionSlip,
      dampingRelaxation: w.dampingRelaxation,
      dampingCompression: w.dampingCompression,
      maxSuspensionForce: w.maxSuspensionForce,
      rollInfluence: w.rollInfluence,
      axleLocal: new CANNON.Vec3(-1, 0, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(),
      maxSuspensionTravel: w.suspensionMaxTravel,
      customSlidingRotationalSpeed: -30,
      useCustomSlidingRotationalSpeed: true,
    };

    // Front axle (steerable) + rear tandem axles (driven). Positions in meters.
    const positions = [
      { x: 0.95, y: 0, z: 2.4 }, // front-right
      { x: -0.95, y: 0, z: 2.4 }, // front-left
      { x: 0.95, y: 0, z: -1.8 }, // rear-right
      { x: -0.95, y: 0, z: -1.8 }, // rear-left
    ];
    for (const p of positions) {
      base.chassisConnectionPointLocal.set(p.x, p.y, p.z);
      this.vehicle.addWheel({ ...base });
    }
  }

  setControls(controls) {
    this._controls = controls;
  }

  _fixedUpdate() {
    const c = this._controls;
    const engineForce =
      TRUCK.ENGINE_FORCE * (1 + (this.upgrades.engineLevel - 1) * 0.25);

    // Smoothly lerp steering toward the target for a weighty, non-twitchy feel.
    const targetSteer = c.steer * TRUCK.MAX_STEER;
    this._currentSteer += (targetSteer - this._currentSteer) * 0.2;

    // Front wheels steer (indices 0,1).
    this.vehicle.setSteeringValue(this._currentSteer, 0);
    this.vehicle.setSteeringValue(this._currentSteer, 1);

    // Rear wheels drive (indices 2,3).
    const drive = c.throttle * engineForce - c.brake * engineForce * 0.6;
    this.vehicle.applyEngineForce(-drive, 2);
    this.vehicle.applyEngineForce(-drive, 3);

    const brake = c.handbrake ? TRUCK.BRAKE_FORCE : 0;
    for (let i = 0; i < 4; i++) this.vehicle.setBrake(brake, i);
  }

  /** Speed in km/h, derived from chassis linear velocity. */
  get speedKmh() {
    const v = this.chassisBody.velocity;
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) * 3.6;
  }

  dispose() {
    this._unsub?.();
    this.vehicle.removeFromWorld(this.physics.world);
  }
}
