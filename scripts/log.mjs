/**
 * Console logging for Ringmaker. `error` always logs (something failed or fell back); `debug` logs only while the
 * "Debug logging" world setting (`ringmaker.debugLog`, off by default) is on. Wanderer's Satchel switches the same setting.
 * Pure apart from the injected `isOn` and `con`, so it is tested in Node.
 */
export const LOG_ID = "ringmaker";
export const DEBUG_KEY = "debugLog";

/** @param {() => boolean} isOn reads the setting (may throw before it is registered) @param {Console} [con] */
export function createLog(isOn, con = console) {
  const on = () => { try { return isOn() === true; } catch { return false; } };
  return {
    enabled: on,
    debug: (...a) => { if (on()) con.debug(`${LOG_ID} |`, ...a); },
    error: (...a) => { con.error(`${LOG_ID} |`, ...a); }
  };
}

/** The live logger: reads game.settings each call (cheap; only called off hot paths). */
export const log = createLog(() => game.settings.get(LOG_ID, DEBUG_KEY));
