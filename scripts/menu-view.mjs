/**
 * The "Ringmaker tools" window as HTML strings (pure: no Foundry calls, tested in Node). Built on wanderers-core's shared look
 * (`wc-*` classes and helpers); `t(key, data)` returns plain text for a `RINGMAKER.*` key, and every value is escaped here.
 */
import { esc, badge, statusLine, UI_CLASSES } from "../vendor/wanderers-core/index.mjs";

/** The window's own class (module CSS is scoped under it), plus core's root classes. */
export const WINDOW_CLASS = "rm-window";
export const WINDOW_CLASSES = [WINDOW_CLASS, ...UI_CLASSES];
/** The key the window's placement is remembered under (core's `windowPlacement` client setting). */
export const WINDOW_KEY = "menu";
/** Preview box size in CSS pixels. */
export const PX = 200;

/** Sample token art for the preview: a square picture (so trimming shows) with a plain figure, no external file. */
export const SAMPLE = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6d8fb3"/><stop offset="1" stop-color="#2f4a66"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/><circle cx="50" cy="38" r="17" fill="#e8d2b0"/><path d="M18 100 C20 70 34 60 50 60 C66 60 80 70 82 100 Z" fill="#8a3b2e"/></svg>`);

/** Lang key prefix for the window's strings. */
const W = "RINGMAKER.window.";

/**
 * A counted phrase: `<W>count.<what>.one` for 1, `.other` otherwise, with `{n}`.
 * @param {(key: string, data?: object) => string} t
 * @param {"actors" | "tokens"} what
 * @param {number} n
 */
export const counted = (t, what, n) => t(`${W}count.${what}.${n === 1 ? "one" : "other"}`, { n });

/**
 * "2 actor prototype tokens and 1 placed token", leaving out a zero count ("1 placed token"); "" when both are zero.
 * @param {(key: string, data?: object) => string} t
 */
export const countPhrase = (t, actors, tokens) => {
  const parts = [actors && counted(t, "actors", actors), tokens && counted(t, "tokens", tokens)].filter(Boolean);
  return parts.length === 2 ? t(`${W}count.and`, { a: parts[0], b: parts[1] }) : parts[0] ?? "";
};

/**
 * The notice after Apply (`on`) or Remove (`off`): "Ringmaker: ring put on 1 placed token.", or "Ringmaker: nothing to change." when
 * both counts are zero (never a sentence with an empty count).
 * @param {(key: string, data?: object) => string} t
 * @param {"on" | "off"} verb
 */
export const ringNotice = (t, verb, actors, tokens) => {
  const what = countPhrase(t, actors, tokens);
  return what ? t(`RINGMAKER.notice.ring.${verb}`, { what }) : t("RINGMAKER.notice.ring.none");
};

/**
 * The overall state shown as the page head's badge.
 * @param {{ image?: string, error?: unknown, active?: boolean | null }} st Ring.status()
 * @returns {{ tone: "ok" | "warn" | "bad", key: string }}
 */
export function overall(st) {
  if (!st?.image) return { tone: "warn", key: "noImage" };
  if (st.error) return { tone: "bad", key: "error" };
  if (st.active === false) return { tone: "warn", key: "inactive" };
  return { tone: "ok", key: "ready" };
}

/**
 * The whole window.
 * @param {object} o
 * @param {any} o.st Ring.status()
 * @param {{ count: number, actors: unknown[], tokens: number } | null} o.plan Ring.plan(), or null without an image
 * @param {boolean} o.gm the viewer is a GM (controls are disabled otherwise)
 * @param {(key: string, data?: object) => string} o.t localizer
 * @returns {string}
 */
export function menuHTML({ st, plan, gm, t }) {
  const dis = gm ? "" : " disabled";
  const o = overall(st);
  const head = `<header class="wc-pagehead"><div class="wc-pagehead-title"><h2>${esc(t(`${W}heading`))}</h2>
    <div class="wc-pagehead-meta">${badge(o.tone, t(`${W}status.${o.key}`), { icon: true })}
    ${st?.image ? `<span class="wc-chip">${esc(t(`${W}targets`, { targets: t(`RINGMAKER.targets.${st.mode === "all" ? "all" : "npc"}`) }))}</span>` : ""}</div></div></header>`;
  const gmNote = gm ? "" : `<div class="wc-alert wc-info"><i class="fa-solid fa-lock" aria-hidden="true"></i><span class="wc-alert-title">${esc(t(`${W}gmOnly`))}</span></div>`;
  if (!st?.image) {
    return `<div class="rm-body">${head}${gmNote}
      <div class="wc-alert wc-warn"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
        <span class="wc-alert-title">${esc(t(`${W}noImage.title`))}</span><p>${esc(t(`${W}noImage.text`))}</p></div>
      ${tokensPanel({ st, plan, gm, t })}${foot(t, { gm, debug: st?.debug })}</div>`;
  }
  return `<div class="rm-body">${head}${gmNote}${setupPanel(st, t)}${lookPanel(st, dis, t)}${tokensPanel({ st, plan, gm, t })}${foot(t, { gm, debug: st?.debug })}</div>`;
}

/** What's set: status lines and the four look values. */
export function setupPanel(st, t) {
  const lines = [statusLine(st.error ? "bad" : "ok", t(`${W}image`, { path: st.image }))];
  if (st.error) lines.push(statusLine("bad", t(`${W}loadError`, { error: String(st.error) })));
  if (st.active === false) lines.push(statusLine("warn", t(`${W}notActive`)));
  if (st.band) lines.push(statusLine("info", t(`${W}band`, { inner: Math.round(st.band.inner * 100), outer: Math.round(st.band.outer * 100) })));
  const stat = (k, v) => `<div class="wc-stat"><span class="wc-stat-k">${esc(t(`${W}stat.${k}`))}</span><span class="wc-stat-v">${v}</span></div>`;
  return `<section class="wc-panel"><header class="wc-panel-head"><h3>${esc(t(`${W}setup`))}</h3></header>
    <div class="wc-panel-body"><ul class="wc-lines rm-lines">${lines.join("")}</ul>
    <div class="wc-stats">${stat("size", `${esc(st.size)}%`)}${stat("scale", esc(st.scale))}
      ${stat("background", `<span class="rm-swatch" style="background:${esc(st.background)}" aria-hidden="true"></span><span class="wc-mono">${esc(st.background)}</span>`)}
      ${stat("order", esc(t(`${W}order.${st.front ? "front" : "art"}`)))}</div></div></section>`;
}

/** The live preview and its three inputs (names match the settings saveLook writes). */
export function lookPanel(st, dis, t) {
  return `<section class="wc-panel"><header class="wc-panel-head"><h3>${esc(t(`${W}look.head`))}</h3></header>
    <div class="wc-panel-body"><div class="rm-look">
      <div class="rm-preview" role="img" aria-label="${esc(t(`${W}look.preview`))}" style="width:${PX}px; height:${PX}px">
        <div class="rm-bkg"></div>
        <img class="rm-art" src="${SAMPLE}" alt="">
        <img class="rm-ring" src="${esc(st.image)}" alt="">
      </div>
      <div class="rm-controls">
        <label class="rm-field"><span class="rm-field-label">${esc(t(`${W}look.size`))} <output class="rm-size-out">${esc(st.size)}%</output></span>
          <input type="range" name="ringSize" min="50" max="125" step="1" value="${esc(st.size)}"${dis}></label>
        <label class="rm-field"><span class="rm-field-label">${esc(t(`${W}look.background`))}</span>
          <input type="color" name="background" value="${esc(st.background)}"${dis}></label>
        <label class="rm-check"><input type="checkbox" name="ringInFront"${st.front ? " checked" : ""}${dis}> ${esc(t(`${W}look.front`))}</label>
        <button type="button" class="wc-btn wc-btn-primary" data-action="saveLook"${dis}><i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> ${esc(t(`${W}look.save`))}</button>
      </div>
    </div>
    <p class="wc-hint">${esc(t(`${W}look.hint`))}</p></div></section>`;
}

/** Counts and the Apply / Remove buttons. */
export function tokensPanel({ st, plan, gm, t }) {
  const line = !st?.image ? "" : plan?.count
    ? statusLine("info", t(`${W}tokens.todo`, { what: countPhrase(t, plan.actors.length, plan.tokens) }))
    : statusLine("ok", t(`${W}tokens.done`));
  const dis = gm ? "" : " disabled";
  return `<section class="wc-panel"><header class="wc-panel-head"><h3>${esc(t(`${W}tokens.head`))}</h3></header>
    <div class="wc-panel-body">${line ? `<ul class="wc-lines rm-lines">${line}</ul>` : ""}
    <div class="wc-row rm-buttons">
      <button type="button" class="wc-btn wc-btn-primary" data-action="apply"${st?.image ? dis : " disabled"}><i class="fa-solid fa-circle-notch" aria-hidden="true"></i> ${esc(t(`${W}apply`))}</button>
      <button type="button" class="wc-btn wc-btn-danger" data-action="remove"${dis}><i class="fa-solid fa-eraser" aria-hidden="true"></i> ${esc(t(`${W}remove`))}</button>
    </div>
    <p class="wc-hint">${esc(t(`${W}tokens.hint`))}</p></div></section>`;
}

/** Footer: forget the window's remembered position. */
export function foot(t, { gm = true, debug = false } = {}) {
  return `<footer class="wc-row rm-foot"><label class="rm-check" title="${esc(t(`${W}debug.hint`))}"><input type="checkbox" name="debugLog"${debug ? " checked" : ""}${gm ? "" : " disabled"}> ${esc(t(`${W}debug.label`))}</label><button type="button" class="wc-btn wc-btn-ghost wc-btn-sm" data-action="resetPlacement"><i class="fa-solid fa-up-down-left-right" aria-hidden="true"></i> ${esc(t(`${W}resetPlace`))}</button></footer>`;
}

/** The confirm dialogs' HTML. */
export function applyConfirm(t, plan) {
  return `<p>${esc(t(`${W}dialog.apply.body`, { what: countPhrase(t, plan.actors.length, plan.tokens) }))}</p><p class="hint">${esc(t(`${W}dialog.apply.hint`))}</p>`;
}
export function removeConfirm(t, rp) {
  return `<p>${esc(t(`${W}dialog.remove.count`, { what: countPhrase(t, rp.actors, rp.tokens) }))}</p><p>${esc(t(`${W}dialog.remove.body`))}</p><p class="hint">${esc(t(`${W}dialog.remove.hint`))}</p>`;
}
