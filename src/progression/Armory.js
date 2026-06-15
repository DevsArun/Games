import { STORAGE_KEYS } from '../core/constants.js';

/**
 * The Armory / Garage shop. Players spend Neon Coins on:
 *   - Engine upgrades (more torque)
 *   - Suspension upgrades (stiffer, more stable under load)
 *   - Cosmetic skins (Neon Underglow, Matte Black, Titanium Rims)
 *
 * Scaffold: catalog + ownership/levels + purchase logic + persistence.
 * Rendering of the shop grid lives in the meta-game UI milestone.
 */
export const CATALOG = {
  upgrades: {
    engine: { name: 'Engine', maxLevel: 5, baseCost: 500, costGrowth: 1.6 },
    suspension: { name: 'Suspension', maxLevel: 5, baseCost: 450, costGrowth: 1.6 },
  },
  skins: [
    { id: 'neon_underglow', name: 'Neon Underglow', cost: 800 },
    { id: 'matte_black', name: 'Matte Black Paint', cost: 600 },
    { id: 'titanium_rims', name: 'Titanium Rims', cost: 1000 },
  ],
};

export class Armory {
  constructor(wallet) {
    this.wallet = wallet;
    this.state = this._load();
  }

  _load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.GARAGE) || 'null');
      if (saved) return saved;
    } catch {
      /* ignore */
    }
    return { levels: { engine: 1, suspension: 1 }, skins: [], equippedSkin: null };
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEYS.GARAGE, JSON.stringify(this.state));
    } catch {
      /* ignore */
    }
  }

  upgradeCost(key) {
    const u = CATALOG.upgrades[key];
    const level = this.state.levels[key];
    return Math.round(u.baseCost * Math.pow(u.costGrowth, level - 1));
  }

  buyUpgrade(key) {
    const u = CATALOG.upgrades[key];
    if (!u || this.state.levels[key] >= u.maxLevel) return false;
    if (!this.wallet.debit(this.upgradeCost(key))) return false;
    this.state.levels[key] += 1;
    this._save();
    return true;
  }

  buySkin(id) {
    const skin = CATALOG.skins.find((s) => s.id === id);
    if (!skin || this.state.skins.includes(id)) return false;
    if (!this.wallet.debit(skin.cost)) return false;
    this.state.skins.push(id);
    this._save();
    return true;
  }

  equipSkin(id) {
    if (!this.state.skins.includes(id)) return false;
    this.state.equippedSkin = id;
    this._save();
    return true;
  }

  /** Upgrade levels consumed by Truck construction. */
  getTruckUpgrades() {
    return {
      engineLevel: this.state.levels.engine,
      suspensionLevel: this.state.levels.suspension,
    };
  }
}
