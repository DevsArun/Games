import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { CARGO } from '../core/constants.js';

/**
 * Dynamic cargo crate — a real rigid body riding the trailer bed with a synced mesh.
 * Drive smoothly and it stays put; corner too hard and it slides/tumbles out → spilled.
 */
export class Cargo {
  /**
   * @param {import('../core/PhysicsWorld.js').PhysicsWorld} physics
   * @param {THREE.Scene} scene
   * @param {{x:number,y:number,z:number}} position
   * @param {{ explosive?: boolean }} [opts]
   */
  constructor(physics, scene, position, opts = {}) {
    this.physics = physics;
    this.scene = scene;
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

    const color = this.explosive ? 0xfb3b53 : 0xfbbf24;
    this.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(s.x * 2, s.y * 2, s.z * 2),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: this.explosive ? 0.6 : 0.25,
        metalness: 0.3,
        roughness: 0.6,
      })
    );
    this.mesh.castShadow = true;
    // Wireframe edge for that premium neon-crate look.
    this.edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(this.mesh.geometry),
      new THREE.LineBasicMaterial({ color: this.explosive ? 0xff6b81 : 0xffe08a })
    );
    this.mesh.add(this.edges);
    scene.add(this.mesh);
  }

  /** Sync mesh + flag spill once the crate has dropped off the bed. */
  update() {
    this.mesh.position.copy(this.body.position);
    this.mesh.quaternion.copy(this.body.quaternion);
    if (!this.spilled && this.body.position.y < this.spawnY - CARGO.SPILL_HEIGHT) {
      this.spilled = true;
      this.mesh.material.color.set(0x444a55);
      this.mesh.material.emissiveIntensity = 0;
    }
  }

  dispose() {
    this.physics.removeBody(this.body);
    this.scene.remove(this.mesh);
  }
}
