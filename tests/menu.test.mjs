import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import * as V from "../scripts/menu-view.mjs";
import { UI_CLASSES } from "../vendor/wanderers-core/index.mjs";

const read = p => readFile(new URL(`../${p}`, import.meta.url), "utf8");
const lang = JSON.parse(await read("lang/en.json"));
/** Localizer like Foundry's: missing keys come back marked so a test can find them. */
const t = (key, data = {}) => key in lang ? lang[key].replace(/\{(\w+)\}/g, (_, k) => String(data[k] ?? `{${k}}`)) : `MISSING:${key}`;
const ST = { image: "worlds/x/ring.png", mode: "npc", scale: 1, size: 100, background: "#202020", front: true, band: { inner: 0.7, outer: 0.9 }, active: true, error: null };
const PLAN = { count: 3, actors: [1, 2], tokens: 1 };

test("window carries core's root classes, never a literal revision", async () => {
  assert.deepEqual(V.WINDOW_CLASSES, ["rm-window", ...UI_CLASSES]);
  for (const f of await readdir(new URL("../scripts/", import.meta.url))) assert.doesNotMatch(await read(`scripts/${f}`), /wc-r\d/, f);
  assert.doesNotMatch(await read("styles/ringmaker.css"), /wc-r\d/);
});

test("stylesheet: core's first, ours scoped to the window and only core/Foundry tokens", async () => {
  const m = JSON.parse(await read("module.json"));
  assert.deepEqual(m.styles, ["vendor/wanderers-core/styles/wanderers-ui.css", "styles/ringmaker.css"]);
  for (const f of m.styles) await read(f);
  const css = (await read("styles/ringmaker.css")).replace(/\/\*[\s\S]*?\*\//g, "");
  for (const rule of css.match(/[^{}]+(?=\{)/g)) for (const sel of rule.split(",")) assert.match(sel.trim(), /^\.rm-window\b/, `unscoped: ${sel.trim()}`);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i, "no hard-coded colours");
});

test("every page state renders with no missing strings and escapes values", () => {
  const cases = [
    { st: ST, plan: PLAN, gm: true }, { st: ST, plan: { count: 0, actors: [], tokens: 0 }, gm: true },
    { st: { ...ST, error: "<b>404</b>", active: false }, plan: PLAN, gm: true }, { st: { ...ST, mode: "all", front: false, band: null }, plan: PLAN, gm: false },
    { st: { ...ST, image: "" }, plan: null, gm: true }, { st: { ...ST, image: "" }, plan: null, gm: false }
  ];
  for (const c of cases) {
    const html = V.menuHTML({ ...c, t });
    assert.doesNotMatch(html, /MISSING:|\{\w+\}/, html);
    assert.doesNotMatch(html, /<b>404/);
    assert.doesNotMatch(html, /[✓⚠✗]/);
  }
  const ok = V.menuHTML({ st: ST, plan: PLAN, gm: true, t });
  assert.match(ok, /class="wc-pagehead"/); assert.match(ok, /wc-panel/); assert.match(ok, /wc-status wc-ok/);
  assert.match(ok, /Still to ring: 2 actor prototype tokens and 1 placed token\./);
  for (const a of ["apply", "remove", "saveLook", "resetPlacement"]) assert.match(ok, new RegExp(`data-action="${a}"`));
  for (const n of ["ringSize", "background", "ringInFront"]) assert.match(ok, new RegExp(`name="${n}"`));
  assert.match(ok, /class="rm-preview"/); assert.doesNotMatch(ok, / disabled/);
  const player = V.menuHTML({ st: ST, plan: PLAN, gm: false, t });
  assert.equal((player.match(/ disabled/g) ?? []).length, 7, "inputs, Save, Apply, Remove, debug switch disabled for players");
  assert.match(ok, /name="debugLog"/);
  assert.match(V.menuHTML({ st: { ...ST, debug: true }, plan: PLAN, gm: true, t }), /name="debugLog" checked/);
  const none = V.menuHTML({ st: { ...ST, image: "" }, plan: null, gm: true, t });
  assert.match(none, /wc-alert wc-warn/); assert.doesNotMatch(none, /rm-preview/); assert.match(none, /data-action="apply" disabled/);
});

test("overall badge and counted phrases", () => {
  assert.deepEqual(V.overall({}), { tone: "warn", key: "noImage" });
  assert.equal(V.overall({ ...ST, error: "x" }).tone, "bad");
  assert.equal(V.overall({ ...ST, active: false }).key, "inactive");
  assert.equal(V.overall(ST).key, "ready");
  assert.equal(V.counted(t, "actors", 1), "1 actor prototype token");
  assert.equal(V.counted(t, "tokens", 0), "0 placed tokens");
  for (const html of [V.applyConfirm(t, PLAN), V.removeConfirm(t, { actors: 1, tokens: 4 })]) assert.doesNotMatch(html, /MISSING:|\{\w+\}/);
});

test("every RINGMAKER.window key used in code exists in the lang file", async () => {
  const src = (await read("scripts/menu.mjs")) + (await read("scripts/menu-view.mjs"));
  for (const [, k] of src.matchAll(/"(RINGMAKER\.window\.[\w.]+)"/g)) assert.ok(lang[k], k);
});

test("window placement: remembered under a valid key, registered at init", async () => {
  const { isWindowKey } = await import("../vendor/wanderers-core/index.mjs");
  assert.ok(isWindowKey(V.WINDOW_KEY));
  assert.match(await read("scripts/main.mjs"), /registerWindowPlacement\(Ring\.ID\)/);
  assert.match(await read("scripts/menu.mjs"), /RememberedWindow\(/);
});

test("every RINGMAKER.notice / tokenConfig key used in ring.mjs and gm.mjs exists in the lang file", async () => {
  for (const f of ["scripts/ring.mjs", "scripts/gm.mjs"]) {
    const src = await read(f);
    for (const [, k] of src.matchAll(/"(RINGMAKER\.(?:notice|tokenConfig)\.[\w.]+)"/g)) assert.ok(lang[k], k);
  }
  for (const k of ["on", "off"]) assert.ok(lang[`RINGMAKER.notice.ring.${k}`]);
});

test("countPhrase leaves out zero counts and handles singular/plural", () => {
  assert.equal(V.countPhrase(t, 0, 1), "1 placed token");
  assert.equal(V.countPhrase(t, 3, 0), "3 actor prototype tokens");
  assert.equal(V.countPhrase(t, 1, 2), "1 actor prototype token and 2 placed tokens");
  assert.equal(V.countPhrase(t, 0, 0), "");
  assert.match(V.removeConfirm(t, { actors: 0, tokens: 1 }), /<p>1 placed token\.<\/p>/);
  assert.match(V.applyConfirm(t, { actors: [], tokens: 5 }), /ring for 5 placed tokens\?/);
});

test("1.6.2 user-facing token config strings", () => {
  assert.equal(lang["RINGMAKER.tokenConfig.popOut.label"], "Art breaks out of ring");
  assert.doesNotMatch(lang["RINGMAKER.tokenConfig.artFraming.hint"], /flags\.|Stored as|\{/);
  assert.ok(lang["RINGMAKER.tokenConfig.artFraming.fitLabel"]);
});

test("main.mjs exposes api.open and ring.mjs gives the Fit button an aria-label", async () => {
  assert.match(await read("scripts/main.mjs"), /open: \(\) => openWindow\(\)/);
  assert.match(await read("scripts/ring.mjs"), /aria-label="\$\{esc\(tr\("RINGMAKER\.tokenConfig\.artFraming\.fitLabel"\)\)\}"/);
});

test("ringNotice: counted sentence, or 'nothing to change' when both counts are zero", () => {
  assert.equal(V.ringNotice(t, "on", 0, 1), "Ringmaker: ring put on 1 placed token.");
  assert.equal(V.ringNotice(t, "off", 2, 1), "Ringmaker: ring taken off 2 actor prototype tokens and 1 placed token.");
  for (const verb of ["on", "off"]) {
    const msg = V.ringNotice(t, verb, 0, 0);
    assert.equal(msg, "Ringmaker: nothing to change.");
    assert.doesNotMatch(msg, /MISSING|\{|put on \./);
  }
});

test("1.6.5: vendored core matches its lock and CI calls the same core version", async () => {
  const { CORE_VERSION } = await import("../vendor/wanderers-core/index.mjs");
  const lock = JSON.parse(await read("wanderers-core.lock.json"));
  assert.equal(CORE_VERSION, lock.version);
  assert.match(await read(".github/workflows/test.yml"), new RegExp(`module-checks\\.yml@v${lock.version.replace(/\./g, "\\.")}\\s`));
  assert.ok(UI_CLASSES.includes("wc-r4"));
});

test("1.6.5 version and compatibility", async () => {
  const m = JSON.parse(await read("module.json"));
  assert.equal(m.version, "1.6.5");
  assert.equal(JSON.parse(await read("package.json")).version, "1.6.5");
  assert.match(m.download, /releases\/download\/v1\.6\.5\/module\.zip$/);
  assert.equal(m.compatibility.verified, "14.370");
  assert.match(await read("CHANGELOG.md"), /^## 1\.6\.5 \(2026-11-08\)[\s\S]*?Untested in Foundry/m);
});
