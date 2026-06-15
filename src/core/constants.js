/**
 * Single source of truth for tunable game constants.
 * Keep gameplay/physics numbers HERE so balancing never requires hunting through modules.
 */

export const APP = {
  TITLE: 'NEON HAUL: TRUCK SIMULATOR',
  VERSION: '0.1.0',
  // Bump this when the ghost serialization format changes (invalidates old ?challenge= links).
  GHOST_SCHEMA: 1,
};

// Fixed-step physics keeps simulation deterministic across devices → fair ghost replays.
export const PHYSICS = {
  FIXED_TIMESTEP: 1 / 60, // seconds
  MAX_SUBSTEPS: 4,
  GRAVITY: -9.82,
  SOLVER_ITERATIONS: 10,
};

// A semi-truck must feel HEAVY. These drive Cannon RaycastVehicle + suspension.
export const TRUCK = {
  CHASSIS_MASS: 4200, // kg — loaded cab+frame, deliberately hefty
  CHASSIS_SIZE: { x: 1.1, y: 0.7, z: 3.4 }, // half-extents (m)
  CENTER_OF_MASS_OFFSET: { x: 0, y: -0.45, z: 0 }, // drop CoM for stability
  WHEEL: {
    radius: 0.55,
    suspensionStiffness: 38,
    suspensionRestLength: 0.45,
    suspensionMaxTravel: 0.3,
    dampingRelaxation: 2.8,
    dampingCompression: 4.6,
    frictionSlip: 4.5,
    rollInfluence: 0.05,
    maxSuspensionForce: 1e5,
  },
  ENGINE_FORCE: 7000, // base; scaled by garage upgrades
  BRAKE_FORCE: 90,
  MAX_STEER: 0.55, // radians
  STEER_SPEED: 2.4, // how fast steering lerps toward target
};

// Cargo are dynamic rigid bodies. Turn too hard → they slide/topple → mission fails.
export const CARGO = {
  MASS: 220,
  SIZE: { x: 0.6, y: 0.6, z: 0.6 },
  SPILL_HEIGHT: 0.25, // if cargo drops below trailer bed by this much → "spilled"
  INTACT_THRESHOLD: 0.6, // mission fails below 60% cargo intact
};

export const MISSION = {
  DEFAULT_TIME_LIMIT: 180, // seconds
  MAX_DAMAGE: 100,
  DAMAGE_PER_IMPACT: 6, // scaled by impact velocity
};

// Meta-game economy.
export const ECONOMY = {
  CURRENCY: 'Neon Coins',
  DAILY_TASK_REWARD: 150,
  AD_MULTIPLIER: 2, // "Watch Ad to Double Rewards"
};

// LocalStorage keys — namespaced to avoid collisions inside the CrazyGames iframe.
export const STORAGE_KEYS = {
  PROFILE: 'nh:profile',
  WALLET: 'nh:wallet',
  GARAGE: 'nh:garage',
  DAILY: 'nh:daily',
  LAST_GHOST: 'nh:ghost:last',
  CHALLENGE_PREFIX: 'nh:ghost:',
};

export const URL_PARAMS = {
  CHALLENGE: 'challenge', // ?challenge=<base64url ghost blob>
};
