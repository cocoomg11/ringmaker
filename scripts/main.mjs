/**
 * Ringmaker entry point: settings, the settings menu, the API and the hooks.
 * API: game.modules.get("ringmaker").api = { applyAll({ npcOnly }), remove(), removePlan(), plan({ npcOnly }), status(), setPopOut(tokens, on) }.
 * applyAll and remove are active GM only; setPopOut is GM only.
 */
import * as Ring from "./ring.mjs";
import { RingmakerMenu } from "./menu.mjs";

export const API = {
  applyAll: (opts = {}) => Ring.applyAll(opts),
  remove: () => Ring.remove(),
  removePlan: () => Ring.removePlan(),
  plan: (opts = {}) => { const p = Ring.plan(opts); return { actors: p.actors.length, tokens: p.tokens }; },
  status: () => Ring.status(),
  setPopOut: (tokens, on = true) => Ring.setPopOut(tokens, on)
};

Hooks.once("init", () => {
  Ring.registerSettings();
  game.settings.registerMenu(Ring.ID, "menu", {
    name: "Ringmaker tools", label: "Open Ringmaker", hint: "Apply the ring to tokens already in the world, or remove Ringmaker's ring.",
    icon: "fa-solid fa-circle-notch", type: RingmakerMenu, restricted: true
  });
  game.modules.get(Ring.ID).api = API;
  Ring.init();
});

Hooks.once("ready", () => Ring.ready());
// Token configuration (placed and prototype tokens): the pop-out checkbox in the Dynamic Token Ring section.
Hooks.on("renderTokenApplication", (app, element) => Ring.addPopOutField(app, element));
