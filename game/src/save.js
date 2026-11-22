// Save game: cash, the unlocked job and finished jobs live in localStorage.
// Nothing leaves the machine; a fresh browser starts Dana on job 1 with $0.
const KEY = 'coral-bay-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { money: 0, job: 0, finished: [] };
    const data = JSON.parse(raw);
    return {
      money: typeof data.money === 'number' ? data.money : 0,
      job: typeof data.job === 'number' ? data.job : 0,
      finished: Array.isArray(data.finished) ? data.finished : [],
    };
  } catch (_) {
    return { money: 0, job: 0, finished: [] };
  }
}

export function saveSave(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      money: data.money | 0,
      job: data.job | 0,
      finished: data.finished || [],
    }));
  } catch (_) {
    // Storage full or blocked (private mode): the game still plays, it just
    // does not remember. A save failure must never stop the game.
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (_) { /* ignore */ }
}
