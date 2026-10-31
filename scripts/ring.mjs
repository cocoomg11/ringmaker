/**
 * Ringmaker: your own ring image used through Foundry's dynamic token ring system (not an overlay). The module registers a ring
 * configuration (the initializeDynamicTokenRingConfig hook) whose spritesheet is a small JSON file in the module with one frame.
 * The frame's texture isn't read from disk: each client draws the image from the world setting into a 1024 × 512 canvas and hands
 * that texture to the spritesheet loader, so one image of any size is enough and it's one shared texture. The colour band covers the
 * ring band but the patched shader only tints it with a ring effect or colour, so the image keeps its own colours otherwise. Tokens
 * then only need `ring.enabled`; their token image and the actor's portrait never change.
 *
 * Geometry follows Foundry's own rings (TokenRing): in a frame normalised to 1 at its edge, core rings put the subject inside radius
 * 0.6666666 and the ring band out to 0.6666666 + 0.1269848 ≈ 0.794; the background frame ("<ring>-bkg") is a disc under it. The ring
 * image's band is measured from its alpha and scaled so its outer edge lands on 0.794 (× the Ring size setting), and a background disc
 * the size of the ring's opening is drawn next to it. With "Ring in front of token art", a subclass of core's ring shader draws the
 * ring over the art, trims the art to the background disc and uses the token's own background colour exactly when one is set.
 *
 * Pop-out tokens (flags.ringmaker.popOut): a TokenRing subclass adds a state bit (POPOUT_STATE) for them, and with the ring in front
 * the shader draws the art outside the background disc over the ring instead of trimming it; art inside the disc stays under the
 * ring as for other tokens. So the parts of a cut-out image that reach past the ring show in front of it.
 *
 * Art framing (flags.ringmaker.artZoom, flags.ringmaker.artFocus): the ring class divides core's texture scale adjustment by the
 * zoom in configureSize, and the shader's geometry packing carries the focus (the image point drawn at the ring's centre) to a
 * patched vertex shader inside the colour band attribute, as there is no spare vertex attribute. Off with the artZoom setting.
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
/** Token flag (flags.ringmaker.popOut): let the art break out of the ring. */
export const POPOUT = "popOut";
/** Token flag (flags.ringmaker.artZoom): how much the art is zoomed out (> 1) or in (< 1) inside the ring; 1 or absent = Foundry's framing. */
export const ARTZOOM = "artZoom";
export const ZOOM_RANGE = { min: 0.5, max: 3 };
/** Token flag (flags.ringmaker.artFocus): { x, y } in 0 – 1 of the image, the point drawn at the ring's centre (the face). */
export const ARTFOCUS = "artFocus";
/** The focus is carried to the vertex shader packed into the colour band attribute: band in [0, 2), focus × FOCUS_STEPS × 2 above. */
export const FOCUS_STEPS = 1000;
const CENTRE = Object.freeze({ x: 0.5, y: 0.5 });
/** Ring state bit for pop-out tokens, above core's TokenRing effects (0x01 – 0x20). */
export const POPOUT_STATE = 0x40;
export const TARGETS = { npc: "NPCs only", all: "Every token (player characters too)" };
/** Ring effect on targeted tokens (setting targetEffect). Pulse and gradient are core TokenRing effects; flash is TokenRing#flashColor. */
export const TARGET_EFFECTS = { off: "Off", pulse: "Pulse", gradient: "Gradient", flash: "Flash once (in the targeting player's colour)" };
/** Core's TokenRing.effects values (v14), used when the live enum isn't there. */
export const CORE_EFFECTS = { RING_PULSE: 0x02, RING_GRADIENT: 0x04 };
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
  blend: "vec4 blendedResult = blend(processedColor, blend(ringColor, backgroundColor) * rectangularMask);",
  pulse: "vec3 pulseColor = vRingColor * redChannel * pulseFactor;",
  mix: "float mixFactor = step(vRingColorBand.x, dist) - step(vRingColorBand.y, dist);"
};
/**
 * Core tints the colour band with vRingColor × the image's red channel, and only where the band is. A ring image with no colour
 * band keeps its colours; with a ring effect (pulse/gradient) or a ring colour (flash, a token's own ring colour) the band is the
 * image itself, darkened by the pulse or tinted by the colour, so the effect is visible on any image.
 */
const RM_PULSE = "vec3 pulseColor = ((vRingColor == vec3(1.0)) ? tokenColor : vRingColor * redChannel) * pulseFactor;";
const RM_MIX = "float mixFactor = (step(vRingColorBand.x, dist) - step(vRingColorBand.y, dist)) * ((hasState(STATE_RING_PULSE) || hasState(STATE_RING_GRADIENT) || (vRingColor != vec3(1.0))) ? 1.0 : 0.0);";
const POPOUT_GLSL = `0x${POPOUT_STATE.toString(16)}U`;
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
 * Pop-out tokens (state bit POPOUT_STATE) also get the art outside the background disc drawn over the ring instead of trimmed.
 * null when the source isn't the one this was written for (each line must occur exactly once), so core's shader is used instead.
 */
export function patchShader(src, { front = true } = {}) {
  if (typeof src !== "string") return null;
  for (const line of Object.values(SHADER_LINES)) if (src.split(line).length !== 2) return null;
  let out = src.replace(SHADER_LINES.main, `${RM_BKG}${SHADER_LINES.main}`)
    .replace(SHADER_LINES.bkg, "vec4 backgroundColor = ringmakerBackground(texture(tokenRingTexture, vBackgroundTextureCoord), dist);")
    .replace(SHADER_LINES.pulse, RM_PULSE).replace(SHADER_LINES.mix, RM_MIX);
  if (front) out = out.replace(SHADER_LINES.blend, "float ringmakerMask = texture(tokenRingTexture, vBackgroundTextureCoord).a * rectangularMask;\n"
    + "    vec4 blendedResult = blend(ringColor * rectangularMask, blend(processedColor * ringmakerMask, backgroundColor * rectangularMask));\n"
    + `    if ( (vStates & ${POPOUT_GLSL}) != 0U ) blendedResult = blend(processedColor * (1.0 - ringmakerMask), blendedResult);`);
  return out;
}

/**
 * The update that puts the ring on a token (or prototype token) source: { ring: { enabled, subject: { scale } }, flags }.
 * Keys are prefixed (e.g. "prototypeToken."). Returns null when nothing changes. The subject scale is only set when it is
 * untouched (1) or still the value Ringmaker set; a scale you chose yourself is kept. The first time, the previous values are
 * recorded in flags.ringmaker.prior so remove can put them back. A token whose ring is already on (and so needs no ring change)
 * still gets the record the first time, so Remove knows Ringmaker went over it and puts it back to exactly that state.
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
  if (!Object.keys(out).length && rec) return null;
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

/** Whether a token (or prototype token) source has pop-out on. */
export const isPopOut = src => src?.flags?.[ID]?.[POPOUT] === true;

/** An art zoom value kept to its range, rounded to 2 decimals; 1 for anything unusable. */
export const clampZoom = v => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.min(ZOOM_RANGE.max, Math.max(ZOOM_RANGE.min, Math.round(n * 100) / 100)) : 1; };
/** A token (or prototype token) source's art zoom: 1 when none is set. */
export const artZoom = src => { const v = src?.flags?.[ID]?.[ARTZOOM]; return v == null ? 1 : clampZoom(v); };
/**
 * The update that sets a token source's art zoom (keys prefixed, e.g. "prototypeToken."); zoom 1 (or null) deletes the flag.
 * null when it's already so.
 */
export function artZoomUpdate(src, zoom, { prefix = "" } = {}) {
  const z = zoom == null ? 1 : clampZoom(zoom); const cur = artZoom(src); const has = src?.flags?.[ID]?.[ARTZOOM] != null;
  if (z === cur && (z !== 1 || !has)) return null;
  return { [`${prefix}flags.${ID}.${ARTZOOM}`]: z === 1 ? null : z };
}
/** A focus coordinate kept to 0 – 1, 3 decimals; 0.5 (the centre) for anything unusable. */
export const clampFocus = v => { const n = Number(v); return Number.isFinite(n) ? Math.min(1, Math.max(0, Math.round(n * 1000) / 1000)) : 0.5; };
/** A token (or prototype token) source's art focus: { x, y }, the centre when none is set. */
export const artFocus = src => { const f = src?.flags?.[ID]?.[ARTFOCUS]; return { x: clampFocus(f?.x ?? 0.5), y: clampFocus(f?.y ?? 0.5) }; };
/** The update that sets a token source's art focus; the centre (or null) deletes the flag. null when it's already so. */
export function artFocusUpdate(src, focus, { prefix = "" } = {}) {
  const f = focus ? { x: clampFocus(focus.x), y: clampFocus(focus.y) } : { x: 0.5, y: 0.5 }; const cur = artFocus(src); const has = src?.flags?.[ID]?.[ARTFOCUS] != null;
  const centre = f.x === 0.5 && f.y === 0.5;
  if (f.x === cur.x && f.y === cur.y && (!centre || !has)) return null;
  return { [`${prefix}flags.${ID}.${ARTFOCUS}`]: centre ? null : f };
}
/**
 * Packs the focus into the colour band pair the vertex shader already receives (there is no spare vertex attribute: core's ring
 * shader uses all 16 WebGL guarantees). Each component becomes band + 2 × round(focus × FOCUS_STEPS); the shader takes
 * floor(v / 2) / FOCUS_STEPS back out and v mod 2 as the band. Band values are 0 – 1 (a radius), so nothing collides.
 */
export const packFocus = (band, focus) => band + 2 * Math.round(clampFocus(focus) * FOCUS_STEPS);
export function unpackFocus(v) { const k = Math.floor(v / 2); return { band: v - 2 * k, focus: k / FOCUS_STEPS }; }

/** Lines of core's ring vertex shader (v14) that the focus patch changes, and the patch. */
export const VERTEX_LINES = {
  band: "vRingColorBand = aRingColorBand;",
  coord: "textureCoord = (aTextureCoord - 0.5) * aTextureScaleCorrection + 0.5;"
};
/**
 * Core's ring vertex shader with the art focus: the colour band attribute carries band + 2 × focus steps (packFocus); the art is
 * sampled around the focus instead of the image's centre. null when the source isn't the one this was written for.
 */
export function patchVertexShader(src) {
  if (typeof src !== "string") return null;
  for (const line of Object.values(VERTEX_LINES)) if (src.split(line).length !== 2) return null;
  return src.replace(VERTEX_LINES.band, "vec2 ringmakerSteps = floor(aRingColorBand / 2.0);\n      vRingColorBand = aRingColorBand - ringmakerSteps * 2.0;\n"
    + `      vec2 ringmakerFocus = ringmakerSteps / ${FOCUS_STEPS.toFixed(1)};`)
    .replace(VERTEX_LINES.coord, "textureCoord = (aTextureCoord - 0.5) * aTextureScaleCorrection + ringmakerFocus;");
}
/**
 * Writes the packed focus over the colour band floats core already packed for one element (vertexSize floats per vertex; the band
 * pair sits `bandOffset` floats into each vertex). `vertices` is the number of vertices.
 */
export function packFocusInto(float32, aIndex, vertexSize, bandOffset, vertices, focus) {
  const sx = 2 * Math.round(clampFocus(focus.x) * FOCUS_STEPS), sy = 2 * Math.round(clampFocus(focus.y) * FOCUS_STEPS);
  for (let v = 0, j = aIndex + bandOffset; v < vertices; v++, j += vertexSize) { float32[j] += sx; float32[j + 1] += sy; } // the band core wrote stays
}

/**
 * Core's texture scale adjustment with the art zoom applied: the shader samples the art at (uv - 0.5) × adjustment + 0.5, so a
 * larger adjustment shows more of the image (the art looks smaller). Zoom 2 makes the art twice as big.
 */
export const zoomAdjustment = (adjustment, zoom) => num(adjustment, 1) / clampZoom(zoom);

/**
 * How far out the opaque part of a square RGBA image reaches (ImageData-style flat array), as a fraction of the half-size:
 * the largest centre distance of any pixel at least `threshold` opaque. 0 for a fully transparent image.
 */
export function opaqueRadius(data, size, threshold = 32) {
  const half = size / 2; let R = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (data[(y * size + x) * 4 + 3] < threshold) continue;
    const r = Math.hypot(x + 0.5 - half, y + 0.5 - half); if (r > R) R = r;
  }
  return Math.min(1.5, R / half);
}

/**
 * The art zoom that fits an image whose opaque part reaches `radius` (fraction of its half-size, as opaqueRadius) into the ring's
 * opening: its edge lands under the middle of the ring band (the background disc's edge, ringLayout's bkgR), relative to the
 * subject area core gives the art (CORE.subject of the frame). 1 when the image's reach is unknown.
 */
export function fitZoom(radius, layout, { scaleCorrection = 1, adjustment = 1, shrinkOnly = true } = {}) {
  if (!(radius > 0) || !(layout?.bkgR > 0)) return 1;
  // The shader puts an image point at image radius r (fraction of the half-size) at ring distance r × scaleCorrection / tsa,
  // where tsa = adjustment / zoom; the ring band's outer edge is at distance CORE_OUTER. Solve for the edge landing on bkgR.
  const z = layout.bkgR * num(adjustment, 1) / (radius * (num(scaleCorrection, 1) || 1));
  return clampZoom(shrinkOnly ? Math.min(1, z) : z);
}

/**
 * The token data a token configuration window is editing: a placed token, a prototype token, or (if a window hands over the actor)
 * the actor's prototype token. Returns the source object, falling back to the live document, or null when none is found.
 */
export function configSource(app) {
  const cands = [app?.token, app?.document, app?.options?.document, app?.object, app?.prototype, app?.actor];
  for (let d of cands) {
    if (!d) continue;
    if (d.documentName === "Actor" || (d.prototypeToken && !d.ring && !("actorId" in d))) d = d.prototypeToken;
    const src = d?._source ?? d;
    if (src && typeof src === "object" && (src.flags !== undefined || src.ring !== undefined)) return src;
  }
  return null;
}

/** The ring effect bit for a targetEffect choice (pulse or gradient), from core's effects enum; 0 for off, flash or unknown. */
export function targetBit(choice, effects = CORE_EFFECTS) {
  const e = effects ?? CORE_EFFECTS;
  if (choice === "pulse") return Number(e.RING_PULSE ?? CORE_EFFECTS.RING_PULSE) >>> 0;
  if (choice === "gradient") return Number(e.RING_GRADIENT ?? CORE_EFFECTS.RING_GRADIENT) >>> 0;
  return 0;
}

/** A ring's effects with Ringmaker's additions: the pop-out bit set or cleared, and the target effect bit when targeted. */
export function ringEffects(effects, { popOut = false, target = 0 } = {}) {
  let e = popOutEffects(effects, popOut);
  if (target) e = (e | target) >>> 0;
  return e;
}

/**
 * Whether a token update touches the pop-out flag (set, cleared, or the whole flags.ringmaker removed). Cheap: it looks only at the
 * changed flags, because updateToken fires on every token update. `keys` lets the same check look for other Ringmaker flags.
 */
export function touchesPopOut(changed, keys = [POPOUT]) {
  const f = changed?.flags; if (!f || typeof f !== "object") return false;
  if (`-=${ID}` in f) return true;
  if (!(ID in f)) return false;
  const v = f[ID];
  if (!v || typeof v !== "object" || Object.getPrototypeOf(v) !== Object.prototype || !Object.keys(v).length) return true; // namespace deleted
  return keys.some(k => k in v || `-=${k}` in v);
}
/** Whether a token update touches the art zoom flag (or clears Ringmaker's flags). */
export const touchesArtZoom = changed => touchesPopOut(changed, [ARTZOOM, ARTFOCUS]);

/**
 * Tidies the art zoom in a token (or prototype token) update as the form sends it: the number is clamped and a zoom of 1 (no
 * zoom) is dropped from the update and, when the source has one, deleted. Changes `changed` in place; returns whether it did.
 */
export function tidyArtZoom(changed, src, del = globalThis._del) {
  const f = changed?.flags?.[ID]; if (!f || typeof f !== "object") return false;
  let did = false;
  const drop = key => { delete f[key]; if (src?.flags?.[ID]?.[key] != null) { if (del) f[key] = del; else f[`-=${key}`] = null; } };
  if (ARTZOOM in f && f[ARTZOOM] != null && f[ARTZOOM] !== del) {
    const z = clampZoom(f[ARTZOOM]); if (z !== 1) f[ARTZOOM] = z; else drop(ARTZOOM); did = true;
  }
  if (ARTFOCUS in f && f[ARTFOCUS] != null && f[ARTFOCUS] !== del) {
    const cur = artFocus(src); const raw = f[ARTFOCUS];
    const x = clampFocus(raw?.x ?? cur.x), y = clampFocus(raw?.y ?? cur.y);
    if (x === 0.5 && y === 0.5) drop(ARTFOCUS); else f[ARTFOCUS] = { x, y }; did = true;
  }
  return did;
}

/**
 * Remove's update for one token (or prototype token) source: the recorded ring values come back (as ringRevert) and every
 * Ringmaker flag (prior, popOut, anything else under flags.ringmaker) is deleted. null when there is nothing of Ringmaker's.
 */
export function cleanUpdate(src, { prefix = "" } = {}) {
  const f = src?.flags?.[ID];
  const has = !!f && typeof f === "object" && Object.keys(f).length > 0;
  if (!has) return null;
  const out = ringRevert(src, { prefix }) ?? {};
  delete out[`${prefix}flags.${ID}.${FLAG}`];
  out[`${prefix}flags.${ID}`] = null;
  return out;
}

/**
 * Sizes for the menu's live preview (CSS pixels, a px × px square standing for one ring frame): the ring image's drawn size,
 * the background disc's diameter, the sample art's size and the drawing order. Same layout maths as the ring texture.
 */
export function previewLayout({ band = null, size = 100, scale = 1, front = true, px = 200 } = {}) {
  const L = ringLayout(band, size);
  const r = v => Math.round(v * 10) / 10;
  return { px, ring: r(px * L.scale), bkg: r(px * L.bkgR), art: r(px * CORE.subject * clampScale(scale)), front: !!front, ringOnTop: !!front, clipArt: !!front };
}

/** Ring effects with the pop-out state bit set or cleared. */
export function popOutEffects(effects, on) {
  const e = Number(effects) >>> 0;
  return on ? (e | POPOUT_STATE) : (e & ~POPOUT_STATE) >>> 0;
}

/** The update that turns pop-out on or off for a token source (keys prefixed, e.g. "prototypeToken."). null when it's already so. */
export function popOutUpdate(src, on, { prefix = "" } = {}) {
  return isPopOut(src) === !!on ? null : { [`${prefix}flags.${ID}.${POPOUT}`]: !!on };
}

/** Where to draw an image of w × h in the square frame: centred, scaled to fit. */
export function fitRect(w, h, size = FRAME) {
  if (!(w > 0 && h > 0)) return { x: 0, y: 0, w: size, h: size };
  const k = Math.min(size / w, size / h); const dw = w * k, dh = h * k;
  return { x: (size - dw) / 2, y: (size - dh) / 2, w: dw, h: dh };
}

/** Splits a list into batches. */
export const chunks = (arr, n = BATCH) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

/**
 * Turns a null for Ringmaker's flags (flags.ringmaker, or flags.ringmaker.prior) into the deletion Foundry wants: v14's deletion
 * operator, or the older "-=" key on the last part.
 */
export function foundryDeletes(list, del = globalThis._del) {
  const tails = [`flags.${ID}.${FLAG}`, `flags.${ID}.${ARTZOOM}`, `flags.${ID}.${ARTFOCUS}`, `flags.${ID}`];
  for (const u of list) for (const k of Object.keys(u)) {
    if (u[k] !== null || !tails.some(t => k === t || k.endsWith(`.${t}`))) continue;
    delete u[k];
    if (del) u[k] = del; else { const i = k.lastIndexOf("."); u[`${k.slice(0, i)}.-=${k.slice(i + 1)}`] = null; }
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
const targetEffect = () => { const v = S("targetEffect"); return v in TARGET_EFFECTS ? v : "off"; };
const zoomOn = () => S("artZoom") !== false;
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
  s("artZoom", "Per-token art zoom", "Lets each token's art be zoomed in or out inside the ring (Token configuration › Dynamic Token Ring › Art zoom, and the Fit art button). The zoom is kept in flags.ringmaker.artZoom; with this off every token uses Foundry's framing and the stored zooms are ignored. Reloads Foundry.", Boolean, true, { requiresReload: true });
  s("targetEffect", "Ring effect on targeted tokens", "While a token with the ring is targeted, use one of Foundry's own ring effects on it: Pulse or Gradient while it stays targeted, or a single Flash in the targeting player's colour. Drawn on each client only; nothing is saved. Off by default. Reloads Foundry.", String, "off", { choices: TARGET_EFFECTS, requiresReload: true });
  s("existingOnLoad", "Ring existing tokens on load", "Each time the world loads, the active GM puts the ring on any token (and actor prototype token) that should have it and doesn't yet.", Boolean, false);
}

/** init: with an image chosen, registers the ring configuration, the texture the spritesheet uses, and the hooks. */
export function init() {
  if (!image() || hooked) return; // nothing to show: Foundry's own ring is left as it is
  hooked = true;
  Hooks.on("initializeDynamicTokenRingConfig", cfg => {
    const D = foundry.canvas?.placeables?.tokens?.DynamicRingData;
    if (!D) return console.warn(`${ID} | dynamic token rings not available`);
    const te = targetEffect(); const target = targetBit(te, foundry.canvas.placeables.tokens.TokenRing?.effects);
    const shaderClass = ringShader(); const ringClass = popOutRingClass(undefined, { target, zoom: zoomOn() });
    const framework = { ...(shaderClass ? { shaderClass } : {}), ...(ringClass ? { ringClass } : {}) };
    cfg.addConfig(RING_ID, new D({ id: RING_ID, label: "Ringmaker", spritesheet: SHEET, ...(Object.keys(framework).length ? { framework } : {}) }));
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
  // Pop-out turned on or off: the ring's state bits are worked out again (configureVisuals).
  Hooks.on("updateToken", (doc, changed) => {
    if (touchesArtZoom(changed)) return doc.object?.renderFlags.set({ refreshSize: true }); // ring configureSize applies the zoom
    if (!touchesPopOut(changed)) return; // not the pop-out flag: nothing to do (this hook fires on every token update)
    refreshRing(doc.object);
  });
  // Ring effect on targeted tokens: client-side only, no document writes. Not registered at all while the setting is off.
  const te = targetEffect();
  if (te !== "off") Hooks.on("targetToken", (user, token, targeted) => {
    if (!token?.hasDynamicRing || CONFIG.Token.ring.id !== RING_ID) return; // no ring, or not Ringmaker's ring style
    if (te !== "flash") return refreshRing(token); // the ring class adds the effect bit while the token is targeted
    if (!targeted || typeof token.ring?.flashColor !== "function") return;
    try { token.ring.flashColor(foundry.utils.Color.from(user?.color ?? "#ffffff"))?.catch?.(() => { }); } catch { }
  });
  // The token config's Art zoom field: a 1 typed into it clears the flag instead of storing 1.
  Hooks.on("preUpdateToken", (doc, changed) => { tidyArtZoom(changed, doc._source); });
  Hooks.on("preUpdateActor", (doc, changed) => { if (changed?.prototypeToken) tidyArtZoom(changed.prototypeToken, doc._source?.prototypeToken); });
  Hooks.on("preCreateToken", (doc, data, options, userId) => {
    if (userId !== game.user.id || !S("newTokens")) return;
    if (!wants(actorOf(doc), mode())) return;
    const u = ringUpdate(doc._source, { scale: scale() }); if (u) doc.updateSource(foundry.utils.expandObject(u));
  });
}

/** The ring's state bits are worked out again (configureVisuals) and its visuals redrawn. */
function refreshRing(t) {
  if (!t?.hasDynamicRing || !t.ring) return;
  t.ring.configureVisuals(); t.renderFlags.set({ refreshRingVisuals: true });
}

const coreShader = () => foundry.canvas.rendering?.shaders?.TokenRingSamplerShader ?? null;
/** A subclass of core's ring shader with Ringmaker's changes, or null (core's shader is used) when its source isn't as expected. */
function ringShader() {
  const Core = coreShader(); const frag = Core && patchShader(Core._batchFragmentShader, { front: front() });
  if (!frag) { console.warn(`${ID} | core ring shader not as expected; using Foundry's own (art over the ring)`); return null; }
  shaderPatched = true;
  const vert = zoomOn() ? patchVertexShader(Core._batchVertexShader) : null;
  if (zoomOn() && !vert) console.warn(`${ID} | core ring vertex shader not as expected; art focus is off (zoom still works)`);
  // Where core packs the colour band in each vertex: after the primary attributes (7 floats) and the ring's own 11 before it.
  const bandOffset = (foundry.canvas.rendering.shaders.PrimaryBaseSamplerShader?.batchVertexSize ?? 7) + 11;
  const corePack = Core._packInterleavedGeometry;
  return class RingmakerRingShader extends Core {
    static classPluginName = PLUGIN;
    static _batchFragmentShader = frag;
    static _batchVertexShader = vert ?? Core._batchVertexShader;
    static _packInterleavedGeometry(element, attributeBuffer, indexBuffer, aIndex, iIndex) {
      corePack.call(this, element, attributeBuffer, indexBuffer, aIndex, iIndex);
      if (!vert) return;
      // Always packed: with the patched shader a bare band would read back as focus 0, not the centre.
      const ring = element.object?.object?.ring; const focus = ring?.artFocus ?? CENTRE;
      packFocusInto(attributeBuffer.float32View, aIndex, this.vertexSize, bandOffset, element.vertexData.length / 2, focus);
    }
  };
}

/**
 * Core's static methods that use static private fields (e.g. TokenRing.createAssetsUVs writes `this.#ringData`) throw when
 * called on a subclass, because `this` is then the subclass, which doesn't have the field. Core calls them as
 * `CONFIG.Token.ring.ringClass.createAssetsUVs()`, so on the subclass they're replaced by forwards that run them on the base
 * class. Static data they set (baseTexture, texturesData) lives on the base class and is inherited by the subclass.
 * Returns the names forwarded.
 */
export function forwardPrivateStatics(Sub, Base) {
  const names = [];
  for (const n of Object.getOwnPropertyNames(Base)) {
    const d = Object.getOwnPropertyDescriptor(Base, n);
    if (typeof d?.value !== "function" || Object.hasOwn(Sub, n)) continue;
    let src = ""; try { src = Function.prototype.toString.call(d.value); } catch { }
    if (!/\bthis\s*\.\s*#/.test(src)) continue;
    const f = d.value;
    Object.defineProperty(Sub, n, { value: function (...args) { return f.apply(Base, args); }, writable: true, configurable: true });
    names.push(n);
  }
  return names;
}

/**
 * Core's TokenRing with the pop-out state bit added for tokens that have it on, and (target > 0) the target effect bit while the
 * token is targeted by anyone. null when core's class isn't there.
 */
export function popOutRingClass(Core = globalThis.foundry?.canvas?.placeables?.tokens?.TokenRing, { target = 0, zoom = false } = {}) {
  if (!Core) return null;
  const Sub = class RingmakerTokenRing extends Core {
    configureVisuals() {
      super.configureVisuals(); // runs when a ring is set up or its visuals change, not per frame
      const t = this.token;
      const e = ringEffects(this.effects, { popOut: isPopOut(t?.document), target: target && t?.targeted?.size ? target : 0 });
      if (e !== this.effects) this.effects = e;
    }
    /** Art zoom (flags.ringmaker.artZoom): the art is sampled zoomed in or out; runs on size refreshes only, not per frame. */
    configureSize(options) {
      if (zoom) this.textureScaleAdjustment = 1; // core sets it only in grid-fit mode; otherwise the last value would compound
      super.configureSize(options);
      if (!zoom) return;
      const z = artZoom(this.token?.document);
      if (z !== 1) this.textureScaleAdjustment = zoomAdjustment(this.textureScaleAdjustment, z);
      this.artFocus = artFocus(this.token?.document); // read by the shader's geometry packing
    }
  };
  try { forwardPrivateStatics(Sub, Core); } catch (e) {
    console.warn(`${ID} | couldn't adapt the token ring class; pop-out is off`, e); return null;
  }
  return Sub;
}

/** The checkbox for pop-out, added to the Dynamic Token Ring section of the token configuration (prototype tokens too). */
export function addPopOutField(app, element) {
  if (!game.user.isGM) return;
  const root = element instanceof HTMLElement ? element : element?.[0]; if (!root) return;
  const enabled = root.querySelector('[name="ring.enabled"]'); const group = enabled?.closest(".form-group");
  if (!group || root.querySelector(`[name="flags.${ID}.${POPOUT}"]`)) return;
  const src = configSource(app); const on = isPopOut(src);
  const id = `${app.id}-${ID}-${POPOUT}`;
  const div = document.createElement("div"); div.className = "form-group";
  div.innerHTML = `<label for="${id}">Let art break out of the ring</label><div class="form-fields"><input type="checkbox" id="${id}" name="flags.${ID}.${POPOUT}" ${on ? "checked" : ""}></div>`
    + `<p class="hint">Ringmaker: token art outside the ring's opening is drawn over the ring instead of trimmed, so cut-out art can reach past the ring. Art inside the opening stays under the ring. Keep the art's own disc inside the opening (about two thirds of the image's width).</p>`;
  group.after(div);
  if (zoomOn()) addArtZoomField(app, root, div, src);
}

/**
 * The art framing fields under the pop-out box: Art zoom, Focus X and Focus Y (the form's own fields, saved with the token), a
 * Fit art button that measures the image and fills the zoom, and a live preview on core's preview token.
 */
function addArtZoomField(app, root, after, src) {
  const cur = artZoom(src); const f = artFocus(src); const base = `${app.id}-${ID}`;
  const num = (key, label, value, min, max, step) => `<label for="${base}-${key}" style="flex:none">${label}</label><input type="number" id="${base}-${key}" name="flags.${ID}.${key}" value="${value}" min="${min}" max="${max}" step="${step}" style="max-width:5.5em">`;
  const div = document.createElement("div"); div.className = "form-group";
  div.innerHTML = `<label>Art framing</label><div class="form-fields" style="gap:0.4rem; align-items:center">`
    + num(ARTZOOM, "Zoom", cur, ZOOM_RANGE.min, ZOOM_RANGE.max, 0.01)
    + num(`${ARTFOCUS}.x`, "Focus X", f.x, 0, 1, 0.01) + num(`${ARTFOCUS}.y`, "Y", f.y, 0, 1, 0.01)
    + `<button type="button" data-ringmaker="fit" title="Measure the image's opaque part and set the zoom so it fills the ring's opening"><i class="fa-solid fa-compress"></i> Fit</button></div>`
    + `<p class="hint">Ringmaker: how the art sits inside the ring. Zoom 1 is Foundry's framing (below 1 shows more of the image, above 1 zooms in). Focus is the point of the image (0–1 from the top left) drawn at the ring's centre: put it on the face. Fit sets the zoom so cut-out art just fills the opening. Stored as flags.ringmaker.${ARTZOOM} and .${ARTFOCUS}; zoom 1 and focus 0.5/0.5 clear them.</p>`;
  after.after(div);
  const zoomInput = div.querySelector(`[name="flags.${ID}.${ARTZOOM}"]`);
  // Live preview: the inputs are form fields, so core's TokenConfig copies their values onto its preview token (app._preview,
  // drawn on the canvas in place of the real one) on each change; the ring class reads the flags from that document on a size refresh.
  const previewToken = () => { const p = app._preview; return p?.documentName === "Token" ? p.object : null; };
  const refresh = () => { const o = previewToken(); if (o?.hasDynamicRing) o.renderFlags.set({ refreshSize: true }); };
  for (const el of div.querySelectorAll("input")) el.addEventListener("change", () => setTimeout(refresh, 0)); // after core's own change handler
  div.querySelector("[data-ringmaker=fit]").addEventListener("click", async () => {
    try {
      const z = await fitArtZoom(src?.texture?.src, previewToken() ?? (app.document?.documentName === "Token" ? app.document.object : null));
      if (z == null) return ui.notifications.warn("Ringmaker: couldn't measure the image.");
      zoomInput.value = z; zoomInput.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (e) { console.warn(`${ID} | fit art`, e); ui.notifications.warn("Ringmaker: couldn't measure the image."); }
  });
}

/** Measures an image's opaque reach and returns the art zoom that fits it into the ring's opening; null when it can't be read. */
export async function fitArtZoom(src, token = null) {
  if (!src) return null;
  const img = new Image(); img.decoding = "async"; if (/^https?:/i.test(src)) img.crossOrigin = "anonymous"; img.src = src;
  await img.decode();
  const N = 128; const c = document.createElement("canvas"); c.width = c.height = N; const g = c.getContext("2d", { willReadFrequently: true });
  const r = fitRect(img.naturalWidth, img.naturalHeight, N); g.drawImage(img, r.x, r.y, r.w, r.h);
  const radius = opaqueRadius(g.getImageData(0, 0, N, N).data, N);
  const L = ringLayout(band, size());
  // The ring's own numbers at zoom 1 when a placed token is at hand; otherwise Foundry's defaults (square art, scale 1).
  let scaleCorrection = 1, adjustment = 1;
  if (token?.ring) { const z = artZoom(token.document); scaleCorrection = token.ring.scaleCorrection; adjustment = num(token.ring.textureScaleAdjustment, 1) * clampZoom(z); }
  return fitZoom(radius, L, { scaleCorrection, adjustment, shrinkOnly: false });
}

/** The token documents and prototype tokens in a list of placeables, documents, prototype tokens, actors or ids on the viewed scene. */
function resolveTokens(tokens) {
  return (Array.isArray(tokens) ? tokens : [tokens]).map(t => {
    if (typeof t === "string") return canvas.scene?.tokens.get(t);
    const d = t?.document ?? t;
    return d?.documentName === "Actor" ? d.prototypeToken : d;
  }).filter(Boolean);
}

/** Runs a per-source update over tokens and prototype tokens; `make(src, prefix)` gives the update or null. */
async function updateTokens(tokens, make) {
  const byScene = new Map(); const actors = [];
  for (const d of resolveTokens(tokens)) {
    if (d.documentName === "Token") {
      const u = make(d._source, ""); if (!u) continue;
      const s = d.parent; if (!byScene.has(s)) byScene.set(s, []); byScene.get(s).push({ _id: d.id, ...u });
    } else if (d.actor && d.constructor?.name === "PrototypeToken") {
      const u = make(d.actor._source.prototypeToken, "prototypeToken."); if (u) actors.push({ _id: d.actor.id, ...u });
    }
  }
  foundryDeletes(actors); for (const [, ups] of byScene) foundryDeletes(ups);
  for (const c of chunks(actors)) await Actor.updateDocuments(c);
  let n = 0; for (const [s, ups] of byScene) for (const c of chunks(ups)) { await s.updateEmbeddedDocuments("Token", c); n += c.length; }
  return { actors: actors.length, tokens: n };
}

/** GM: turns pop-out on or off for tokens (placeables, token documents, prototype tokens, actors, or ids on the viewed scene). */
export async function setPopOut(tokens, on = true) {
  if (!game.user.isGM) { ui.notifications.warn("Ringmaker: only a GM can change tokens."); return null; }
  return updateTokens(tokens, (src, prefix) => popOutUpdate(src, on, { prefix }));
}

/**
 * GM: sets the art framing for tokens (same inputs as setPopOut): { zoom, focus: { x, y } }. Zoom 1 and the centre focus clear
 * their flags; a part left out is unchanged.
 */
export async function setArtFraming(tokens, { zoom, focus } = {}) {
  if (!game.user.isGM) { ui.notifications.warn("Ringmaker: only a GM can change tokens."); return null; }
  return updateTokens(tokens, (src, prefix) => {
    const u = { ...(zoom !== undefined ? artZoomUpdate(src, zoom, { prefix }) : null), ...(focus !== undefined ? artFocusUpdate(src, focus, { prefix }) : null) };
    return Object.keys(u).length ? u : null;
  });
}
/** GM: sets the art zoom for tokens (same inputs as setPopOut); 1 or null clears it. */
export const setArtZoom = (tokens, zoom = 1) => setArtFraming(tokens, { zoom });

/**
 * GM: measures each token's image and sets the art zoom that fits its opaque part into the ring's opening (same inputs as
 * setPopOut). Images that can't be read are skipped.
 */
export async function fitArt(tokens) {
  if (!game.user.isGM) { ui.notifications.warn("Ringmaker: only a GM can change tokens."); return null; }
  const zooms = new Map();
  for (const d of resolveTokens(tokens)) {
    const src = d.documentName === "Token" ? d._source : d.actor?._source?.prototypeToken; const img = src?.texture?.src;
    if (!img || zooms.has(img)) continue;
    try { zooms.set(img, await fitArtZoom(img, d.documentName === "Token" ? d.object : null)); } catch (e) { console.warn(`${ID} | fit art: ${img}`, e); }
  }
  return updateTokens(tokens, (src, prefix) => { const z = zooms.get(src?.texture?.src); return z == null ? null : artZoomUpdate(src, z, { prefix }); });
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
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, FRAME, FRAME); ctx.clip(); // a large ring must not spill into the background frame
  ctx.drawImage(sq, (FRAME - d) / 2, (FRAME - d) / 2, d, d); // ring frame
  ctx.restore();
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
    const u = revert ? cleanUpdate(a._source.prototypeToken, { prefix: "prototypeToken." }) : ringUpdate(a._source.prototypeToken, { scale: sc, prefix: "prototypeToken." });
    if (u) actors.push({ _id: a.id, ...u });
  }
  for (const s of game.scenes) {
    const ups = [];
    for (const t of s.tokens) {
      if (!revert && !wants(actorOf(t), m)) continue;
      const u = revert ? cleanUpdate(t._source) : ringUpdate(t._source, { scale: sc });
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

/**
 * Active GM: undoes what Ringmaker changed (ring on/off and its scale) and deletes every Ringmaker flag (prior, popOut), on
 * prototype tokens and placed tokens alike.
 */
export async function remove({ confirm = false } = {}) {
  if (!gmCheck()) return null;
  const p = plan({ revert: true });
  if (confirm) {
    const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: "Remove Ringmaker's ring" }, rejectClose: false,
      content: `<p>Put ${plural(p.actors.length, "actor prototype token")} and ${plural(p.tokens, "placed token")} back the way they were and delete Ringmaker's data on them?</p>` });
    if (!ok) return null;
  }
  return run(p, "taken off", false);
}

/** What Remove would change, as counts, without changing anything. */
export function removePlan() {
  const p = plan({ revert: true }); return { actors: p.actors.length, tokens: p.tokens };
}

/** Saves the ring look settings from the menu (only the ones that changed). Returns whether anything changed. GM only. */
export async function saveLook({ ringSize, background, ringInFront } = {}) {
  if (!game.user.isGM) return false;
  const next = { ringSize: clampSize(ringSize), background: cssColor(background), ringInFront: !!ringInFront };
  const cur = { ringSize: size(), background: bg(), ringInFront: front() };
  let changed = false;
  for (const k of Object.keys(next)) if (next[k] !== cur[k]) { await game.settings.set(ID, k, next[k]); changed = true; }
  return changed;
}

/** What's set and whether the ring is in use. */
export function status() {
  const st = { image: image(), mode: mode(), scale: scale(), size: size(), background: bg(), front: front(), targetEffect: targetEffect(), artZoom: zoomOn(), shader: shaderPatched, band, registered: false, active: null, error: loadError };
  try { st.registered = CONFIG.Token.ring.configIDs.includes(RING_ID); st.active = CONFIG.Token.ring.id === RING_ID; } catch { }
  return st;
}
