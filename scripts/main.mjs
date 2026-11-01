/**
 * Ringmaker entry point: settings, the settings menu, the API and the hooks.
 * API: game.modules.get("ringmaker").api = { applyAll({ npcOnly }), remove({ confirm }), removePlan(), plan({ npcOnly }), status(),
 * setPopOut(tokens, on), setArtZoom(tokens, zoom), setArtFraming(tokens, { zoom, focus }), fitArt(tokens) }.
 * Every member is GM only (others get a notice and undefined). applyAll and remove are active GM only; setPopOut, setArtZoom, setArtFraming and fitArt are GM only. remove() asks nothing unless { confirm: true }.
 */
import * as Ring from "./ring.mjs";
import { RingmakerMenu } from "./menu.mjs";
import { gateApi } from "./gm.mjs";

const RAW_API = {
  applyAll: (opts = {}) => Ring.applyAll(opts),
  remove: (opts = {}) => Ring.remove(opts),
  removePlan: () => Ring.removePlan(),
  plan: (opts = {}) => { const p = Ring.plan(opts); return { actors: p.actors.length, tokens: p.tokens }; },
  status: () => Ring.status(),
  setPopOut: (tokens, on = true) => Ring.setPopOut(tokens, on),
  setArtZoom: (tokens, zoom = 1) => Ring.setArtZoom(tokens, zoom),
  setArtFraming: (tokens, framing = {}) => Ring.setArtFraming(tokens, framing),
  fitArt: tokens => Ring.fitArt(tokens)
};
/** Every member is GM only: a player gets a "GM only" notice and undefined. */
export const API = gateApi(RAW_API);

Hooks.once("init", () => {
  Ring.registerSettings();
  game.settings.registerMenu(Ring.ID, "menu", {
    name: "RINGMAKER.menu.name", label: "RINGMAKER.menu.label", hint: "RINGMAKER.menu.hint",
    icon: "fa-solid fa-circle-notch", type: RingmakerMenu, restricted: true
  });
  game.modules.get(Ring.ID).api = API;
  Ring.init();
});

Hooks.once("ready", () => Ring.ready());
// Token configuration (placed and prototype tokens): the pop-out checkbox in the Dynamic Token Ring section.
Hooks.on("renderTokenApplication", (app, element) => Ring.addPopOutField(app, element));
