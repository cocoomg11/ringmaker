# Changelog

All notable changes to Ringmaker. Versions follow the `version` in `module.json`.

## 1.0.0

First release.

- Your own ring image (a square PNG with a transparent middle) registered as a Foundry dynamic token ring style. The image keeps its own colours (no colour band). With no image set, nothing is registered and Foundry's ring is left alone.
- **Which tokens**: NPCs only (default) or every token. An NPC is an actor that isn't of the `character` type and has no player owner, so it works in any system.
- **Ring new tokens** (on by default) and **Ring existing tokens on load** (off by default).
- **Token art size inside the ring** (0.85 by default); a scale you set on a token yourself is kept.
- **Open Ringmaker** menu with **Apply ring to existing tokens** (asks first) and **Remove Ringmaker's ring** (puts back what each token had, recorded in `flags.ringmaker`).
- Writes are made by the active GM only.
- API: `game.modules.get("ringmaker").api` with `applyAll`, `remove`, `plan` and `status`.
