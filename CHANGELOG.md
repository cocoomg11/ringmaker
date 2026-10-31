# Changelog

All notable changes to Ringmaker. Versions follow the `version` in `module.json`.

## Unreleased

- No behaviour change. The release workflow now stops early if the release tag isn't `vMAJOR.MINOR.PATCH`. The token-update hook returns immediately for updates that don't touch Ringmaker's flags, and the pop-out ring class skips a redundant write. README now documents the flags Ringmaker writes, how to remove them, and the API's stability.

## 1.2.2

- **Fixed: tokens didn't draw on Foundry v14.** With a ring image set, every scene load failed with "Cannot write private member #ringData" and no tokens were drawn. Foundry's token ring class keeps its ring data in a private static field, which its own static methods can't reach when they're called on a subclass (Ringmaker's pop-out ring class). Ringmaker's class now runs those methods on Foundry's own class, so the canvas draws normally and pop-out keeps working. If the ring class can't be adapted, pop-out is turned off and Foundry's own class is used.
- Includes the 1.2.1 fixes below (1.2.1 was not released).

## 1.2.1

Fixes found in a code review of 1.2.0 (not yet tested in a live world).

- **Pop-out checkbox could show unticked when it was set.** The token configuration now finds the token's data more carefully (placed token, prototype token, or a window that hands over the actor), so the box reflects the saved setting.
- A large **Ring size** can no longer let the ring image spill into the background part of the ring texture.

## 1.2.0

Token art can break out of the ring.

- **Let art break out of the ring** (new, per token): a checkbox in the Dynamic Token Ring section of the token configuration (placed and prototype tokens, GM only). For tokens with it on, art outside the ring's opening is drawn over the ring instead of being trimmed, so cut-out art (a creature whose head or wings reach past a disc) shows in front of and beyond the ring; art inside the opening stays under the ring as before. Keep the art's own disc inside the ring's opening, about two thirds of the image's width. Other tokens are drawn as before. Stored as `flags.ringmaker.popOut`.
- API: `setPopOut(tokens, on)` turns it on or off for placed tokens, token documents, prototype tokens or token ids on the viewed scene (GM only).
- Pop-out only matters with **Ring in front of token art** on; with it off every token already uses Foundry's order (art over the ring).

## 1.1.0

Ring size and fit now match Foundry's own rings.

- **Fixed: the ring was too big and the token art sat in a large empty circle.** Ringmaker now finds the ring band in your image (from its transparency) and scales it so its outer edge lands where Foundry's own ring edge is, so ringed tokens are the same size as with the core rings. Images with a drop shadow or extra transparent margin work too.
- **Background behind the token art**: a filled disc the size of the ring's opening is drawn behind the art, so transparent art and the gap at the edge show a solid colour instead of the map. New **Background colour** setting (default `#2b2420`); a token's own ring background colour (Token configuration › Appearance) is used instead when set, and shown exactly rather than blended.
- **Ring in front of token art** (new, on by default): the ring is drawn over the art and the art is trimmed to the opening, so square art no longer pokes out past the ring. Turn it off for Foundry's own order (art over the ring). If a future Foundry version changes its ring shader, Ringmaker falls back to Foundry's own drawing and says so in the console.
- **Ring size** (new, 50–125 %, default 100 %): fine-tune the ring's size against Foundry's own.
- **Token art size inside the ring** now defaults to 1 (Foundry's default) instead of 0.85; the setting is new (`artScale`), so the old 0.85 isn't carried over. Tokens still at the 0.85 Ringmaker set move to the new value the next time Apply runs (or on load, with *Ring existing tokens on load*). A scale you set on a token yourself is still kept.
- The Ringmaker menu shows the ring size, background colour and where the ring band was found in your image.

## 1.0.0

First release.

- Your own ring image (a square PNG with a transparent middle) registered as a Foundry dynamic token ring style. The image keeps its own colours (no colour band). With no image set, nothing is registered and Foundry's ring is left alone.
- **Which tokens**: NPCs only (default) or every token. An NPC is an actor that isn't of the `character` type and has no player owner, so it works in any system.
- **Ring new tokens** (on by default) and **Ring existing tokens on load** (off by default).
- **Token art size inside the ring** (0.85 by default); a scale you set on a token yourself is kept.
- **Open Ringmaker** menu with **Apply ring to existing tokens** (asks first) and **Remove Ringmaker's ring** (puts back what each token had, recorded in `flags.ringmaker`).
- Writes are made by the active GM only.
- API: `game.modules.get("ringmaker").api` with `applyAll`, `remove`, `plan` and `status`.
