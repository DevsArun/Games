import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { TRUCK, MISSION } from '../core/constants.js';

/**
 * The heavy semi-truck: a Cannon RaycastVehicle for stable suspension + a stylized
 * neon Three.js mesh kept perfectly in sync each frame.
 *
 * Config (consistent axes): forward = +Z, right = +X, up = +Y.
 *   - Front wheels (index 0,1) steer; rear wheels (2,3) drive.
 *   - A low center of mass keeps the loaded rig stable but still tippable on hard turns.
 *   - The trailer has low side rails so cargo can slide out when cornering too fast.
 */
export class Truck {
  /**
   * @param {import('../core/PhysicsWorld.js').PhysicsWorld} physics
   * @param {THREE.Scene} scene
   * @param {{ engineLevel?: number, suspensionLevel?: number, skin?: string }} [opts]
   */
  constructor(physics, scene, opts = {}) {
    this.physics = physics;
    this.scene = scene;
    this.upgrades = { engineLevel: 1, suspensionLevel: 1, ...opts };
    this.skin = opts.skin || null;

    this.damage = 0;
    this._controls = { throttle: 0, brake: 0, steer: 0, handbrake: false };
    this._currentSteer = 0;

    this._buildBody();
    this._buildWheels();
    this.vehicle.addToWorld(physics.world);

    this._buildMesh();
    this._wireDamage();

    this._unsub = physics.onTick(() => this._fixedUpdate());
  }

  // ── Physics body (chassis + cargo tub rails as one compound) ───────────────────
  _buildBody() {
    const s = TRUCK.CHASSIS_SIZE;
    this.chassisBody = new CANNON.Body({ mass: TRUCK.CHASSIS_MASS });

    // Main chassis box, raised so the effective CoM sits low → stable but tippable.
    const chassisShape = new CANNON.Box(new CANNON.Vec3(s.x, s.y, s.z));
    this.chassisBody.addShape(chassisShape, new CANNON.Vec3(0, 0.45, 0));

    // Low trailer rails (rear) so cargo is contained but can spill on hard turns.
    const railMat = this.physics.materials.trailer;
    const railH = 0.28;
    const bedTop = 0.45 + s.y; // local y of trailer bed surface
    const rail = (hx, hy, hz, px, py, pz) => {
      this.chassisBody.addShape(
        new CANNON.Box(new CANNON.Vec3(hx, hy, hz)),
        new CANNON.Vec3(px, py, pz)
      );
    };
    rail(0.1, railH, 2.0, -1.0, bedTop + railH, -1.2); // left rail
    rail(0.1, railH, 2.0, 1.0, bedTop + railH, -1.2); //  right rail
    rail(1.0, railH, 0.1, 0, bedTop + railH, 0.85); //    front rail (behind cab)

    // Give the chassis the trailer material for cargo contact behaviour.
    this.chassisBody.material = railMat;

    this.vehicle = new CANNON.RaycastVehicle({
      chassisBody: this.chassisBody,
      indexRightAxis: 0,
      indexUpAxis: 1,
      indexForwardAxis: 2,
    });

    this.bedTop = bedTop;
  }

  _buildWheels() {
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

    const positions = [
      { x: 0.95, y: -0.1, z: 2.4 }, // 0 front-right (steer)
      { x: -0.95, y: -0.1, z: 2.4 }, // 1 front-left  (steer)
      { x: 0.95, y: -0.1, z: -1.8 }, // 2 rear-right  (drive)
      { x: -0.95, y: -0.1, z: -1.8 }, // 3 rear-left   (drive)
    ];
    for (const p of positions) {
      base.chassisConnectionPointLocal.set(p.x, p.y, p.z);
      this.vehicle.addWheel({ ...base });
    }
  }

  // ── Visual mesh ────────────────────────────────────────────────────────────────
  _buildMesh() {
    const skinColor = this._skinColor();
    this.group = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({
      color: skinColor.body,
      metalness: 0.65,
      roughness: 0.35,
    });
    const neonMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x22d3ee,
      emissiveIntensity: 1.4,
      metalness: 0.2,
      roughness: 0.4,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0a0c14,
      metalness: 0.9,
      roughness: 0.1,
    });

    // Cab (front, taller).
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.6, 2.0), bodyMat);
    cab.position.set(0, 1.2, 2.2);
    cab.castShadow = true;

    // Windshield.
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, 0.2), glassMat);
    glass.position.set(0, 1.55, 3.15);

    // Trailer / cargo bed frame.
    const bed = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 5.2), bodyMat);
    bed.position.set(0, 0.85, -0.8);
    bed.castShadow = true;

    // Neon side rails (visual) for the cargo tub.
    const railGeo = new THREE.BoxGeometry(0.12, 0.5, 4.0);
    const railL = new THREE.Mesh(railGeo, neonMat);
    railL.position.set(-1.0, 1.35, -1.2);
    const railR = railL.clone();
    railR.position.x = 1.0;

    // Underglow strip.
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.08, 6.6),
      new THREE.MeshStandardMaterial({
        color: skinColor.glow,
        emissive: skinColor.glow,
        emissiveIntensity: 2.0,
      })
    );
    glow.position.set(0, 0.2, 0.4);

    // Headlights.
    const hlMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfff5cc,
      emissiveIntensity: 2.2,
    });
    const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.1), hlMat);
    hlL.position.set(-0.7, 0.9, 3.25);
    const hlR = hlL.clone();
    hlR.position.x = 0.7;

    this.group.add(cab, glass, bed, railL, railR, glow, hlL, hlR);

    // Wheels (4) — each a group so the cylinder axis aligns to the axle (X).
    const wheelGeo = new THREE.CylinderGeometry(
      TRUCK.WHEEL.radius,
      TRUCK.WHEEL.radius,
      0.4,
      18
    );
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.8 });
    const rimMat = new THREE.MeshStandardMaterial({
      color: skinColor.rim,
      metalness: 0.9,
      roughness: 0.2,
      emissive: skinColor.rim,
      emissiveIntensity: 0.25,
    });
    this.wheelMeshes = [];
    for (let i = 0; i < 4; i++) {
      const wheel = new THREE.Group();
      const tire = new THREE.Mesh(wheelGeo, tireMat);
      tire.rotation.z = Math.PI / 2; // cylinder Y-axis → X (axle)
      tire.castShadow = true;
      const rim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.28, 0.42, 12),
        rimMat
      );
      rim.rotation.z = Math.PI / 2;
      wheel.add(tire, rim);
      this.scene.add(wheel);
      this.wheelMeshes.push(wheel);
    }

    this.scene.add(this.group);
  }

  _skinColor() {
    switch (this.skin) {
      case 'matte_black':
        return { body: 0x14161c, glow: 0x8b5cf6, rim: 0x444a55 };
      case 'titanium_rims':
        return { body: 0x2a2f3a, glow: 0x22d3ee, rim: 0xcbd5e1 };
      case 'neon_underglow':
        return { body: 0x181c2c, glow: 0xff00ff, rim: 0x22d3ee };
      default:
        return { body: 0x1f2433, glow: 0x22d3ee, rim: 0x94a3b8 };
    }
  }

  // ── Damage from hazard collisions ────────────────────────────────────────────
  _wireDamage() {
    this.chassisBody.addEventListener('collide', (e) => {
      const other = e.body;
      if (!other || !other.isHazard) return;
      const impact = Math.abs(e.contact.getImpactVelocityAlongNormal());
      if (impact < MISSION.IMPACT_MIN_VELOCITY) return;
      this.addDamage(impact * MISSION.DAMAGE_PER_IMPACT * 0.25);
    });
  }

  addDamage(amount) {
    this.damage = Math.min(MISSION.MAX_DAMAGE, this.damage + amount);
  }

  // ── Control + simulation ────────────────────────────────────────────────────────
  setControls(controls) {
    this._controls = controls;
  }

  _fixedUpdate() {
    const c = this._controls;
    const engineForce =
      TRUCK.ENGINE_FORCE * (1 + (this.upgrades.engineLevel - 1) * 0.25);

    const targetSteer = c.steer * TRUCK.MAX_STEER;
    this._currentSteer += (targetSteer - this._currentSteer) * 0.18;
    this.vehicle.setSteeringValue(this._currentSteer, 0);
    this.vehicle.setSteeringValue(this._currentSteer, 1);

    // Throttle drives forward (+Z); brake doubles as reverse.
    const drive = c.throttle * engineForce - c.brake * engineForce * 0.55;
    this.vehicle.applyEngineForce(drive, 2);
    this.vehicle.applyEngineForce(drive, 3);

    const brake = c.handbrake ? TRUCK.BRAKE_FORCE : 0;
    for (let i = 0; i < 4; i++) this.vehicle.setBrake(brake, i);
  }

  /** Copy physics transforms onto the visual meshes. Call once per render frame. */
  syncMesh() {
    this.group.position.copy(this.chassisBody.position);
    this.group.quaternion.copy(this.chassisBody.quaternion);
    for (let i = 0; i < 4; i++) {
      this.vehicle.updateWheelTransform(i);
      const t = this.vehicle.wheelInfos[i].worldTransform;
      this.wheelMeshes[i].position.copy(t.position);
      this.wheelMeshes[i].quaternion.copy(t.quaternion);
    }
  }

  /** Place the rig at a clean start state. */
  reset(position, quaternion = new CANNON.Quaternion()) {
    const b = this.chassisBody;
    b.position.set(position.x, position.y, position.z);
    b.quaternion.copy(quaternion);
    b.velocity.setZero();
    b.angularVelocity.setZero();
    b.force.setZero();
    b.torque.setZero();
    this._currentSteer = 0;
    this.damage = 0;
  }

  setVisible(v) {
    this.group.visible = v;
    this.wheelMeshes.forEach((m) => (m.visible = v));
  }

  /** Forward unit vector in world space (for the chase camera). */
  getForward(out = new THREE.Vector3()) {
    return out.set(0, 0, 1).applyQuaternion(this.group.quaternion);
  }

  get position() {
    return this.chassisBody.position;
  }

  get speedKmh() {
    const v = this.chassisBody.velocity;
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) * 3.6;
  }

  /** Signed lateral slip speed (m/s) — used for the drift detector. */
  get lateralSpeed() {
    const v = this.chassisBody.velocity;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.group.quaternion);
    return new THREE.Vector3(v.x, 0, v.z).dot(right);
  }

  dispose() {
    this._unsub?.();
    this.vehicle.removeFromWorld(this.physics.world);
    this.scene.remove(this.group);
    this.wheelMeshes.forEach((m) => this.scene.remove(m));
  }
}
