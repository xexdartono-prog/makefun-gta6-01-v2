// Saving: money and missions completed live in localStorage, so Dana can
// come back to Coral Bay and keep her progress.

const KEY = 'coral-bay-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number' || typeof data.missionsDone !== 'number') return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function writeSave(world) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({
      money: world.money,
      missionsDone: world.missions ? world.missions.index : 0,
      savedAt: Date.now(),
    }));
  } catch (e) {
    // Private mode or a full store: the game plays on without saving.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(KEY);
  } catch (e) {
    // Nothing to clear.
  }
}
