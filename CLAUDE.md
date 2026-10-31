# CLAUDE.md: Ringmaker

Foundry VTT module (v13/v14, any game system) that lets you use your own ring image through Foundry's dynamic token rings. It registers the image as a ring style and turns the ring on for NPC tokens (or all tokens). Token art and portraits are never changed. Public repo, MIT.

## File map (`scripts/`)
- `main.mjs` entry: `init` registers settings and the menu; `ready` applies to existing tokens; adds the pop-out field to the token config; exposes `game.modules.get("ringmaker").api`.
- `ring.mjs` core: ring registration (spritesheet + canvas texture from the world setting image), geometry matching core rings, background disc, patched ring shader, settings (`ring.mjs` registers them), apply/remove/plan/status logic.
- `menu.mjs` "Ringmaker tools" settings menu (ApplicationV2, HTML built in code; live ring preview with size/colour/front inputs and Save and reload, Apply with confirm, Remove with confirm and count).
- `gm.mjs` pure active-GM pick.
- `assets/token-ring.json` one-frame spritesheet descriptor (the texture is drawn from the setting image, not read from disk).

## Key patterns
- **Settings:** world-scope settings in `ring.mjs` (image, NPCs only vs every token, auto-ring new tokens, ring existing on load, ring size 50-125%, background colour, ring in front of art, ...). Keep keys stable; old values migrate on load (e.g. artScale).
- **Prior state:** what a token had before is stored in `flags.ringmaker.prior`, so Remove restores it. Per-token pop-out is `flags.ringmaker.popOut` (checkbox in the token config, GM only).
- **NPC test:** actor type not "character" and no player owner (system-agnostic). No image set means the module does nothing.
- **Shader patch:** the ring-in-front shader falls back to the core shader if the core source changes. Check this on each Foundry release.
- **Ring class (pop-out):** `popOutRingClass()` subclasses core's `TokenRing`. Core's static `createAssetsUVs`/`getRingDataBySize` use static private fields (`this.#ringData`), which throw on a subclass, so `forwardPrivateStatics` replaces any base static whose source uses `this.#` with a forward that runs it on the base class (1.2.2 fix; tested with a fake base). Never subclass core ring/shader classes without checking for static private fields. Note `CONFIG.Token.ring.ringClass = X` writes into the active ring config, and `canvas.draw()` chains on the previous draw, so after one failed draw later draws re-throw the old error until a reload.
- **Token config checkbox:** `configSource(app)` (pure, tested) finds the token data being edited (placed token, prototype token, or an actor's prototype token) so the pop-out box is ticked correctly. The exact app property names in v14 still need a live check.
- **Active-GM writes:** automatic changes (ringing existing tokens at load) run only on the active GM's client (`gm.mjs`). `applyAll` and `remove` are active-GM only; `setPopOut` is GM only.
- **API:** `{ applyAll({ npcOnly }), remove(), removePlan(), plan({ npcOnly }), status(), setPopOut(tokens, on) }`.
- No feature registry, health check or update-notes card here; the module is small and every behaviour is a setting.

## 1.3 notes
- **Remove is fully clean:** `cleanUpdate(src)` (pure) = `ringRevert` + delete the whole `flags.ringmaker` (null → `_del` or `-=ringmaker` in `foundryDeletes`). `plan({ revert: true })` uses it; `removePlan()` gives counts. Any new flag lives under `flags.ringmaker` and is cleared for free.
- **Target effect:** setting `targetEffect` (off/pulse/gradient/flash, default off, reload). Off registers no hook. Pulse/gradient: the ring class gets `{ target: bit }` (bit from `TokenRing.effects.RING_PULSE`/`RING_GRADIENT`, `targetBit`) and adds it in `configureVisuals` while `token.targeted.size`; the `targetToken` hook only calls `configureVisuals` + `refreshRingVisuals`. Flash: `token.ring.flashColor(Color.from(user.color))` on target. Client only, no writes.
- `updateToken` bails with pure `touchesPopOut(changed)`.
- **Menu preview:** `previewLayout` (pure) uses `ringLayout`, so ring/background/art sizes match the texture; DOM + CSS (`clip-path` for the trimmed art, z-order for front). Inputs are the window's own; `saveLook` writes only changed settings, then `SettingsConfig.reloadConfirm({ world: true })`.
- **Per-actor ring image: not done.** v14 `TokenRing` has one static `baseTexture`/`texturesData` per ring config (one spritesheet); per-token `ringName`/`ringUVs` are set inside `configureSize`, undocumented. A safe version would need a fixed-slot atlas (N frames in the JSON, the canvas texture drawn with N images) plus overriding `ringName`/`ringUVs` after `super.configureSize()`. Don't ship without a live check and an API that documents those fields.

## House practices
- **Tag format:** releases are tagged `vMAJOR.MINOR.PATCH`; the release workflow fails early on anything else.
- **Compatibility:** `module.json` `compatibility` has `minimum` and `verified` set honestly (13 / 14). No `relationships.systems`: the module is system-agnostic.
- **Hooks:** hot hooks (token updates, refreshes, draws) bail out on the first line for tokens or changes they don't handle. Build textures once (the ring texture is drawn once at setup) and never reload or redraw per refresh or per frame.
- **Flags and settings:** write only under `flags.ringmaker.*` and the `ringmaker` settings namespace. Document each one in the README ("Data Ringmaker writes") and keep a way to remove it, or document how.
- **Cross-module:** talk to other modules only through their public APIs or hooks; never reach into their internals.
- **Cleanup:** Remove restores what Ringmaker changed; anything it leaves behind must be documented.
- **API docs:** every public API member is listed in the README, marked stable or experimental. Update it with the code.
- **Releases:** end with a live checklist (what needs a live Foundry world to verify) in the changelog or handoff.

## Tests
- `npm test` = `node --test` (`tests/ring.test.mjs`); `npm run check` syntax-checks scripts. CI (`test.yml`) runs them, and the release workflow runs them again.
- Pure and tested: geometry, plan/prior-state logic, Remove's clean plan, pop-out/target effect bits, preview layout, migrations, active-GM pick. The shader patch, canvas texture, token config UI and menu need a live Foundry world and are untested in Node.

## Release process
1. Bump `version` in `module.json` and the `download` URL (`.../releases/download/vX.Y.Z/module.zip`); the manifest URL stays `.../releases/latest/download/module.json`.
2. Add a `CHANGELOG.md` section. Commit and push to main.
3. **Agents never tag or publish.** The user publishes the GitHub release; the Release workflow runs tests, sets version/URLs in `module.json` and builds `module.zip` (`module.json scripts assets LICENSE README.md CHANGELOG.md`). A new top-level folder must be added to the workflow zip step.

## Rules
- Public repo: no campaign names, no game-publisher (WoW/Blizzard) wording in user-facing text, no private details (IPs, domains, local paths).
- No official non-SRD rules text; never use 5etools or other unofficial rules sites.
- Every behaviour must be switchable by a setting; the module does nothing until an image is set.
- Commit author `cocoomg11 <cocoomg11@users.noreply.github.com>`; end commit messages with the attribution trailers given by the session.
