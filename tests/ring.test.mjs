import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const R = await import("../scripts/ring.mjs");
const G = await import("../scripts/gm.mjs");
const ID = "ringmaker";
const tok = (enabled = false, scale = 1, rec) => ({ ring: { enabled, subject: { scale } }, flags: rec ? { [ID]: { prior: rec } } : {} });
const json = async p => JSON.parse(await readFile(new URL(`../${p}`, import.meta.url)));

test("NPC means: not a character and no player owner, in any system", () => {
  assert.equal(R.isNpc({ type: "npc", hasPlayerOwner: false }), true);
  assert.equal(R.isNpc({ type: "creature", hasPlayerOwner: false }), true, "other systems' monster types count");
  assert.equal(R.isNpc({ type: "character", hasPlayerOwner: false }), false);
  assert.equal(R.isNpc({ type: "npc", hasPlayerOwner: true }), false, "a player's companion isn't an NPC");
  assert.equal(R.isNpc(null), false);
});

test("which tokens get the ring", () => {
  assert.equal(R.wants({ type: "npc" }, "npc"), true);
  assert.equal(R.wants({ type: "character" }, "npc"), false, "NPCs only leaves characters alone");
  assert.equal(R.wants({ type: "character", hasPlayerOwner: true }, "all"), true);
  assert.equal(R.wants({ type: "group" }, "all"), true);
  assert.equal(R.wants(null, "all"), false, "no actor, no ring");
});

test("ringUpdate: turns the ring on, sets the scale only when it's untouched, records what was there", () => {
  const u = R.ringUpdate(tok(), { scale: 0.85 });
  assert.deepEqual(u, { "ring.enabled": true, "ring.subject.scale": 0.85, [`flags.${ID}.prior`]: { enabled: false, scale: 1, applied: 0.85 } });
  assert.deepEqual(R.ringUpdate(tok()), { "ring.enabled": true, [`flags.${ID}.prior`]: { enabled: false, scale: 1, applied: 1 } }, "default art size is Foundry's 1: only the ring is turned on");
  const up = R.ringUpdate(tok(true, 0.85, { enabled: false, scale: 1, applied: 0.85 }), { scale: 1 });
  assert.deepEqual(up, { "ring.subject.scale": 1, [`flags.${ID}.prior`]: { enabled: false, scale: 1, applied: 1 } }, "tokens ringed by 1.0.0 at 0.85 move to the new default");
  const own = R.ringUpdate(tok(false, 1.2), { scale: 0.85 });
  assert.equal(own["ring.subject.scale"], undefined, "a scale you set yourself is kept");
  assert.deepEqual(own[`flags.${ID}.prior`], { enabled: false, scale: 1.2, applied: null });
  assert.equal(R.ringUpdate(tok(true, 0.85, { enabled: false, scale: 1, applied: 0.85 }), { scale: 0.85 }), null, "already done");
  const again = R.ringUpdate(tok(true, 0.85, { enabled: false, scale: 1, applied: 0.85 }), { scale: 0.9 });
  assert.equal(again["ring.subject.scale"], 0.9, "Ringmaker's own scale follows the setting");
  assert.deepEqual(again[`flags.${ID}.prior`], { enabled: false, scale: 1, applied: 0.9 }, "the original values stay recorded");
  const p = R.ringUpdate(tok(), { scale: 0.85, prefix: "prototypeToken." });
  assert.ok("prototypeToken.ring.enabled" in p && `prototypeToken.flags.${ID}.prior` in p);
  for (const k of Object.keys(u)) assert.doesNotMatch(k, /texture|img/, "never touches art");
});

test("ringRevert puts back what Ringmaker changed", () => {
  assert.equal(R.ringRevert(tok(true)), null, "not ours: left alone");
  assert.deepEqual(R.ringRevert(tok(true, 0.85, { enabled: false, scale: 1, applied: 0.85 })), { "ring.enabled": false, [`flags.${ID}.prior`]: null, "ring.subject.scale": 1 });
  const moved = R.ringRevert(tok(true, 1.1, { enabled: false, scale: 1, applied: 0.85 }));
  assert.equal(moved["ring.subject.scale"], undefined, "a scale changed since is kept");
  assert.equal(R.ringRevert(tok(true, 1, { enabled: true, scale: 1, applied: null }))["ring.enabled"], true, "a ring that was on stays on");
});

test("flag deletion: v14 operator when present, '-=' key otherwise", () => {
  const DEL = Symbol("del");
  const a = R.foundryDeletes([{ _id: "a", "ring.enabled": false, [`flags.${ID}.prior`]: null }], DEL);
  assert.equal(a[0][`flags.${ID}.prior`], DEL);
  const b = R.foundryDeletes([{ _id: "b", [`prototypeToken.flags.${ID}.prior`]: null }], undefined);
  assert.deepEqual(b[0], { _id: "b", [`prototypeToken.flags.${ID}.-=prior`]: null });
});

test("scale clamp, image fit and batching", () => {
  assert.equal(R.clampScale(0.1), 0.5); assert.equal(R.clampScale(3), 1.5); assert.equal(R.clampScale("x"), 1); assert.equal(R.clampScale(0.876), 0.88);
  assert.deepEqual(R.fitRect(256, 256), { x: 0, y: 0, w: 512, h: 512 });
  assert.deepEqual(R.fitRect(512, 256), { x: 0, y: 128, w: 512, h: 256 });
  assert.deepEqual(R.fitRect(0, 0), { x: 0, y: 0, w: 512, h: 512 });
  assert.deepEqual(R.chunks([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.equal(R.chunks(Array.from({ length: 250 })).length, 3);
});

test("active GM: Foundry's pick, else the lowest id among active GMs", () => {
  const gm = (id, active = true) => ({ id, isGM: true, active });
  assert.equal(G.pickActiveGM([gm("b"), gm("a")]).id, "a");
  assert.equal(G.pickActiveGM([gm("a"), gm("b")], gm("b")).id, "b");
  assert.equal(G.pickActiveGM([gm("a", false), { id: "p", isGM: false, active: true }]), null);
});

test("spritesheet JSON: a ring frame and its -bkg frame side by side, matching the drawn texture, no colour band", async () => {
  const j = await json("assets/token-ring.json");
  assert.deepEqual(Object.keys(j.frames), [R.FRAMES.ring, R.FRAMES.bkg]);
  assert.equal(R.FRAMES.bkg, `${R.FRAMES.ring}-bkg`, "core finds the background as <ring name>-bkg");
  assert.deepEqual(j.frames[R.FRAMES.ring].frame, { x: 0, y: 0, w: R.FRAME, h: R.FRAME });
  assert.deepEqual(j.frames[R.FRAMES.bkg].frame, { x: R.FRAME, y: 0, w: R.FRAME, h: R.FRAME });
  assert.deepEqual(j.meta.size, R.SHEET_SIZE);
  assert.equal(j.frames[R.FRAMES.ring].gridTarget, 1);
  assert.equal(Object.keys(j.frames).some(k => k.endsWith("-msk")), false, "no mask: the image keeps its colours");
  assert.deepEqual(j.config.defaultColorBand, { startRadius: 0, endRadius: 0 }, "the image's own colours are kept");
  assert.equal(R.SHEET, "modules/ringmaker/assets/token-ring.json");
});

test("module.json", async () => {
  const m = await json("module.json");
  assert.equal(m.id, ID); assert.equal(m.title, "Ringmaker");
  assert.deepEqual(m.compatibility, { minimum: "13", verified: "14" });
  assert.equal(m.relationships?.systems, undefined, "no system restriction");
  assert.equal(m.download, `https://github.com/cocoomg11/ringmaker/releases/download/v${m.version}/module.zip`);
  assert.equal(m.manifest, "https://github.com/cocoomg11/ringmaker/releases/latest/download/module.json");
  for (const f of m.esmodules) await readFile(new URL(`../${f}`, import.meta.url));
  const log = await readFile(new URL("../CHANGELOG.md", import.meta.url), "utf8");
  assert.match(log, new RegExp(`## ${m.version.replace(/\./g, "\\.")}`), "CHANGELOG has the current version");
});

// A square RGBA image (flat array) with alpha 255 between radii a and b (pixels), plus a faint shadow just outside.
function ringImage(size, a, b, shadow = 0) {
  const d = new Uint8ClampedArray(size * size * 4); const h = size / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.hypot(x + 0.5 - h, y + 0.5 - h);
    d[(y * size + x) * 4 + 3] = r >= a && r <= b ? 255 : (r > b && r <= b + shadow ? 60 : 0);
  }
  return d;
}

test("core ring geometry constants", () => {
  assert.equal(R.CORE.subject, 0.6666666); assert.equal(R.CORE.thickness, 0.1269848);
  assert.ok(Math.abs(R.CORE_OUTER - 0.7936514) < 1e-9);
});

test("measureRing finds the band and ignores a soft shadow", () => {
  const b = R.measureRing(R.radialProfile(ringImage(256, 108, 122, 6), 256));
  assert.ok(Math.abs(b.inner - 108 / 128) < 0.01, `inner ${b.inner}`);
  assert.ok(Math.abs(b.outer - 122.5 / 128) < 0.01, `outer ${b.outer}`);
  assert.equal(R.measureRing(R.radialProfile(new Uint8ClampedArray(64 * 64 * 4), 64)), null, "empty image");
  assert.equal(R.measureRing(R.radialProfile(ringImage(64, 0, 40), 64)), null, "a solid disc isn't a ring");
});

test("ringLayout puts the ring's outer edge on core's and the background under the band", () => {
  const band = { inner: 108 / 128, outer: 127 / 128 };
  const L = R.ringLayout(band);
  assert.ok(Math.abs(L.outerR - R.CORE_OUTER) < 1e-9);
  assert.ok(Math.abs(band.outer * L.scale - R.CORE_OUTER) < 1e-9, "scaled image edge lands on core's ring edge");
  assert.ok(Math.abs(L.innerR - band.inner * L.scale) < 1e-9);
  assert.ok(L.innerR < L.bkgR && L.bkgR < L.outerR, "background edge hidden under the band");
  const big = R.ringLayout(band, 120);
  assert.ok(Math.abs(big.outerR - R.CORE_OUTER * 1.2) < 1e-9);
  assert.equal(R.ringLayout(band, 500).outerR, R.ringLayout(band, 125).outerR, "size is clamped");
  assert.ok(R.ringLayout(band, 125).outerR < 1, "never past the frame");
  const fallback = R.ringLayout(null);
  assert.ok(fallback.innerR > 0 && fallback.innerR < fallback.outerR, "no band found: still a sensible layout");
});

test("setting helpers: ring size and colour", () => {
  assert.equal(R.clampSize(10), 50); assert.equal(R.clampSize(200), 125); assert.equal(R.clampSize("x"), 100); assert.equal(R.clampSize(99.6), 100);
  assert.equal(R.cssColor("#AABBCC"), "#aabbcc"); assert.equal(R.cssColor("red"), R.DEFAULT_BG); assert.equal(R.cssColor(null), "#2b2420");
});

test("patchShader: ring in front, art trimmed to the background, exact background colour; refuses unknown source", () => {
  const src = `void x() {}\n    ${R.SHADER_LINES.main}\n    ${R.SHADER_LINES.bkg}\n    ${R.SHADER_LINES.blend}\n    }`;
  const f = R.patchShader(src, { front: true });
  assert.match(f, /vec4 ringmakerBackground\(/);
  assert.ok(f.indexOf("ringmakerBackground(") < f.indexOf(R.SHADER_LINES.main), "helper defined before _main");
  assert.ok(!f.includes(R.SHADER_LINES.blend) && f.includes("blend(ringColor * rectangularMask, blend(processedColor * ringmakerMask"), "ring over the art");
  const b = R.patchShader(src, { front: false });
  assert.ok(b.includes(R.SHADER_LINES.blend), "core's order kept when off");
  assert.ok(!b.includes(R.SHADER_LINES.bkg) && b.includes("ringmakerBackground(texture(tokenRingTexture, vBackgroundTextureCoord), dist)"));
  assert.equal(R.patchShader(src.replace(R.SHADER_LINES.blend, "")), null, "changed core shader: not patched");
  assert.equal(R.patchShader(`${src}\n${R.SHADER_LINES.blend}`), null, "line twice: not patched");
  assert.equal(R.patchShader(undefined), null);
});

test("pop-out: flag, state bit and update", () => {
  assert.equal(R.POPOUT_STATE, 0x40); assert.ok(R.POPOUT_STATE > 0x20, "above core's ring effects");
  assert.equal(R.isPopOut({ flags: { [ID]: { popOut: true } } }), true);
  assert.equal(R.isPopOut({ flags: { [ID]: { popOut: "yes" } } }), false, "only true counts");
  assert.equal(R.isPopOut(null), false);
  assert.equal(R.popOutEffects(1, true), 0x41); assert.equal(R.popOutEffects(0x41, false), 1);
  assert.equal(R.popOutEffects(0x2b, true), 0x6b, "core's effects are kept");
  assert.equal(R.popOutEffects(undefined, false), 0);
  assert.deepEqual(R.popOutUpdate(tok(), true), { [`flags.${ID}.popOut`]: true });
  assert.deepEqual(R.popOutUpdate({ flags: { [ID]: { popOut: true } } }, false, { prefix: "prototypeToken." }), { [`prototypeToken.flags.${ID}.popOut`]: false });
  assert.equal(R.popOutUpdate({ flags: { [ID]: { popOut: true } } }, true), null, "already on");
  assert.equal(R.popOutUpdate(tok(), false), null, "already off");
});

test("patchShader: pop-out tokens get the art outside the background disc over the ring; others unchanged", () => {
  const src = `void x() {}\n    ${R.SHADER_LINES.main}\n    ${R.SHADER_LINES.bkg}\n    ${R.SHADER_LINES.blend}\n    }`;
  const f = R.patchShader(src, { front: true });
  const i = f.indexOf("ringmakerMask = "), j = f.indexOf("(vStates & 0x40U) != 0U");
  assert.ok(i > 0 && j > i, "pop-out branch after the ring-in-front blend");
  assert.match(f.slice(j), /blendedResult = blend\(processedColor \* \(1\.0 - ringmakerMask\), blendedResult\);/, 'only art outside the disc goes over the ring');
  assert.equal(R.patchShader(src, { front: false }).includes("0x40U"), false, "ring behind: core's order for every token already");
});

test("configSource: finds the token data for placed tokens, prototype tokens and actor-handed windows", () => {
  const src = { flags: { [ID]: { popOut: true } }, ring: { enabled: true } };
  assert.equal(R.isPopOut(R.configSource({ document: { _source: src, actorId: "a" } })), true, "placed token via document");
  assert.equal(R.isPopOut(R.configSource({ token: { _source: src } })), true, "via token");
  assert.equal(R.isPopOut(R.configSource({ document: { documentName: "Actor", prototypeToken: { _source: src } } })), true, "actor -> prototype token");
  assert.equal(R.isPopOut(R.configSource({ document: { documentName: "Actor", prototypeToken: { _source: src } }, actor: null })), true);
  assert.equal(R.isPopOut(R.configSource({ document: { _source: { flags: {} } } })), false);
  assert.equal(R.configSource({}), null);
  assert.equal(R.isPopOut(R.configSource({ document: { flags: { [ID]: { popOut: true } } } })), true, "live document without _source");
});

test("ring class: core statics that use private fields work on Ringmaker's subclass (createAssetsUVs regression)", () => {
  // Like core's TokenRing: a static method writes a static private field through `this`.
  class FakeRing {
    static #ringData = [];
    static createAssetsUVs() { this.#ringData = ["ring"]; this.baseTexture = "tex"; }
    static getRingDataBySize() { return this.#ringData[0]; }
    static effects = { ENABLED: 1 };
    configureVisuals() { this.effects = 1; }
  }
  class Plain extends FakeRing { }
  assert.throws(() => Plain.createAssetsUVs(), TypeError, "a plain subclass fails the way core's does");
  const Sub = R.popOutRingClass(FakeRing);
  assert.equal(Object.getPrototypeOf(Sub), FakeRing, "still a real subclass");
  assert.doesNotThrow(() => Sub.createAssetsUVs());
  assert.equal(Sub.getRingDataBySize(1), "ring");
  assert.equal(Sub.baseTexture, "tex", "static data set on the base is inherited");
  assert.equal(Sub.effects.ENABLED, 1);
  const r = new Sub(); r.token = { document: { flags: { [ID]: { popOut: true } } } }; r.configureVisuals();
  assert.equal(r.effects, 1 | R.POPOUT_STATE, "pop-out bit still added");
  assert.deepEqual(R.forwardPrivateStatics(class extends FakeRing { }, FakeRing).sort(), ["createAssetsUVs", "getRingDataBySize"]);
});

test("Remove plan (cleanUpdate): restores the ring and deletes every Ringmaker flag", () => {
  const rec = { enabled: false, scale: 1, applied: 0.85 };
  const both = { ring: { enabled: true, subject: { scale: 0.85 } }, flags: { [ID]: { prior: rec, popOut: true } } };
  assert.deepEqual(R.cleanUpdate(both), { "ring.enabled": false, "ring.subject.scale": 1, [`flags.${ID}`]: null }, "prior restored, prior and popOut both go");
  const popOnly = { ring: { enabled: true }, flags: { [ID]: { popOut: true } } };
  assert.deepEqual(R.cleanUpdate(popOnly), { [`flags.${ID}`]: null }, "ring you turned on yourself is kept; only the flag goes");
  assert.deepEqual(R.cleanUpdate(popOnly, { prefix: "prototypeToken." }), { [`prototypeToken.flags.${ID}`]: null });
  assert.equal(R.cleanUpdate(tok(true)), null, "nothing of Ringmaker's: left alone");
  assert.equal(R.cleanUpdate({ flags: { [ID]: {} } }), null, "empty namespace: nothing to do");
  assert.equal(R.cleanUpdate(null), null);
  const DEL = Symbol("del");
  assert.equal(R.foundryDeletes([R.cleanUpdate(both)], DEL)[0][`flags.${ID}`], DEL, "v14 deletion operator");
  assert.deepEqual(R.foundryDeletes([R.cleanUpdate(popOnly, { prefix: "prototypeToken." })], undefined)[0], { [`prototypeToken.flags.-=${ID}`]: null }, "older '-=' key");
  const keep = R.foundryDeletes([{ "flags.other.x": null }], DEL)[0];
  assert.equal(keep["flags.other.x"], null, "other modules' keys untouched");
});

test("updateToken bail-out: only pop-out changes count", () => {
  assert.equal(R.touchesPopOut({ x: 1 }), false);
  assert.equal(R.touchesPopOut({ flags: { other: { a: 1 } } }), false);
  assert.equal(R.touchesPopOut({ flags: { [ID]: { prior: {} } } }), false, "prior alone doesn't change visuals");
  assert.equal(R.touchesPopOut({ flags: { [ID]: { popOut: true } } }), true);
  assert.equal(R.touchesPopOut({ flags: { [ID]: { "-=popOut": null } } }), true);
  assert.equal(R.touchesPopOut({ flags: { [`-=${ID}`]: null } }), true, "namespace removed by Remove");
  assert.equal(R.touchesPopOut({ flags: { [ID]: Symbol("del") } }), true, "v14 deletion operator");
  assert.equal(R.touchesPopOut(null), false);
});

test("target effect: core bits, combined with pop-out, nothing for off/flash", () => {
  assert.deepEqual(Object.keys(R.TARGET_EFFECTS), ["off", "pulse", "gradient", "flash"]);
  assert.equal(R.targetBit("pulse"), 0x02); assert.equal(R.targetBit("gradient"), 0x04);
  assert.equal(R.targetBit("pulse", { RING_PULSE: 2, RING_GRADIENT: 4, ENABLED: 1 }), 2, "read from core's enum");
  assert.equal(R.targetBit("off"), 0); assert.equal(R.targetBit("flash"), 0); assert.equal(R.targetBit("nope"), 0);
  assert.equal(R.ringEffects(1, { target: 2 }), 3);
  assert.equal(R.ringEffects(1, { popOut: true, target: 4 }), 0x45);
  assert.equal(R.ringEffects(0x43, {}), 0x03, "pop-out bit cleared when off; core's bits kept");
});

test("ring class: target effect bit while targeted, not otherwise", () => {
  class FakeRing { static effects = { ENABLED: 1 }; configureVisuals() { this.effects = 1; } }
  const Sub = R.popOutRingClass(FakeRing, { target: 2 });
  const r = new Sub(); r.token = { document: { flags: {} }, targeted: new Set(["u"]) }; r.configureVisuals();
  assert.equal(r.effects, 3);
  r.token.targeted.clear(); r.configureVisuals(); assert.equal(r.effects, 1, "core resets, no bit when untargeted");
  const Off = R.popOutRingClass(FakeRing);
  const o = new Off(); o.token = { document: { flags: {} }, targeted: new Set(["u"]) }; o.configureVisuals();
  assert.equal(o.effects, 1, "setting off: nothing added");
});

test("menu preview layout follows the ring texture maths", () => {
  const band = { outer: 1, inner: 0.84 };
  const p = R.previewLayout({ band, size: 100, px: 200 });
  const L = R.ringLayout(band, 100);
  assert.equal(p.ring, Math.round(200 * L.scale * 10) / 10);
  assert.equal(p.bkg, Math.round(200 * L.bkgR * 10) / 10);
  assert.ok(p.bkg < p.ring, "background sits inside the ring");
  assert.equal(p.ringOnTop, true); assert.equal(R.previewLayout({ band, front: false }).ringOnTop, false);
  assert.ok(R.previewLayout({ band, size: 125 }).ring > R.previewLayout({ band, size: 50 }).ring);
  assert.equal(R.previewLayout({ band, size: 999 }).ring, R.previewLayout({ band, size: 125 }).ring, "size clamped");
  assert.equal(R.previewLayout({ band, scale: 0.5 }).art, Math.round(200 * R.CORE.subject * 0.5 * 10) / 10);
});
