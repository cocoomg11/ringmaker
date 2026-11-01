/**
 * One GM does the writing. A world can have several GM users logged in at once; anything Ringmaker changes on its own (ringing
 * existing tokens at load) runs only on the active GM's client, so nothing happens twice. The pure helper is tested in Node.
 */

/** The active GM: Foundry's own pick when it is an active GM, else the active GM with the lowest user id, else null. */
export function pickActiveGM(users = [], declared = null) {
  if (declared && declared.isGM && declared.active) return declared;
  return [...users].filter(u => u?.isGM && u.active).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0] ?? null;
}

/** The active GM user of this world, or null when no GM is connected. */
export function activeGM() {
  try { return pickActiveGM(game.users?.contents ?? [...(game.users ?? [])], game.users?.activeGM ?? null); } catch { return null; }
}

/** True on the active GM's client only. */
export function isActiveGM() {
  const gm = activeGM(); return !!gm && gm.id === game.user?.id;
}

/**
 * Wraps every member of an API object so that a non-GM gets a notice and undefined, and nothing runs. `isGM` and `notify` are
 * functions so the check happens at call time (pure, tested in Node).
 */
export function gateApi(api, { isGM = () => !!game.user?.isGM, notify = msg => ui.notifications?.warn(msg), message = () => game.i18n.localize("RINGMAKER.notice.gmOnly") } = {}) {
  const out = {};
  for (const [name, fn] of Object.entries(api)) {
    out[name] = typeof fn === "function"
      ? (...args) => { if (!isGM()) { notify(message()); return undefined; } return fn(...args); }
      : fn;
  }
  return out;
}
