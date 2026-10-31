# CLAUDE.md: Ringmaker

Foundry VTT module (v13/v14, any game system) that lets you use your own ring image through Foundry's dynamic token rings. It registers the image as a ring style and turns the ring on for NPC tokens (or all tokens). Token art and portraits are never changed. Public repo, MIT.

## File map (`scripts/`)
- `main.mjs` entry: `init` registers settings and the menu; `ready` applies to existing tokens; adds the pop-out field to the token config; exposes `game.modules.get("ringmaker").api`.
- `ring.mjs` core: ring registration (spritesheet + canvas texture from the world setting image), geometry matching core rings, background disc, patched ring shader, settings (`ring.mjs` registers them), apply/remove/plan/status logic.
- `menu.mjs` "Ringmaker tools" settings menu (ApplicationV2, HTML built in code; Apply with confirm, Remove).
- `gm.mjs` pure active-GM pick.
- `assets/token-ring.json` one-frame spritesheet descriptor (the texture is drawn from the setting image, not read from disk).

## Key patterns
- **Settings:** world-scope settings in `ring.mjs` (image, NPCs only vs every token, auto-ring new tokens, ring existing on load, ring size 50-125%, background colour, ring in front of art, ...). Keep keys stable; old values migrate on load (e.g. artScale).
- **Prior state:** what a token had before is stored in `flags.ringmaker.prior`, so Remove restores it. Per-token pop-out is `flags.ringmaker.popOut` (checkbox in the token config, GM only).
- **NPC test:** actor type not "character" and no player owner (system-agnostic). No image set means the module does nothing.
- **Shader patch:** the ring-in-front shader falls back to the core shader if the core source changes. Check this on each Foundry release.
- **Token config checkbox:** `configSource(app)` (pure, tested) finds the token data being edited (placed token, prototype token, or an actor's prototype token) so the pop-out box is ticked correctly. The exact app property names in v14 still need a live check.
- **Active-GM writes:** automatic changes (ringing existing tokens at load) run only on the active GM's client (`gm.mjs`). `applyAll` and `remove` are active-GM only; `setPopOut` is GM only.
- **API:** `{ applyAll({ npcOnly }), remove(), plan({ npcOnly }), status(), setPopOut(tokens, on) }`.
- No feature registry, health check or update-notes card here; the module is small and every behaviour is a setting.

## Tests
- `npm test` = `node --test` (`tests/ring.test.mjs`); `npm run check` syntax-checks scripts. CI (`test.yml`) runs them, and the release workflow runs them again.
- Pure and tested: geometry, plan/prior-state logic, migrations, active-GM pick. The shader patch, canvas texture, token config UI and menu need a live Foundry world and are untested in Node.

## Release process
1. Bump `version` in `module.json` and the `download` URL (`.../releases/download/vX.Y.Z/module.zip`); the manifest URL stays `.../releases/latest/download/module.json`.
2. Add a `CHANGELOG.md` section. Commit and push to main.
3. **Agents never tag or publish.** The user publishes the GitHub release; the Release workflow runs tests, sets version/URLs in `module.json` and builds `module.zip` (`module.json scripts assets LICENSE README.md CHANGELOG.md`). A new top-level folder must be added to the workflow zip step.

## Rules
- Public repo: no campaign names, no game-publisher (WoW/Blizzard) wording in user-facing text, no private details (IPs, domains, local paths).
- No official non-SRD rules text; never use 5etools or other unofficial rules sites.
- Every behaviour must be switchable by a setting; the module does nothing until an image is set.
- Commit author `cocoomg11 <cocoomg11@users.noreply.github.com>`; end commit messages with the attribution trailers given by the session.
