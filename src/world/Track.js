import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { TRACK } from '../core/constants.js';

/**
 * The delivery route. A long neon highway from the start (z=6) to a glowing delivery
 * gate (z=FINISH_Z), bounded by barrier walls, with scattered hazard obstacles that
 * deal damage on impact.
 *
 *   - Ground: a single static plane (physics) + dark asphalt + neon center line (visual).
 *   - Barriers: static boxes flagged `isHazard` along both road edges.
 *   - Obstacles: static crates/cones scattered on the road, also `isHazard`.
 *   - Finish gate: a visual arch + a trigger handled by Game via z-position.
 */
export class Track {
  /**
   * @param {import('../core/PhysicsWorld.js').PhysicsWorld} physics
   * @param {THREE.Scene} scene
   */
  constructor(physics, scene) {
    this.physics = physics;
    this.scene = scene;
    this.bodies = [];
    this.meshes = [];

    this._buildGround();
    this._buildRoad();
    this._buildBarriers();
    this._buildObstacles();
    this._buildFinishGate();
  }

  _track(body, mesh) {
    if (body) {
      this.physics.addBody(body);
      this.bodies.push(body);
    }
    if (mesh) {
      this.scene.add(mesh);
      this.meshes.push(mesh);
    }
  }

  _buildGround() {
    // Static physics plane.
    const body = new CANNON.Body({ mass: 0, material: this.physics.materials.ground });
    body.addShape(new CANNON.Plane());
    body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this._track(body, null);

    // Visual ground.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(600, TRACK.LENGTH + 200),
      new THREE.MeshStandardMaterial({ color: 0x080a10, roughness: 1, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = TRACK.LENGTH / 2;
    ground.receiveShadow = true;
    this._track(null, ground);

    // Neon ground grid for depth.
    const grid = new THREE.GridHelper(900, 180, 0x123, 0x0c1018);
    grid.position.set(0, 0.02, TRACK.LENGTH / 2);
    this._track(null, grid);
  }

  _buildRoad() {
    // Asphalt strip.
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(TRACK.ROAD_WIDTH, TRACK.LENGTH),
      new THREE.MeshStandardMaterial({ color: 0x12141c, roughness: 0.9, metalness: 0.1 })
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.04, TRACK.LENGTH / 2);
    road.receiveShadow = true;
    this._track(null, road);

    // Glowing center line.
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(0.4, TRACK.LENGTH),
      new THREE.MeshStandardMaterial({
        color: 0x22d3ee,
        emissive: 0x22d3ee,
        emissiveIntensity: 1.2,
      })
    );
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.06, TRACK.LENGTH / 2);
    this._track(null, line);
  }

  _buildBarriers() {
    const half = TRACK.ROAD_WIDTH / 2 + 0.5;
    const segLen = 20;
    const segments = Math.ceil(TRACK.LENGTH / segLen);
    const h = TRACK.BARRIER_HEIGHT;

    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0x10131f,
      metalness: 0.4,
      roughness: 0.5,
    });
    const neonMat = new THREE.MeshStandardMaterial({
      color: 0xff00ff,
      emissive: 0xff00ff,
      emissiveIntensity: 1.6,
    });

    for (let i = 0; i < segments; i++) {
      const z = i * segLen + segLen / 2;
      for (const side of [-1, 1]) {
        const x = side * half;

        // Physics barrier (hazard).
        const body = new CANNON.Body({ mass: 0, material: this.physics.materials.ground });
        body.addShape(new CANNON.Box(new CANNON.Vec3(0.5, h, segLen / 2)));
        body.position.set(x, h, z);
        body.isHazard = true;
        this._track(body, null);

        // Visual barrier + neon top strip.
        const wall = new THREE.Mesh(new THREE.BoxGeometry(1, h * 2, segLen - 0.4), barrierMat);
        wall.position.set(x, h, z);
        wall.castShadow = true;
        wall.receiveShadow = true;
        this._track(null, wall);

        const strip = new THREE.Mesh(
          new THREE.BoxGeometry(1.05, 0.15, segLen - 0.4),
          neonMat
        );
        strip.position.set(x, h * 2, z);
        this._track(null, strip);
      }
    }
  }

  _buildObstacles() {
    const obMat = new THREE.MeshStandardMaterial({
      color: 0xfb3b53,
      emissive: 0xfb3b53,
      emissiveIntensity: 0.5,
      roughness: 0.6,
    });
    const lane = TRACK.ROAD_WIDTH / 2 - 2;

    for (let i = 0; i < TRACK.OBSTACLE_COUNT; i++) {
      // Deterministic-ish scatter so the course is consistent run to run.
      const z = 50 + (i / TRACK.OBSTACLE_COUNT) * (TRACK.FINISH_Z - 70);
      const x = ((i * 73) % 100) / 100 * (lane * 2) - lane;
      const size = 0.8 + ((i * 37) % 5) * 0.15;

      const body = new CANNON.Body({ mass: 0, material: this.physics.materials.ground });
      body.addShape(new CANNON.Box(new CANNON.Vec3(size, size, size)));
      body.position.set(x, size, z);
      body.isHazard = true;
      this._track(body, null);

      const mesh = new THREE.Mesh(new THREE.BoxGeometry(size * 2, size * 2, size * 2), obMat);
      mesh.position.set(x, size, z);
      mesh.rotation.y = (i * 0.6) % Math.PI;
      mesh.castShadow = true;
      this._track(null, mesh);
    }
  }

  _buildFinishGate() {
    const z = TRACK.FINISH_Z;
    const w = TRACK.ROAD_WIDTH / 2 + 1;
    const gateMat = new THREE.MeshStandardMaterial({
      color: 0xa3e635,
      emissive: 0xa3e635,
      emissiveIntensity: 1.8,
    });

    const postGeo = new THREE.BoxGeometry(0.8, 8, 0.8);
    const left = new THREE.Mesh(postGeo, gateMat);
    left.position.set(-w, 4, z);
    const right = new THREE.Mesh(postGeo, gateMat);
    right.position.set(w, 4, z);
    const top = new THREE.Mesh(new THREE.BoxGeometry(w * 2 + 0.8, 0.8, 0.8), gateMat);
    top.position.set(0, 8, z);

    // A soft light at the finish to draw the eye.
    const light = new THREE.PointLight(0xa3e635, 1.4, 80);
    light.position.set(0, 6, z);

    this._track(null, left);
    this._track(null, right);
    this._track(null, top);
    this._track(null, light);

    this.finishZ = z;
  }

  dispose() {
    this.bodies.forEach((b) => this.physics.removeBody(b));
    this.meshes.forEach((m) => this.scene.remove(m));
    this.bodies.length = 0;
    this.meshes.length = 0;
  }
}
