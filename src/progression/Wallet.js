import { STORAGE_KEYS, ECONOMY } from '../core/constants.js';

/**
 * Neon Coins wallet — persisted to localStorage. Source of truth for the economy.
 * Garage purchases debit here; daily tasks + ads credit here.
 */
export class Wallet {
  constructor() {
    this.balance = this._load();
    this._listeners = new Set();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.WALLET);
      return raw ? Math.max(0, parseInt(JSON.parse(raw).balance, 10) || 0) : 0;
    } catch {
      return 0;
    }
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEYS.WALLET, JSON.stringify({ balance: this.balance }));
    } catch {
      /* storage may be blocked inside some iframes — degrade gracefully */
    }
    this._listeners.forEach((fn) => fn(this.balance));
  }

  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  credit(amount) {
    this.balance += Math.max(0, Math.floor(amount));
    this._save();
    return this.balance;
  }

  /** @returns {boolean} true if the debit succeeded (sufficient funds). */
  debit(amount) {
    amount = Math.max(0, Math.floor(amount));
    if (amount > this.balance) return false;
    this.balance -= amount;
    this._save();
    return true;
  }

  /** Award a daily task, doubled if an ad was watched. */
  awardDaily({ adBoosted = false } = {}) {
    const reward = ECONOMY.DAILY_TASK_REWARD * (adBoosted ? ECONOMY.AD_MULTIPLIER : 1);
    return this.credit(reward);
  }
}
