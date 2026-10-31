/**
 * The settings menu ("Ringmaker tools" in the module settings): what's set, and the two buttons that change existing tokens.
 * A plain ApplicationV2 with its HTML built here, so no template file is needed.
 */
import * as Ring from "./ring.mjs";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const confirm = (title, content) => foundry.applications.api.DialogV2.confirm({ window: { title }, content, rejectClose: false });

export class RingmakerMenu extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "ringmaker-menu",
    tag: "div",
    window: { title: "Ringmaker", icon: "fa-solid fa-circle-notch" },
    position: { width: 460, height: "auto" },
    actions: { apply: RingmakerMenu.#apply, remove: RingmakerMenu.#remove }
  };

  async _renderHTML() {
    const st = Ring.status();
    const p = st.image ? Ring.plan() : null;
    const line = !st.image
      ? `<p><strong>No ring image chosen.</strong> Pick one in the module settings (Ring image); until then Ringmaker leaves Foundry's ring alone.</p>`
      : `<p>Ring image: <code>${esc(st.image)}</code>${st.error ? `<br><strong>Couldn't load it:</strong> ${esc(st.error)}` : ""}</p>
         <p>Targets: ${esc(Ring.TARGETS[st.mode])} · art size ${st.scale}${st.active === false ? " · <strong>not the active ring style</strong> (reload Foundry)" : ""}</p>
         <p>${p.count ? `Still to ring: ${plural(p.actors.length, "actor prototype token")} and ${plural(p.tokens, "placed token")}.` : "Every matching token already has the ring."}</p>`;
    const gm = game.user.isGM ? "" : "disabled";
    return `<section style="padding: 0.5rem 0.75rem">${line}
      <div style="display:flex; gap:0.5rem; margin-top:0.5rem">
        <button type="button" data-action="apply" ${st.image ? gm : "disabled"}><i class="fa-solid fa-circle-notch"></i> Apply ring to existing tokens</button>
        <button type="button" data-action="remove" ${gm}><i class="fa-solid fa-eraser"></i> Remove Ringmaker's ring</button>
      </div>
      <p class="hint" style="margin-top:0.5rem">Apply turns the ring on for the prototype tokens of matching actors and every matching token on every scene. Remove puts back what each token had before. Token art and portraits are never changed.</p>
    </section>`;
  }

  _replaceHTML(result, content) { content.innerHTML = result; }

  static async #apply(event, btn) {
    const p = Ring.plan();
    if (!p.count) return ui.notifications.info("Ringmaker: every matching token already has the ring.");
    const ok = await confirm("Apply ring to existing tokens", `<p>Turn on the ring for <strong>${plural(p.actors.length, "actor prototype token")}</strong> and <strong>${plural(p.tokens, "placed token")}</strong>?</p><p class="hint">Only the ring settings change; token images and portraits stay as they are. <em>Remove Ringmaker's ring</em> undoes it.</p>`);
    if (!ok) return;
    btn.disabled = true;
    try { await Ring.applyAll(); } finally { this.render(); }
  }

  static async #remove(event, btn) {
    const ok = await confirm("Remove Ringmaker's ring", `<p>Put every token and prototype token Ringmaker ringed back the way it was?</p><p class="hint">Tokens whose ring you turned on yourself aren't touched.</p>`);
    if (!ok) return;
    btn.disabled = true;
    try { await Ring.remove(); } finally { this.render(); }
  }
}
