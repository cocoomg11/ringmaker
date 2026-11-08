# CLAUDE.md: Ringmaker

Foundry VTT module (v13/v14, any game system) that lets you use your own ring image through Foundry's dynamic token rings. It registers the image as a ring style and turns the ring on for NPC tokens (or all tokens). Token art and portraits are never changed. Public repo, MIT.

## File map (`scripts/`)
- `main.mjs` entry: `init` registers settings and the menu; `ready` applies to existing tokens; adds the pop-out field to the token config; exposes `game.modules.get("ringmaker").api`.
- `ring.mjs` core: ring registration (spritesheet + canvas texture from the world setting image), geometry matching core rings, background disc, patched ring shader, settings (`ring.mjs` registers them), apply/remove/plan/status logic.
- `menu.mjs` "Ringmaker tools" settings menu (ApplicationV2 + core `RememberedWindow`, key `menu`; live ring preview with size/colour/front inputs and Save and reload, Apply with confirm, Remove with confirm and count, Reset window position). `menu-view.mjs` (pure, 1.6) its HTML on core's `wc-*` classes, strings via `t()` from `RINGMAKER.window.*`.
- `styles/ringmaker.css` (1.6) only the window's own layout (preview, controls), every selector under `.rm-window`, core tokens only.
- `gm.mjs` pure active-GM pick.
- `assets/token-ring.json` one-frame spritesheet descriptor (the texture is drawn from the setting image, not read from disk).

## Key patterns
- **Settings:** world-scope settings in `ring.mjs` (image, NPCs only vs every token, auto-ring new tokens, ring existing on load, ring size 50-125%, background colour, ring in front of art, ...). Keep keys stable; old values migrate on load (e.g. artScale).
- **Prior state:** what a token had before is stored in `flags.ringmaker.prior` (for every token Apply goes over, even if nothing changed), so Remove restores it. Per-token pop-out is `flags.ringmaker.popOut`, art framing `flags.ringmaker.artZoom`/`artFocus` (token config, GM only).
- **NPC test:** actor type not "character" and no player owner (system-agnostic). No image set means the module does nothing.
- **Shader patch:** the ring-in-front shader falls back to the core shader if the core source changes. Check this on each Foundry release.
- **Ring class (pop-out):** `popOutRingClass()` subclasses core's `TokenRing`. Core's static `createAssetsUVs`/`getRingDataBySize` use static private fields (`this.#ringData`), which throw on a subclass, so `forwardPrivateStatics` replaces any base static whose source uses `this.#` with a forward that runs it on the base class (1.2.2 fix; tested with a fake base). Never subclass core ring/shader classes without checking for static private fields. Note `CONFIG.Token.ring.ringClass = X` writes into the active ring config, and `canvas.draw()` chains on the previous draw, so after one failed draw later draws re-throw the old error until a reload.
- **Token config checkbox:** `configSource(app)` (pure, tested) finds the token data being edited (placed token, prototype token, or an actor's prototype token) so the pop-out box is ticked correctly. The exact app property names in v14 still need a live check.
- **Active-GM writes:** automatic changes (ringing existing tokens at load) run only on the active GM's client (`gm.mjs`). `applyAll` and `remove` are active-GM only; `setPopOut` is GM only.
- **API:** `{ applyAll({ npcOnly }), remove({ confirm }), removePlan(), plan({ npcOnly }), status(), setPopOut(tokens, on), setArtZoom(tokens, zoom), setArtFraming(tokens, { zoom, focus }), fitArt(tokens), open() }`. `setPopOut` and the framing calls take placeables, token documents, prototype tokens, actors or ids (`resolveTokens`).
- No feature registry, health check or update-notes card here; the module is small and every behaviour is a setting.

## 1.3 notes
- **Remove is fully clean:** `cleanUpdate(src)` (pure) = `ringRevert` + delete the whole `flags.ringmaker` (null → `_del` or `-=ringmaker` in `foundryDeletes`). `plan({ revert: true })` uses it; `removePlan()` gives counts. Any new flag lives under `flags.ringmaker` and is cleared for free.
- **Target effect:** setting `targetEffect` (off/pulse/gradient/flash, default off, reload). Off registers no hook. Pulse/gradient: the ring class gets `{ target: bit }` (bit from `TokenRing.effects.RING_PULSE`/`RING_GRADIENT`, `targetBit`) and adds it in `configureVisuals` while `token.targeted.size`; the `targetToken` hook only calls `configureVisuals` + `refreshRingVisuals`. Flash: `token.ring.flashColor(Color.from(user.color))` on target. Client only, no writes.
- `updateToken` bails with pure `touchesPopOut(changed)`.
- **Menu preview:** `previewLayout` (pure) uses `ringLayout`, so ring/background/art sizes match the texture; DOM + CSS (`clip-path` for the trimmed art, z-order for front). Inputs are the window's own; `saveLook` writes only changed settings, then `SettingsConfig.reloadConfirm({ world: true })`.

## 1.4 notes
- **Target effect fix (root cause):** core's `colorizeTokenRing` only draws pulse/gradient/flash inside `vRingColorBand` (`mixFactor = step(start, dist) - step(end, dist)`), and there as `vRingColor × red channel`. With the band 0/0 nothing showed. Now `token-ring.json` has `defaultColorBand` 0.6–1 and `patchShader` replaces `SHADER_LINES.pulse`/`mix`: the band only mixes in while PULSE/GRADIENT is set or `vRingColor != white`, and the base is the image's own colour (`tokenColor`) when no ring colour is set. Verified live on v14 by sampling ring pixels over time.
- **Remove tracking fix:** `ringUpdate` returns a prior record even when the ring needs no change (already enabled, scale 1) unless one exists; `cleanUpdate` then keeps the ring on and clears the flags.
- **Art framing:** flags `artZoom` (0.5–3) and `artFocus` `{x, y}` under `flags.ringmaker`; setting `artZoom` (Boolean, default on, reload) gates both. Zoom: the ring class's `configureSize` resets `textureScaleAdjustment` to 1 (core only sets it in grid-fit mode, so the old value would compound), calls super, then divides by the zoom (`zoomAdjustment`). Focus: there is no spare vertex attribute (core's ring shader uses all 16 WebGL guarantees; a 17th fails to link), so the focus is packed into the colour band pair (`packFocus`: band + 2 × round(focus × 1000)) in the shader subclass's `_packInterleavedGeometry` (always, because a bare band would read as focus 0), and `patchVertexShader` unpacks it (`VERTEX_LINES`) and samples the art around the focus instead of 0.5. The band offset in a vertex is `PrimaryBaseSamplerShader.batchVertexSize (7) + 11`. If the vertex lines change, focus is off with a warning and zoom still works.
- **Token config fields:** Zoom, Focus X, Focus Y are form fields named `flags.ringmaker.*`, so core's `TokenConfig#_previewChanges` copies them to `app._preview` (a preview token drawn in place of the real one); the field's change handler then sets `refreshSize` on it. `tidyArtZoom` in `preUpdateToken`/`preUpdateActor` turns zoom 1 / focus centre into a flag deletion. Fit measures the image (`opaqueRadius`) and solves `fitZoom` for the opaque edge landing on the background disc's edge.
- **Calibration target** (from portraits the table liked): face about 40–50 % of the opening wide, eyes a little above the ring's centre, shoulders/neck and action filling the rest, background cropped. Typical portrait zoom 1.1–1.3 with focus on the face; a big creature whose head is at one side of the picture needs zoom 2–2.5 with the focus on the head.
- **Per-actor ring image: not done.** v14 `TokenRing` has one static `baseTexture`/`texturesData` per ring config (one spritesheet); per-token `ringName`/`ringUVs` are set inside `configureSize`, undocumented. A safe version would need a fixed-slot atlas (N frames in the JSON, the canvas texture drawn with N images) plus overriding `ringName`/`ringUVs` after `super.configureSize()`. Don't ship without a live check and an API that documents those fields.

## 1.5 notes
- **Logging:** all console output goes through `scripts/log.mjs` (`log.error` always, `log.debug` only while the world setting `debugLog` is on; a throwing read counts as off). A test fails on any raw `console.*` elsewhere. `debugLog` is the key Wanderer's Satchel's adapter expects (`debugSetting` `{ namespace: "ringmaker", key: "debugLog" }`).
- **Localization:** setting/menu strings are `RINGMAKER.*` keys in `lang/en.json` (declared in `module.json` `languages`; the release zip includes `lang`). `langChoices` maps choices to keys; the `TARGETS`/`TARGET_EFFECTS` English maps are no longer read by the window (1.6 uses the lang keys) but stay exported.

## 1.6 notes (wanderers-core)
- **Core vendored** (first move): `vendor/wanderers-core/` pinned by `wanderers-core.lock.json` (0.5.0 in 1.6; 0.6.0 since 1.6.5). Never edit it; update with `node vendor/wanderers-core/vendor.mjs update X.Y.Z` (behind the agent proxy: `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt`), then test and commit `vendor/` with the lock. `npm run core:verify` checks it locally; CI (`test.yml`) and the Release workflow run `verify --remote`. Read core's CONVENTIONS.md and docs/ui.md, docs/windows.md.
- Only these core parts are used: `UI_CLASSES`, `esc`, `badge`, `statusLine` (pure, `menu-view.mjs`) and `RememberedWindow`, `registerWindowPlacement`, `resetPlacement` (Foundry half, `menu.mjs` / `main.mjs`). Not adopted (nothing to use them for yet): createFeatures/createSettings, leader, health, store, data folder, keybindings.
- **Look:** module.json `styles` lists core's `wanderers-ui.css` first, then `styles/ringmaker.css`. Windows and confirm dialogs carry `WINDOW_CLASSES` (`rm-window` + `...UI_CLASSES`); never write a literal `wc-r<N>` (test). Use core's components (`wc-pagehead`, `wc-panel`, `wc-lines`/`wc-status`, `wc-stats`, `wc-alert`, `wc-chip`, `wc-btn*`) before adding CSS. A new core version with a new stylesheet revision means checking the window in both themes.
- **Window strings** are `RINGMAKER.window.*` in `lang/en.json` (tests fail on a missing key or an unfilled `{placeholder}`); `t()` returns plain text, views `esc()` it. The token-config fields and notices are `RINGMAKER.tokenConfig.*` / `RINGMAKER.notice.*` (1.6.1).
- **windowPlacement** (hidden client setting, core's): registered in `init`. Remove (token cleanup) doesn't touch it; the window's Reset window position button clears it (`resetPlacement(ID)`); README *Data Ringmaker writes* lists it.
- CI calls core's reusable `module-checks.yml@v0.6.0` (since 1.6.5; keep the ref equal to the lock's version, `tests/menu.test.mjs` checks it) with `lint: false, types: false` (no ESLint/tsc dev dependencies or package-lock yet, and `ring.mjs` isn't JSDoc-typed); pin check, syntax check and tests run. Turn lint/types on when those exist.
- Release zip: `module.json scripts styles assets lang vendor LICENSE README.md CHANGELOG.md` minus `vendor/wanderers-core/config/*`, `vendor.mjs`, `testing/*`.

## 1.6.2 notes
- `countPhrase(t, actors, tokens)` (menu-view.mjs, pure) builds every count phrase (window, dialogs, notices): zero parts dropped, lang `RINGMAKER.window.count.and` joins two. Lang strings take `{what}`.
- `api.open()` keeps one `RingmakerMenu` instance in main.mjs. The window's footer has the `debugLog` checkbox (same world setting; `status().debug`).

## House practices
- **Tag format:** releases are tagged `vMAJOR.MINOR.PATCH`; the release workflow fails early on anything else.
- **Compatibility:** `module.json` `compatibility` has `minimum` and `verified` set honestly (13 / 14.370, the newest build checked live, as a full build number). No `relationships.systems`: the module is system-agnostic.
- **Hooks:** hot hooks (token updates, refreshes, draws) bail out on the first line for tokens or changes they don't handle. Build textures once (the ring texture is drawn once at setup) and never reload or redraw per refresh or per frame.
- **Flags and settings:** write only under `flags.ringmaker.*` and the `ringmaker` settings namespace. Document each one in the README ("Data Ringmaker writes") and keep a way to remove it, or document how.
- **Cross-module:** talk to other modules only through their public APIs or hooks; never reach into their internals.
- **Cleanup:** Remove restores what Ringmaker changed; anything it leaves behind must be documented.
- **API docs:** every public API member is listed in the README, marked stable or experimental. Update it with the code.
- **Releases:** end with a live checklist (what needs a live Foundry world to verify) in the changelog or handoff.

## Tests
- `npm test` = `node --test tests/*.test.mjs` (`tests/ring.test.mjs`, incl. log and lang checks; `tests/menu.test.mjs` the window view, lang keys, stylesheet scoping and order, no literal revision); `npm run check` syntax-checks scripts. CI (`test.yml`) runs them, and the release workflow runs them again.
- Pure and tested: geometry, plan/prior-state logic, `ready()` makes one plan and writes it (1.6.4, fake `game`), Remove's clean plan, pop-out/target effect bits, preview layout, migrations, active-GM pick, both shader patches (line presence), art zoom/focus flags, packing and fit maths, form tidy-up. The shader patch, canvas texture, token config UI and menu need a live Foundry world and are untested in Node.

## Release process
1. Bump `version` in `module.json` and the `download` URL (`.../releases/download/vX.Y.Z/module.zip`); the manifest URL stays `.../releases/latest/download/module.json`.
2. Add a `CHANGELOG.md` section. Commit and push to main.
3. **Agents never tag or publish.** The user publishes the GitHub release; the Release workflow runs tests, sets version/URLs in `module.json` and builds `module.zip` (`module.json scripts styles assets lang vendor LICENSE README.md CHANGELOG.md`, minus core's dev-only parts). A new top-level folder must be added to the workflow zip step.

## Rules
- Public repo: no campaign names, no game-publisher (WoW/Blizzard) wording in user-facing text, no private details (IPs, domains, local paths).
- No official non-SRD rules text; never use 5etools or other unofficial rules sites.
- Every behaviour must be switchable by a setting; the module does nothing until an image is set.
- Commit author `cocoomg11 <cocoomg11@users.noreply.github.com>`; end commit messages with the attribution trailers given by the session.
