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
  assert.equal(R.clampScale(0.1), 0.5); assert.equal(R.clampScale(3), 1.5); assert.equal(R.clampScale("x"), 0.85); assert.equal(R.clampScale(0.876), 0.88);
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

test("spritesheet JSON: one square frame matching the drawn texture, no colour band", async () => {
  const j = await json("assets/token-ring.json");
  const frames = Object.values(j.frames);
  assert.equal(frames.length, 1);
  assert.deepEqual(frames[0].frame, { x: 0, y: 0, w: R.FRAME, h: R.FRAME });
  assert.deepEqual(j.meta.size, { w: R.FRAME, h: R.FRAME });
  assert.equal(frames[0].gridTarget, 1);
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
