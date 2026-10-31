/**
 * The settings menu ("Ringmaker tools" in the module settings): what's set, and the two buttons that change existing tokens.
 * A plain ApplicationV2 with its HTML built here, so no template file is needed.
 */
import * as Ring from "./ring.mjs";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
/** Sample token art for the preview: a square picture (so trimming shows) with a plain figure, no external file. */
const SAMPLE = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6d8fb3"/><stop offset="1" stop-color="#2f4a66"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/><circle cx="50" cy="38" r="17" fill="#e8d2b0"/><path d="M18 100 C20 70 34 60 50 60 C66 60 80 70 82 100 Z" fill="#8a3b2e"/></svg>`);
const PX = 200;
const confirm = (title, content) => foundry.applications.api.DialogV2.confirm({ window: { title }, content, rejectClose: false });

export class RingmakerMenu extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "ringmaker-menu",
    tag: "div",
    window: { title: "Ringmaker", icon: "fa-solid fa-circle-notch" },
    position: { width: 460, height: "auto" },
    actions: { apply: RingmakerMenu.#apply, remove: RingmakerMenu.#remove, saveLook: RingmakerMenu.#saveLook }
  };

  async _renderHTML() {
    const st = Ring.status();
    const p = st.image ? Ring.plan() : null;
    const line = !st.image
      ? `<p><strong>No ring image chosen.</strong> Pick one in the module settings (Ring image); until then Ringmaker leaves Foundry's ring alone.</p>`
      : `<p>Ring image: <code>${esc(st.image)}</code>${st.error ? `<br><strong>Couldn't load it:</strong> ${esc(st.error)}` : ""}</p>
         <p>Targets: ${esc(Ring.TARGETS[st.mode])} · ring size ${st.size}% · art size ${st.scale} · background <span style="display:inline-block; width:0.9em; height:0.9em; vertical-align:middle; border:1px solid #888; background:${esc(st.background)}"></span> ${esc(st.background)}${st.front ? " · ring in front" : ""}${st.active === false ? " · <strong>not the active ring style</strong> (reload Foundry)" : ""}</p>
         ${st.band ? `<p class="hint">Ring band found at ${Math.round(st.band.inner * 100)}–${Math.round(st.band.outer * 100)}% of the image's radius.</p>` : ""}
         <p>${p.count ? `Still to ring: ${plural(p.actors.length, "actor prototype token")} and ${plural(p.tokens, "placed token")}.` : "Every matching token already has the ring."}</p>`;
    const gm = game.user.isGM ? "" : "disabled";
    const look = st.image ? `<fieldset style="margin-top:0.5rem"><legend>Ring look (preview)</legend>
        <div style="display:flex; gap:0.75rem; align-items:flex-start">
          <div class="rm-preview" style="position:relative; flex:none; width:${PX}px; height:${PX}px; overflow:hidden; border:1px solid #8886; border-radius:4px; background:repeating-conic-gradient(#8882 0 25%, transparent 0 50%) 0 0 / 16px 16px">
            <div class="rm-bkg" style="position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); border-radius:50%"></div>
            <img class="rm-art" src="${SAMPLE}" alt="" style="position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); border:none; max-width:none">
            <img class="rm-ring" src="${esc(st.image)}" alt="" style="position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); object-fit:contain; border:none; max-width:none">
          </div>
          <div style="flex:1; display:flex; flex-direction:column; gap:0.4rem">
            <label>Ring size <output class="rm-size-out">${st.size}%</output><input type="range" name="ringSize" min="50" max="125" step="1" value="${st.size}" ${gm} style="width:100%"></label>
            <label>Background colour <input type="color" name="background" value="${esc(st.background)}" ${gm}></label>
            <label><input type="checkbox" name="ringInFront" ${st.front ? "checked" : ""} ${gm}> Ring in front of token art</label>
            <button type="button" data-action="saveLook" ${gm}><i class="fa-solid fa-floppy-disk"></i> Save and reload</button>
          </div>
        </div>
        <p class="hint">A close guide, not the exact drawing: sizes use the same layout maths as the ring texture, but a token's own background colour, ring effects and the shader's edge blending aren't shown. Saving changes the world settings and reloads Foundry for everyone.</p>
      </fieldset>` : "";
    return `<section style="padding: 0.5rem 0.75rem">${line}${look}
      <div style="display:flex; gap:0.5rem; margin-top:0.5rem">
        <button type="button" data-action="apply" ${st.image ? gm : "disabled"}><i class="fa-solid fa-circle-notch"></i> Apply ring to existing tokens</button>
        <button type="button" data-action="remove" ${gm}><i class="fa-solid fa-eraser"></i> Remove Ringmaker's ring</button>
      </div>
      <p class="hint" style="margin-top:0.5rem">Apply turns the ring on (and moves tokens still at an art size Ringmaker set earlier to the current setting) for the prototype tokens of matching actors and every matching token on every scene. Remove puts back what each token had before and deletes Ringmaker's flags on it (recorded values, pop-out). Token art and portraits are never changed.</p>
    </section>`;
  }

  _replaceHTML(result, content) { content.innerHTML = result; }

  /** Live preview: redrawn from the window's own inputs (not the saved settings) as the GM changes them. */
  async _onRender(context, options) {
    await super._onRender(context, options);
    const root = this.element; const box = root?.querySelector(".rm-preview"); if (!box) return;
    const band = Ring.status().band; const scale = Ring.status().scale;
    const draw = () => {
      const size = Ring.clampSize(root.querySelector('[name="ringSize"]')?.value);
      const color = Ring.cssColor(root.querySelector('[name="background"]')?.value);
      const front = !!root.querySelector('[name="ringInFront"]')?.checked;
      const L = Ring.previewLayout({ band, size, scale, front, px: PX });
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
    if (!p.count) return ui.notifications.info("Ringmaker: every matching token already has the ring.");
    const ok = await confirm("Apply ring to existing tokens", `<p>Turn on the ring for <strong>${plural(p.actors.length, "actor prototype token")}</strong> and <strong>${plural(p.tokens, "placed token")}</strong>?</p><p class="hint">Only the ring settings change; token images and portraits stay as they are. <em>Remove Ringmaker's ring</em> undoes it.</p>`);
    if (!ok) return;
    btn.disabled = true;
    try { await Ring.applyAll(); } finally { this.render(); }
  }

  static async #saveLook(event, btn) {
    const root = this.element; const v = n => root.querySelector(`[name="${n}"]`);
    btn.disabled = true;
    try {
      const changed = await Ring.saveLook({ ringSize: v("ringSize")?.value, background: v("background")?.value, ringInFront: v("ringInFront")?.checked });
      if (!changed) { ui.notifications.info("Ringmaker: nothing changed."); return; }
      await foundry.applications.settings.SettingsConfig.reloadConfirm({ world: true });
    } finally { btn.disabled = false; }
  }

  static async #remove(event, btn) {
    const rp = Ring.removePlan();
    if (!rp.actors && !rp.tokens) return ui.notifications.info("Ringmaker: no token or prototype token has Ringmaker's ring or data.");
    const ok = await confirm("Remove Ringmaker's ring", `<p>${plural(rp.actors, "actor prototype token")} and ${plural(rp.tokens, "placed token")}.</p><p>Put every token and prototype token Ringmaker ringed back the way it was, and delete Ringmaker's data on them (the recorded ring values and the pop-out choice)?</p><p class="hint">Tokens whose ring you turned on yourself keep their ring.</p>`);
    if (!ok) return;
    btn.disabled = true;
    try { await Ring.remove(); } finally { this.render(); }
  }
}
