/**
 * Ringmaker: your own ring image used through Foundry's dynamic token ring system (not an overlay). The module registers a ring
 * configuration (the initializeDynamicTokenRingConfig hook) whose spritesheet is a small JSON file in the module with one frame.
 * The frame's texture isn't read from disk: each client draws the image from the world setting into a 512 × 512 canvas and hands
 * that texture to the spritesheet loader, so one image of any size is enough and it's one shared texture. The colour band is zero,
 * so the image keeps its own colours. Tokens then only need `ring.enabled`; their token image and the actor's portrait never change.
 *
 * Which tokens: NPCs only (default) or every token. "NPC" is system-neutral: an actor whose type isn't "character" and that no
 * player owns. New tokens get the ring as they're created; existing ones with Apply (active GM, batched). What Ringmaker changed is
 * recorded on each token (flags.ringmaker.prior) so Remove puts it back.
 * The helpers at the top take plain objects and are tested in Node; nothing here touches Foundry at import time.
 */
import { isActiveGM } from "./gm.mjs";

export const ID = "ringmaker";
export const RING_ID = "ringmaker";
export const SHEET = `modules/${ID}/assets/token-ring.json`;
export const FRAME = 512;
export const FLAG = "prior";
export const TARGETS = { npc: "NPCs only", all: "Every token (player characters too)" };
const BATCH = 100;

// ---------------------------------------------------------------- pure helpers
/** An NPC in any system: an actor whose type isn't "character" and that no player owns. */
export function isNpc(actor) {
  if (!actor) return false;
  return actor.type !== "character" && !actor.hasPlayerOwner;
}

/** Whether a token of this actor gets the ring. No actor, no ring. */
export function wants(actor, mode = "npc") {
  if (!actor) return false;
  return mode === "all" ? true : isNpc(actor);
}

const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
/** The subject scale setting, kept to 0.5 – 1.5. */
export const clampScale = v => Math.min(1.5, Math.max(0.5, Math.round(num(v, 0.85) * 100) / 100));

/**
 * The update that puts the ring on a token (or prototype token) source: { ring: { enabled, subject: { scale } }, flags }.
 * Keys are prefixed (e.g. "prototypeToken."). Returns null when nothing changes. The subject scale is only set when it is
 * untouched (1) or still the value Ringmaker set; a scale you chose yourself is kept. The first time, the previous values are
 * recorded in flags.ringmaker.prior so remove can put them back.
 */
export function ringUpdate(src, { scale = 0.85, prefix = "" } = {}) {
  const ring = src?.ring ?? {}; const rec = src?.flags?.[ID]?.[FLAG] ?? null;
  const enabled = !!ring.enabled; const cur = num(ring.subject?.scale, 1);
  const s = clampScale(scale);
  const ownScale = cur === 1 || (rec && cur === rec.applied);
  const out = {};
  if (!enabled) out[`${prefix}ring.enabled`] = true;
  const newScale = ownScale ? s : cur;
  if (newScale !== cur) out[`${prefix}ring.subject.scale`] = newScale;
  if (!Object.keys(out).length) return null;
  out[`${prefix}flags.${ID}.${FLAG}`] = { enabled: rec ? !!rec.enabled : enabled, scale: rec ? num(rec.scale, 1) : cur, applied: ownScale ? s : (rec?.applied ?? null) };
  return out;
}

/** The update that takes Ringmaker's ring off again (the recorded values come back). null when Ringmaker never changed it. */
export function ringRevert(src, { prefix = "" } = {}) {
  const rec = src?.flags?.[ID]?.[FLAG]; if (!rec || typeof rec !== "object") return null;
  const out = { [`${prefix}ring.enabled`]: !!rec.enabled, [`${prefix}flags.${ID}.${FLAG}`]: null };
  const cur = num(src?.ring?.subject?.scale, 1);
  if (rec.applied != null && cur === rec.applied) out[`${prefix}ring.subject.scale`] = num(rec.scale, 1);
  return out;
}

/** Where to draw an image of w × h in the square frame: centred, scaled to fit. */
export function fitRect(w, h, size = FRAME) {
  if (!(w > 0 && h > 0)) return { x: 0, y: 0, w: size, h: size };
  const k = Math.min(size / w, size / h); const dw = w * k, dh = h * k;
  return { x: (size - dw) / 2, y: (size - dh) / 2, w: dw, h: dh };
}

/** Splits a list into batches. */
export const chunks = (arr, n = BATCH) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

/** Turns the record flag's null (remove it) into the deletion Foundry wants: v14's deletion operator, or the older "-=" key. */
export function foundryDeletes(list, del = globalThis._del) {
  const tail = `flags.${ID}.${FLAG}`;
  for (const u of list) for (const k of Object.keys(u)) {
    if (!k.endsWith(tail) || u[k] !== null) continue;
    delete u[k]; if (del) u[k] = del; else u[k.replace(new RegExp(`${FLAG}$`), `-=${FLAG}`)] = null;
  }
  return list;
}

// ---------------------------------------------------------------- Foundry side
const S = key => game.settings.get(ID, key);
const image = () => String(S("image") ?? "").trim();
const mode = () => S("targets") === "all" ? "all" : "npc";
const scale = () => clampScale(S("subjectScale"));
const actorOf = t => t.actor ?? game.actors.get(t.actorId) ?? null;
let texture = null; let loadError = null; let hooked = false;

export function registerSettings() {
  const s = (key, name, hint, type, def, extra = {}) => game.settings.register(ID, key, { name, hint, scope: "world", config: true, type, default: def, ...extra });
  s("image", "Ring image", "A square PNG with a transparent middle (256 × 256 or larger). Used by every token with Foundry's dynamic ring turned on. Leave empty to leave Foundry's own ring alone. Reloads Foundry.", String, "", { filePicker: "image", requiresReload: true });
  s("targets", "Which tokens", "Which tokens Ringmaker turns the ring on for. NPCs are actors that aren't of the \"character\" type and that no player owns.", String, "npc", { choices: TARGETS });
  s("newTokens", "Ring new tokens", "Tokens placed from now on get the ring as they're created.", Boolean, true);
  s("subjectScale", "Token art size inside the ring", "Foundry's ring subject scale, set on the tokens Ringmaker rings. Below 1 the ring sits outside the token art; 1 draws the art over the ring. A scale you set on a token yourself is kept.", Number, 0.85, { range: { min: 0.5, max: 1.5, step: 0.01 } });
  s("existingOnLoad", "Ring existing tokens on load", "Each time the world loads, the active GM puts the ring on any token (and actor prototype token) that should have it and doesn't yet.", Boolean, false);
}

/** init: with an image chosen, registers the ring configuration, the texture the spritesheet uses, and the hooks. */
export function init() {
  if (!image() || hooked) return; // nothing to show: Foundry's own ring is left as it is
  hooked = true;
  Hooks.on("initializeDynamicTokenRingConfig", cfg => {
    const D = foundry.canvas?.placeables?.tokens?.DynamicRingData;
    if (!D) return console.warn(`${ID} | dynamic token rings not available`);
    cfg.addConfig(RING_ID, new D({ id: RING_ID, label: "Ringmaker", spritesheet: SHEET }));
  });
  // Registered before the canvas loads the spritesheet: the loader reads the frames from the JSON and takes this texture.
  Hooks.once("setup", () => {
    const el = document.createElement("canvas"); el.width = el.height = FRAME;
    texture = PIXI.Texture.from(el);
    try { PIXI.Assets.add({ alias: SHEET, src: SHEET, data: { texture } }); } catch (e) { console.warn(`${ID} | ring texture`, e); }
    try { foundry.canvas.TextureLoader.pinSource?.(SHEET); } catch { }
    draw(el).catch(e => { loadError = e?.message ?? String(e); console.warn(`${ID} | ring image "${image()}" couldn't be loaded`, e); });
  });
  // Foundry picks the ring configuration after the setup hook; use ours before each canvas draw loads its textures.
  Hooks.on("canvasInit", () => { try { CONFIG.Token.ring.useConfig(RING_ID); } catch { } });
  Hooks.on("preCreateToken", (doc, data, options, userId) => {
    if (userId !== game.user.id || !S("newTokens")) return;
    if (!wants(actorOf(doc), mode())) return;
    const u = ringUpdate(doc._source, { scale: scale() }); if (u) doc.updateSource(foundry.utils.expandObject(u));
  });
}

async function draw(el) {
  const img = new Image(); img.decoding = "async";
  if (/^https?:/i.test(image())) img.crossOrigin = "anonymous"; // a tainted canvas can't be uploaded to the GPU
  img.src = image();
  await img.decode();
  const r = fitRect(img.naturalWidth, img.naturalHeight);
  const ctx = el.getContext("2d"); ctx.clearRect(0, 0, FRAME, FRAME); ctx.drawImage(img, r.x, r.y, r.w, r.h);
  texture.baseTexture.update();
  loadError = null;
}

export function ready() {
  if (image() && S("existingOnLoad") && isActiveGM() && plan().count) applyAll({ quiet: true });
}

/** Every token source that should get the ring (or come back), without changing anything. */
export function plan({ npcOnly = mode() === "npc", revert = false } = {}) {
  const m = npcOnly ? "npc" : "all"; const sc = scale();
  const actors = []; const scenes = [];
  for (const a of game.actors) {
    if (!revert && !wants(a, m)) continue;
    const u = revert ? ringRevert(a._source.prototypeToken, { prefix: "prototypeToken." }) : ringUpdate(a._source.prototypeToken, { scale: sc, prefix: "prototypeToken." });
    if (u) actors.push({ _id: a.id, ...u });
  }
  for (const s of game.scenes) {
    const ups = [];
    for (const t of s.tokens) {
      if (!revert && !wants(actorOf(t), m)) continue;
      const u = revert ? ringRevert(t._source) : ringUpdate(t._source, { scale: sc });
      if (u) ups.push({ _id: t.id, ...u });
    }
    if (ups.length) scenes.push([s, ups]);
  }
  const count = actors.length + scenes.reduce((n, [, u]) => n + u.length, 0);
  return { actors, scenes, count, tokens: count - actors.length };
}

const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
async function run(p, verb, quiet) {
  foundryDeletes(p.actors); for (const [, ups] of p.scenes) foundryDeletes(ups);
  for (const c of chunks(p.actors)) await Actor.updateDocuments(c);
  for (const [s, ups] of p.scenes) for (const c of chunks(ups)) await s.updateEmbeddedDocuments("Token", c);
  if (!quiet || p.count) ui.notifications.info(`Ringmaker: ring ${verb} ${plural(p.actors.length, "actor prototype token")} and ${plural(p.tokens, "placed token")}.`);
  return { actors: p.actors.length, tokens: p.tokens };
}

function gmCheck() {
  if (!game.user.isGM || !isActiveGM()) { ui.notifications.warn("Ringmaker: only the active GM can change tokens."); return false; }
  return true;
}

/** Active GM: turns the ring on for the prototype tokens of matching actors and every matching placed token. Art is untouched. */
export async function applyAll({ npcOnly = mode() === "npc", quiet = false } = {}) {
  if (!gmCheck()) return null;
  if (!image()) { ui.notifications.warn("Ringmaker: choose a ring image in the module settings first."); return null; }
  return run(plan({ npcOnly }), "put on", quiet);
}

/** Active GM: undoes what Ringmaker changed (ring on/off and its scale), on prototype tokens and placed tokens alike. */
export async function remove() {
  if (!gmCheck()) return null;
  return run(plan({ revert: true }), "taken off", false);
}

/** What's set and whether the ring is in use. */
export function status() {
  const st = { image: image(), mode: mode(), scale: scale(), registered: false, active: null, error: loadError };
  try { st.registered = CONFIG.Token.ring.configIDs.includes(RING_ID); st.active = CONFIG.Token.ring.id === RING_ID; } catch { }
  return st;
}
