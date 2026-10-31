/**
 * Ringmaker: your own ring image used through Foundry's dynamic token ring system (not an overlay). The module registers a ring
 * configuration (the initializeDynamicTokenRingConfig hook) whose spritesheet is a small JSON file in the module with one frame.
 * The frame's texture isn't read from disk: each client draws the image from the world setting into a 1024 × 512 canvas and hands
 * that texture to the spritesheet loader, so one image of any size is enough and it's one shared texture. The colour band is zero,
 * so the image keeps its own colours. Tokens then only need `ring.enabled`; their token image and the actor's portrait never change.
 *
 * Geometry follows Foundry's own rings (TokenRing): in a frame normalised to 1 at its edge, core rings put the subject inside radius
 * 0.6666666 and the ring band out to 0.6666666 + 0.1269848 ≈ 0.794; the background frame ("<ring>-bkg") is a disc under it. The ring
 * image's band is measured from its alpha and scaled so its outer edge lands on 0.794 (× the Ring size setting), and a background disc
 * the size of the ring's opening is drawn next to it. With "Ring in front of token art", a subclass of core's ring shader draws the
 * ring over the art, trims the art to the background disc and uses the token's own background colour exactly when one is set.
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
export const SHEET_SIZE = { w: FRAME * 2, h: FRAME };
export const FRAMES = { ring: "ringmaker-ring", bkg: "ringmaker-ring-bkg" };
/** Core ring geometry (TokenRing defaults), in frame units where 1 is the frame's edge. */
export const CORE = { subject: 0.6666666, thickness: 0.1269848 };
export const CORE_OUTER = CORE.subject + CORE.thickness;
export const DEFAULT_BG = "#2b2420";
export const PLUGIN = "ringmakerRingBatch";
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
export const clampScale = v => Math.min(1.5, Math.max(0.5, Math.round(num(v, 1) * 100) / 100));
/** The ring size setting (percent of core's ring size), kept to 50 – 125. */
export const clampSize = v => Math.min(125, Math.max(50, Math.round(num(v, 100))));
/** A "#rrggbb" colour, or the default. */
export const cssColor = (v, d = DEFAULT_BG) => { const c = String(v ?? "").trim(); return /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : d; };

/**
 * Mean alpha (0 – 255) by distance from the centre of a square RGBA image (ImageData-style flat array): index r averages the
 * pixels whose centres are r to r + 1 pixels out; the last index is size / 2.
 */
export function radialProfile(data, size) {
  const half = size / 2; const n = Math.floor(half) + 1; const sum = new Float64Array(n); const cnt = new Float64Array(n);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.floor(Math.hypot(x + 0.5 - half, y + 0.5 - half)); if (r >= n) continue;
    sum[r] += data[(y * size + x) * 4 + 3]; cnt[r]++;
  }
  return Array.from(sum, (v, i) => (cnt[i] ? v / cnt[i] : 0));
}

/**
 * The ring band in a radial alpha profile, as fractions of the half-size: outer is the last radius at least half opaque, inner
 * the first such radius going out from the centre. Soft shadows below half opacity don't count. null when there is no band.
 */
export function measureRing(profile, threshold = 128) {
  const last = profile.length - 1; if (last < 1) return null;
  let outer = -1; for (let r = last; r >= 0; r--) if (profile[r] >= threshold) { outer = r; break; }
  if (outer < 1) return null;
  let inner = outer; while (inner > 0 && profile[inner - 1] >= threshold) inner--;
  if (inner === 0) return null; // opaque all the way to the middle: not a ring
  return { outer: Math.min(1, (outer + 1) / last), inner: inner / last };
}

/**
 * Where the ring image goes in the frame: scale k (image drawn at k × the frame, centred) so the band's outer edge lands on core's
 * ring edge × size%, and the background disc radius (the opening plus half the band, so its edge sits under the ring). Frame units.
 */
export function ringLayout(band, sizePct = 100) {
  const b = band && band.outer > 0 && band.inner > 0 && band.inner < band.outer ? band : { outer: 1, inner: 0.84 };
  const outerR = Math.min(0.99, CORE_OUTER * clampSize(sizePct) / 100);
  const k = outerR / b.outer; const innerR = b.inner * k;
  return { scale: k, outerR, innerR, bkgR: innerR + (outerR - innerR) / 2 };
}

/** Lines of core's ring fragment shader (v14) that the Ringmaker shader changes. */
export const SHADER_LINES = {
  main: "vec4 _main() {",
  bkg: "vec4 backgroundColor = colorizeTokenBackground(texture(tokenRingTexture, vBackgroundTextureCoord), dist);",
  blend: "vec4 blendedResult = blend(processedColor, blend(ringColor, backgroundColor) * rectangularMask);"
};
const RM_BKG = `
    vec4 ringmakerBackground(in vec4 bkg, in float dist) {
      float waveFactor = hasState(STATE_BKG_WAVE) ? (0.5 + wave(dist) * 1.5) : 1.0;
      vec3 c = (vBackgroundColor == vec3(1.0)) ? unpremultiplySafe(bkg) : vBackgroundColor;
      return vec4(c, 1.0) * bkg.a * waveFactor;
    }

    `;
/**
 * Core's ring fragment shader with Ringmaker's changes: the background is the drawn disc's own colour, or exactly the token's
 * background colour when one is set; with front, the ring is drawn over the art and the art is trimmed to the background disc.
 * null when the source isn't the one this was written for (each line must occur exactly once), so core's shader is used instead.
 */
export function patchShader(src, { front = true } = {}) {
  if (typeof src !== "string") return null;
  for (const line of Object.values(SHADER_LINES)) if (src.split(line).length !== 2) return null;
  let out = src.replace(SHADER_LINES.main, `${RM_BKG}${SHADER_LINES.main}`)
    .replace(SHADER_LINES.bkg, "vec4 backgroundColor = ringmakerBackground(texture(tokenRingTexture, vBackgroundTextureCoord), dist);");
  if (front) out = out.replace(SHADER_LINES.blend, "float ringmakerMask = texture(tokenRingTexture, vBackgroundTextureCoord).a * rectangularMask;\n"
    + "    vec4 blendedResult = blend(ringColor * rectangularMask, blend(processedColor * ringmakerMask, backgroundColor * rectangularMask));");
  return out;
}

/**
 * The update that puts the ring on a token (or prototype token) source: { ring: { enabled, subject: { scale } }, flags }.
 * Keys are prefixed (e.g. "prototypeToken."). Returns null when nothing changes. The subject scale is only set when it is
 * untouched (1) or still the value Ringmaker set; a scale you chose yourself is kept. The first time, the previous values are
 * recorded in flags.ringmaker.prior so remove can put them back.
 */
export function ringUpdate(src, { scale = 1, prefix = "" } = {}) {
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
const scale = () => clampScale(S("artScale"));
const size = () => clampSize(S("ringSize"));
const bg = () => cssColor(S("background"));
const front = () => S("ringInFront") !== false;
const actorOf = t => t.actor ?? game.actors.get(t.actorId) ?? null;
let texture = null; let loadError = null; let hooked = false; let band = null; let shaderPatched = false;

export function registerSettings() {
  const s = (key, name, hint, type, def, extra = {}) => game.settings.register(ID, key, { name, hint, scope: "world", config: true, type, default: def, ...extra });
  s("image", "Ring image", "A square PNG with a transparent middle (256 × 256 or larger). Used by every token with Foundry's dynamic ring turned on. Leave empty to leave Foundry's own ring alone. Reloads Foundry.", String, "", { filePicker: "image", requiresReload: true });
  s("targets", "Which tokens", "Which tokens Ringmaker turns the ring on for. NPCs are actors that aren't of the \"character\" type and that no player owns.", String, "npc", { choices: TARGETS });
  s("newTokens", "Ring new tokens", "Tokens placed from now on get the ring as they're created.", Boolean, true);
  s("ringSize", "Ring size", "How big the ring is, as a percentage of Foundry's own ring (100 = the same size as core rings). Ringmaker finds the ring band in your image and scales it to this size; the background and the token art follow. Reloads Foundry.", Number, 100, { range: { min: 50, max: 125, step: 1 }, requiresReload: true });
  s("background", "Background colour", "The colour behind the token art, inside the ring. A token's own ring background colour (Token configuration) is used instead when it has one. Reloads Foundry.", new foundry.data.fields.ColorField({ required: true, nullable: false, blank: false, initial: DEFAULT_BG }), DEFAULT_BG, { requiresReload: true });
  s("ringInFront", "Ring in front of token art", "Draw the ring over the token art and trim the art to the ring's opening. Turn off for Foundry's own order (art over the ring, so cut-out art can reach past it). Reloads Foundry.", Boolean, true, { requiresReload: true });
  s("artScale", "Token art size inside the ring", "Foundry's ring subject scale, set on the tokens Ringmaker rings. 1 (Foundry's default) keeps the ring at its normal size; below 1 the ring grows around the art, above 1 it shrinks. A scale you set on a token yourself is kept.", Number, 1, { range: { min: 0.5, max: 1.5, step: 0.01 } });
  s("existingOnLoad", "Ring existing tokens on load", "Each time the world loads, the active GM puts the ring on any token (and actor prototype token) that should have it and doesn't yet.", Boolean, false);
}

/** init: with an image chosen, registers the ring configuration, the texture the spritesheet uses, and the hooks. */
export function init() {
  if (!image() || hooked) return; // nothing to show: Foundry's own ring is left as it is
  hooked = true;
  Hooks.on("initializeDynamicTokenRingConfig", cfg => {
    const D = foundry.canvas?.placeables?.tokens?.DynamicRingData;
    if (!D) return console.warn(`${ID} | dynamic token rings not available`);
    const shaderClass = ringShader();
    cfg.addConfig(RING_ID, new D({ id: RING_ID, label: "Ringmaker", spritesheet: SHEET, ...(shaderClass ? { framework: { shaderClass } } : {}) }));
  });
  // Made the active ring style before the canvas creates its renderer, so core registers Ringmaker's shader plugin itself.
  Hooks.once("canvasConfig", () => { try { CONFIG.Token.ring.useConfig(RING_ID); } catch { } });
  // Registered before the canvas loads the spritesheet: the loader reads the frames from the JSON and takes this texture.
  Hooks.once("setup", () => {
    const el = document.createElement("canvas"); el.width = SHEET_SIZE.w; el.height = SHEET_SIZE.h;
    texture = PIXI.Texture.from(el);
    try { PIXI.Assets.add({ alias: SHEET, src: SHEET, data: { texture } }); } catch (e) { console.warn(`${ID} | ring texture`, e); }
    try { foundry.canvas.TextureLoader.pinSource?.(SHEET); } catch { }
    draw(el).catch(e => { loadError = e?.message ?? String(e); console.warn(`${ID} | ring image "${image()}" couldn't be loaded`, e); });
  });
  // Foundry picks the ring configuration after the setup hook; use ours before each canvas draw loads its textures.
  Hooks.on("canvasInit", () => {
    try {
      CONFIG.Token.ring.useConfig(RING_ID);
      const BR = foundry.canvas.rendering?.batching?.BatchRenderer; const Core = coreShader();
      if (shaderPatched && Core && BR && !BR.hasPlugin(PLUGIN)) { CONFIG.Token.ring.shaderClass = Core; shaderPatched = false; } // not registered: core's shader
    } catch { }
  });
  Hooks.on("preCreateToken", (doc, data, options, userId) => {
    if (userId !== game.user.id || !S("newTokens")) return;
    if (!wants(actorOf(doc), mode())) return;
    const u = ringUpdate(doc._source, { scale: scale() }); if (u) doc.updateSource(foundry.utils.expandObject(u));
  });
}

const coreShader = () => foundry.canvas.rendering?.shaders?.TokenRingSamplerShader ?? null;
/** A subclass of core's ring shader with Ringmaker's changes, or null (core's shader is used) when its source isn't as expected. */
function ringShader() {
  const Core = coreShader(); const frag = Core && patchShader(Core._batchFragmentShader, { front: front() });
  if (!frag) { console.warn(`${ID} | core ring shader not as expected; using Foundry's own (art over the ring)`); return null; }
  shaderPatched = true;
  return class RingmakerRingShader extends Core {
    static classPluginName = PLUGIN;
    static _batchFragmentShader = frag;
  };
}

async function draw(el) {
  const img = new Image(); img.decoding = "async";
  if (/^https?:/i.test(image())) img.crossOrigin = "anonymous"; // a tainted canvas can't be uploaded to the GPU
  img.src = image();
  await img.decode();
  // The image, fitted into a square, then measured to find its ring band.
  const sq = document.createElement("canvas"); sq.width = sq.height = FRAME; const sctx = sq.getContext("2d", { willReadFrequently: true });
  const r = fitRect(img.naturalWidth, img.naturalHeight); sctx.drawImage(img, r.x, r.y, r.w, r.h);
  band = measureRing(radialProfile(sctx.getImageData(0, 0, FRAME, FRAME).data, FRAME));
  const L = ringLayout(band, size()); const d = FRAME * L.scale;
  const ctx = el.getContext("2d"); ctx.clearRect(0, 0, el.width, el.height);
  ctx.drawImage(sq, (FRAME - d) / 2, (FRAME - d) / 2, d, d); // ring frame
  ctx.fillStyle = bg(); ctx.beginPath(); ctx.arc(FRAME * 1.5, FRAME / 2, L.bkgR * FRAME / 2, 0, Math.PI * 2); ctx.fill(); // background frame
  texture.baseTexture.update();
  loadError = band ? null : "no ring band found in the image (it needs a transparent middle); drawn to fit the frame";
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
  const st = { image: image(), mode: mode(), scale: scale(), size: size(), background: bg(), front: front(), shader: shaderPatched, band, registered: false, active: null, error: loadError };
  try { st.registered = CONFIG.Token.ring.configIDs.includes(RING_ID); st.active = CONFIG.Token.ring.id === RING_ID; } catch { }
  return st;
}
