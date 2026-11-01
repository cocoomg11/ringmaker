/**
 * The settings menu ("Ringmaker tools" in the module settings): what's set, the live ring preview, and the two buttons that change
 * existing tokens. An ApplicationV2 on wanderers-core's shared look, its HTML built in menu-view.mjs (pure), its strings in
 * lang/en.json (`RINGMAKER.window.*`). It reopens where it was left (core's RememberedWindow, client setting `windowPlacement`).
 */
import * as Ring from "./ring.mjs";
import * as View from "./menu-view.mjs";
import { RememberedWindow, resetPlacement } from "../vendor/wanderers-core/foundry/index.mjs";

/** Localized plain text for a RINGMAKER.* key (missing keys come back as the key, which a test guards against). */
export const t = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
const confirm = (title, content) => foundry.applications.api.DialogV2.confirm({ window: { title }, content, rejectClose: false, classes: View.WINDOW_CLASSES });

const Base = RememberedWindow(foundry.applications.api.ApplicationV2, { moduleId: Ring.ID, key: View.WINDOW_KEY, size: false });

export class RingmakerMenu extends Base {
  static DEFAULT_OPTIONS = {
    id: "ringmaker-menu",
    tag: "div",
    classes: View.WINDOW_CLASSES,
    window: { title: "RINGMAKER.window.title", icon: "fa-solid fa-circle-notch" },
    position: { width: 520, height: "auto" },
    actions: { apply: RingmakerMenu.#apply, remove: RingmakerMenu.#remove, saveLook: RingmakerMenu.#saveLook, resetPlacement: RingmakerMenu.#resetPlacement }
  };

  async _renderHTML() {
    const st = Ring.status();
    return View.menuHTML({ st, plan: st.image ? Ring.plan() : null, gm: game.user.isGM, t });
  }

  _replaceHTML(result, content) { content.innerHTML = result; }

  /** Live preview: redrawn from the window's own inputs (not the saved settings) as the GM changes them. */
  async _onRender(context, options) {
    await super._onRender(context, options);
    const root = this.element; const box = root?.querySelector(".rm-preview"); if (!box) return;
    const { band, scale } = Ring.status();
    const draw = () => {
      const size = Ring.clampSize(root.querySelector('[name="ringSize"]')?.value);
      const color = Ring.cssColor(root.querySelector('[name="background"]')?.value);
      const front = !!root.querySelector('[name="ringInFront"]')?.checked;
      const L = Ring.previewLayout({ band, size, scale, front, px: View.PX });
      const out = root.querySelector(".rm-size-out"); if (out) out.textContent = `${size}%`;
      const bkg = box.querySelector(".rm-bkg"); const art = box.querySelector(".rm-art"); const ring = box.querySelector(".rm-ring");
      Object.assign(bkg.style, { width: `${L.bkg}px`, height: `${L.bkg}px`, background: color, zIndex: 0 });
      Object.assign(ring.style, { width: `${L.ring}px`, height: `${L.ring}px`, zIndex: L.ringOnTop ? 2 : 1 });
      // Ring in front: the art is trimmed to the background disc and drawn under the ring. Off: core's order, art over the ring.
      Object.assign(art.style, { width: `${L.art}px`, height: `${L.art}px`, zIndex: L.ringOnTop ? 1 : 2, clipPath: L.clipArt ? `circle(${(L.bkg / 2).toFixed(1)}px at 50% 50%)` : "none" });
    };
    for (const el of root.querySelectorAll('[name="ringSize"], [name="background"], [name="ringInFront"]')) el.addEventListener("input", draw);
    draw();
  }

  static async #apply(event, btn) {
    const p = Ring.plan();
    if (!p.count) return ui.notifications.info(t("RINGMAKER.window.notice.allDone"));
    const ok = await confirm(t("RINGMAKER.window.apply"), View.applyConfirm(t, p));
    if (!ok) return;
    btn.disabled = true;
    try { await Ring.applyAll(); } finally { this.render(); }
  }

  static async #saveLook(event, btn) {
    const root = this.element; const v = n => root.querySelector(`[name="${n}"]`);
    btn.disabled = true;
    try {
      const changed = await Ring.saveLook({ ringSize: v("ringSize")?.value, background: v("background")?.value, ringInFront: v("ringInFront")?.checked });
      if (!changed) { ui.notifications.info(t("RINGMAKER.window.notice.unchanged")); return; }
      await foundry.applications.settings.SettingsConfig.reloadConfirm({ world: true });
    } finally { btn.disabled = false; }
  }

  static async #remove(event, btn) {
    const rp = Ring.removePlan();
    if (!rp.actors && !rp.tokens) return ui.notifications.info(t("RINGMAKER.window.notice.nothingToRemove"));
    const ok = await confirm(t("RINGMAKER.window.remove"), View.removeConfirm(t, rp));
    if (!ok) return;
    btn.disabled = true;
    try { await Ring.remove(); } finally { this.render(); }
  }

  /** Forgets where the window was left: it opens at Foundry's default spot next time. */
  static async #resetPlacement() {
    await resetPlacement(Ring.ID);
    ui.notifications.info(t("RINGMAKER.window.notice.placeReset"));
  }
}
