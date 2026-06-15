import { STORAGE_KEYS } from '../core/constants.js';

/**
 * Daily Tasks system — drives D1/D7 retention. A fresh set rolls each UTC day.
 * Examples: "Drift for 5 seconds", "Deliver 3 explosive cargos without damage".
 *
 * Scaffold: definitions + progress tracking + persistence. The live event hooks
 * (drift detector, delivery counter) are wired during the gameplay milestone.
 */
const TASK_POOL = [
  { id: 'drift5', label: 'Drift for 5 seconds', target: 5, metric: 'driftSeconds' },
  { id: 'explosive3', label: 'Deliver 3 explosive cargos without damage', target: 3, metric: 'explosiveClean' },
  { id: 'speed120', label: 'Hit 120 km/h', target: 120, metric: 'topSpeed' },
  { id: 'nospill', label: 'Complete a run with 100% cargo intact', target: 1, metric: 'perfectRuns' },
  { id: 'deliver5', label: 'Complete 5 deliveries', target: 5, metric: 'deliveries' },
];

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

export class DailyTasks {
  constructor(wallet) {
    this.wallet = wallet;
    this.state = this._loadOrRoll();
  }

  _loadOrRoll() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.DAILY) || 'null');
      if (saved && saved.day === todayKey()) return saved;
    } catch {
      /* ignore */
    }
    // Roll a new deterministic-ish set of 3 tasks for today.
    const picks = [...TASK_POOL].sort(() => Math.random() - 0.5).slice(0, 3);
    const fresh = {
      day: todayKey(),
      tasks: picks.map((t) => ({ ...t, progress: 0, claimed: false })),
    };
    this._save(fresh);
    return fresh;
  }

  _save(state = this.state) {
    try {
      localStorage.setItem(STORAGE_KEYS.DAILY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }

  /** Report progress for a metric; auto-completes tasks. */
  report(metric, value) {
    for (const t of this.state.tasks) {
      if (t.metric !== metric) continue;
      t.progress = metric === 'topSpeed' ? Math.max(t.progress, value) : t.progress + value;
    }
    this._save();
  }

  isComplete(task) {
    return task.progress >= task.target;
  }

  /** Claim a completed task's reward (optionally ad-boosted to 2x). */
  claim(taskId, { adBoosted = false } = {}) {
    const t = this.state.tasks.find((x) => x.id === taskId);
    if (!t || t.claimed || !this.isComplete(t)) return false;
    t.claimed = true;
    this._save();
    this.wallet.awardDaily({ adBoosted });
    return true;
  }
}
