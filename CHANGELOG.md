# Changelog

All notable changes to Ringmaker. Versions follow the `version` in `module.json`.

## Unreleased

- Under the hood: the Release workflow now has a read-only build job and a separate upload job (the only one that can write to the release), with top-level `permissions: contents: read` and every action pinned by commit SHA. Same tag check, version/URL setting and zip contents as before. No change to the module itself.

## 1.6.3 (2026-11-02)

- **No more "Ringmaker: ring put on ." with nothing after it.** When Apply or Remove has nothing to change, the notice now reads "Ringmaker: nothing to change." instead of a sentence with an empty count. Remove with `confirm` skips its dialog when there is nothing to remove.
- Untested in Foundry: Apply when every matching token already has the ring, and Remove when nothing has Ringmaker data (from the window and from `api.applyAll()` / `api.remove({ confirm: true })`) show "nothing to change" with no dialog; Apply or Remove with something to change still shows the counted notice.

## 1.6.2 (2026-11-01)

- **Token configuration wording.** The pop-out box is now labelled "Art breaks out of ring" (it no longer wraps mid-phrase; the detail stays in its hint). The Art framing hint no longer ends with developer text about flag names (they are listed in the README under *Data Ringmaker writes*). The Fit button has a localized `aria-label` as well as its tooltip.
- **Notices and dialogs drop zero counts.** "Ring put on 0 actor prototype tokens and 1 placed token" now reads "Ring put on 1 placed token"; singular and plural are handled for each part. The same goes for the Apply and Remove confirm dialogs and the window's "Still to ring" line.
- **Debug logging switch in the Ringmaker window** (footer): the same GM-only world setting `ringmaker.debugLog` as in the module settings.
- **New API member `open()`**: `game.modules.get("ringmaker").api.open()` opens the Ringmaker tools window (GM only, like the rest of the API); the other members are unchanged.

### Untested in Foundry

- Token configuration: the pop-out label fits on one line; the Art framing hint ends after "...is the default."; Fit has an accessible name (check with the inspector or a screen reader).
- Apply / Remove through the window and API: notices and dialogs read "1 placed token", "3 actor prototype tokens", or both joined with "and", never "0 ...".
- The Debug logging checkbox in the window: ticking it turns on console messages and the module settings checkbox follows; as a player (window opened by API) it is disabled.
- `game.modules.get("ringmaker").api.open()` as a GM opens the window (and again brings the same one forward); as a player it shows the "only a GM" notice.

## 1.6.1 (2026-11-01)

- **The token configuration fields are localized.** The "Let art break out of the ring" box, the Art framing row (Zoom, Focus X / Y, Fit, the Fit tooltip) and their hints now come from `lang/en.json` (`RINGMAKER.tokenConfig.*`), as do the notices (only a GM can change tokens, choose a ring image first, couldn't measure the image, ring put on / taken off with counts) and the Remove confirm dialog (`RINGMAKER.notice.*`). English only for now; the wording is unchanged.
- The API's "GM only" notice is a lang key too (`RINGMAKER.notice.gmOnly`).
- Under the hood: CI now calls the shared `module-checks.yml` of wanderers-core 0.5.1 (pin check, syntax check, tests; lint and type check stay off until the module has ESLint and tsc set up). A test checks that every lang key used in the scripts exists.

### Untested in Foundry

- Open a token's configuration (Appearance › Dynamic Token Ring) as a GM: the pop-out box and the Art framing row show readable English, no raw `RINGMAKER.*` key, and Fit still works (and, on an unreadable image, shows the "couldn't measure" notice).
- Apply and Remove through the API/window: the notice reads "ring put on N actor prototype tokens and N placed tokens"; the Remove confirm dialog title and text are right.
- A player calling an API member gets the "only a GM" notice.

## 1.6.0 (2026-11-01)

- **New look for the Ringmaker window.** "Ringmaker tools" now uses the shared look of the author's other modules (a page head with a status badge, panels for the ring image, the preview and the tokens, status lines and matching buttons), following Foundry's light and dark themes. Every control is still there: the live ring preview with Ring size, Background colour and Ring in front, Save and reload, Apply and Remove (with their confirm dialogs).
- **The window is localized.** Its text, the confirm dialogs and its notices are now `RINGMAKER.window.*` keys in `lang/en.json` (English only for now).
- **The window reopens where you left it** (per user and browser). Its position is kept in a hidden client setting, `ringmaker.windowPlacement`; **Reset window position** at the bottom of the window forgets it.
- Under the hood: Ringmaker now ships a pinned copy of the shared library wanderers-core 0.5.0 in `vendor/wanderers-core/` (nothing to install). CI and the release check that copy against its pin; the release zip includes `styles/` and `vendor/` (without core's dev-only `config/`, `vendor.mjs` and `testing/`).

### Untested in Foundry

- The window in the **dark and the light theme**: page head badge, panels, status lines, stat tiles, buttons (Apply primary, Remove red), the colour swatch and the preview's checker background are readable in both.
- The **live preview** still follows Ring size, Background colour and Ring in front as you change them, and Save and reload still saves and asks to reload.
- **Localisation**: no raw `RINGMAKER.window.*` key shows anywhere (window title, headings, counts such as "1 placed token", confirm dialogs, notices).
- The window with no ring image chosen (warning, Apply disabled) and as a player (if opened by API; controls disabled, GM-only note).
- Move the window, close and reopen it, reload: it opens in the same place; Reset window position, then close and reopen: it opens at Foundry's default spot. A smaller browser window pulls it back on screen.
- The confirm dialogs carry the shared look too.
- The release zip has `styles/ringmaker.css` and `vendor/wanderers-core/styles/wanderers-ui.css`, and Foundry loads both (no 404 in the console).

## 1.5.0 (2026-11-01)

- **New setting: Debug logging** (`debugLog`, world, off by default). Ringmaker's console output now goes through it: errors and fallbacks are always logged; ring registration and apply/remove counts are logged only while it is on. Wanderer's Satchel finds the setting and can switch it for you.
- **Localization:** setting names, hints, choices and the menu label are now in `lang/en.json` (English only for now; the Ringmaker window itself is still English).
- Updated the module description and README intro.

### Untested in Foundry

- The setting appears under Configure Settings › Ringmaker with its English name and hint, and the choice lists (Which tokens, Ring effect) still show their labels.
- With Debug logging on, the console shows `ringmaker |` debug lines on load and on Apply / Remove; with it off, none (errors still show).
- Wanderer's Satchel's Ringmaker page shows the Debug logging switch and it changes this setting.
- `lang/` is in the release zip.

## 1.4.2 (2026-11-01)

- **Security: the whole API is GM only.** `plan()`, `status()` and `removePlan()` used to answer a player with the ring configuration and token counts. Every member of `game.modules.get("ringmaker").api` now shows "GM only" and returns `undefined` to anyone who isn't a GM. GMs are unaffected.

### Untested in Foundry

- As a player, every `api.*` call (including `plan()`, `status()`, `removePlan()`) shows a "GM only" notice and returns `undefined`.
- As a GM, `plan()`, `status()`, `applyAll()`, `remove()` and the settings menu behave as in 1.4.1.

## 1.4.1 (2026-10-31)

- **Fixed: a token kept drawing its art outside the ring after pop-out was turned off** when the same update also changed its art framing (for example **Remove Ringmaker's ring**, which deletes all of Ringmaker's flags at once). The token now redraws for both changes; before, it needed a scene reload.
- **Note on Fit:** Fit measures the image's transparent margin, so it is only useful on transparent cut-out art. On a full-bleed portrait (no transparent edge) it has nothing to measure; set Zoom and Focus by hand instead.

### Live checklist (needs a Foundry world)

- On a placed token with pop-out on and a zoom set, one update that deletes both flags (or **Remove Ringmaker's ring**) puts the art back inside the ring with no reload, on the GM and on a player client.
- Pop-out alone and zoom alone still redraw as before.
- Target effects (Pulse, Gradient, Flash) still show when a player targets a ringed token, on that player's and the GM's client, and stop on untarget.

## 1.4.0 (2026-10-31)

Art framing per token (zoom and a focus point, with live preview), ring effects that actually show, and Remove that tracks every token.

- **Art framing** (new, per token, GM): in the token configuration's Dynamic Token Ring section, **Zoom** (0.5–3; 1 is Foundry's framing) and **Focus X/Y** (the point of the image, 0–1 from the top left, drawn at the ring's centre: put it on the face) frame the art inside the ring without touching the image. The canvas token previews each change as you type, as Foundry's own token config does. **Fit** measures the image's opaque part and sets the zoom so cut-out art just fills the opening. Stored as `flags.ringmaker.artZoom` and `flags.ringmaker.artFocus` (zoom 1 and the centre clear them); **Remove Ringmaker's ring** deletes them with the rest. New world setting **Per-token art zoom** (on by default; off ignores the stored values and leaves the shader as in 1.3). API: `setArtFraming(tokens, { zoom, focus })`, `setArtZoom(tokens, zoom)`, `fitArt(tokens)`.
- **Fixed: Ring effect on targeted tokens showed nothing.** Foundry draws its ring effects (pulse, gradient, flash colour) only inside the spritesheet's colour band, and tints that band with the ring colour times the image's red channel; Ringmaker's sheet had no colour band so the image kept its colours. The sheet now declares a band over the ring, and Ringmaker's shader uses the band only while an effect or a ring colour is active, with the image's own colour as the base, so the pulse darkens and brightens the ring image, the gradient sweeps it and a flash tints it, and the image is untouched otherwise.
- **Fixed: Remove missed tokens whose ring was already on.** Apply recorded a token only when it changed something, so a token that already had `ring.enabled` (ringed by hand or by an earlier version) got no record and Remove never listed it. Apply now records every token it goes over; for those, Remove keeps the ring on (what was recorded) and clears Ringmaker's data.
- `remove({ confirm: true })` asks first, with counts; plain `remove()` still asks nothing (the menu button always asks).
- `setPopOut`, `setArtZoom`, `setArtFraming` and `fitArt` accept actors too (their prototype token), as well as placed tokens, token documents, prototype tokens and ids on the viewed scene.
- A token config value of zoom 1 or focus 0.5/0.5 is stored as "no flag" rather than as the number (pre-update hooks).

### Not yet tested live

- The token config's Fit button and the live preview through Foundry's own preview token, from the real module (verified from a copy of the code injected into a v14 world; the form field, preview and reset on close worked there).
- Art framing on Foundry v13 (the vertex shader line and the batch vertex layout were checked on v14 only; if the lines differ, focus is off with a console warning and zoom still works).
- The target effect on the targeting player's client with the module installed (verified on the GM client with the patched shader injected; pulse brightness was measured changing over time, flash tinted the ring).
- Remove on a world where 1.4.0 recorded already-ringed tokens: they keep their ring and lose `flags.ringmaker`.

## 1.3.0 (2026-10-31)

Remove cleans up fully, a live preview in the Ringmaker window, and an optional ring effect on targeted tokens.

- **Remove now cleans up everything.** *Remove Ringmaker's ring* still puts back each token's ring as it was, and now also deletes the pop-out choice (`flags.ringmaker.popOut`) and anything else Ringmaker stored on tokens and actor prototype tokens. Tokens whose ring you turned on yourself keep their ring; only Ringmaker's data on them goes. The confirm box says how many tokens will change.
- **Live preview in Open Ringmaker** (GM). A sample token picture with your ring image over it, redrawn as you move *Ring size*, pick a *Background colour* or tick *Ring in front of token art* in that window, before anything is saved. **Save and reload** stores the three settings and asks to reload Foundry. The preview uses the same layout maths as the ring itself, so sizes match; it doesn't show a token's own background colour, ring effects or the shader's soft edges.
- **Ring effect on targeted tokens** (new setting, off by default). While a token with Ringmaker's ring is targeted, Foundry's own ring effect is used on it: *Pulse* or *Gradient* while it stays targeted, or *Flash once* in the targeting player's colour. Each client draws it for itself; nothing is saved to the world. With the setting off, nothing is registered. Changing it reloads Foundry.
- API: new `removePlan()` (experimental): what Remove would change, as counts.
- The token-update hook now returns at once for any update that doesn't touch the pop-out flag.
- **Not added: a different ring image per actor.** Foundry's v14 ring API has one ring texture for every token (one spritesheet per ring style); a per-actor image would mean changing undocumented parts of Foundry's ring class. Left out rather than shipped fragile.
- Also in this release (no behaviour change): the release workflow stops early if the release tag isn't `vMAJOR.MINOR.PATCH`. The pop-out ring class skips a redundant write. README documents the flags Ringmaker writes, how to remove them, and the API's stability.

### Not yet tested live

- Remove on a world with pop-out tokens: `flags.ringmaker` is gone afterwards (placed and prototype tokens), the ring comes back as recorded, and pop-out tokens redraw without the pop-out (v14 deletion operator and v13 `-=` key).
- The preview in Open Ringmaker: ring image, background disc and sample art line up with a real ringed token at 50 %, 100 % and 125 %; ring in front on and off; Save and reload stores the settings and offers the reload.
- Ring effect on targeted tokens, each of Pulse, Gradient and Flash: shows for the targeting player and for other clients, stops on untarget (Pulse/Gradient), only for tokens with the ring, and works together with pop-out tokens. That `Token#targeted` is already updated when the `targetToken` hook fires, and that the hook fires on other clients.
- No console errors on canvas draw with the setting on and off (the ring class is still the 1.2.2 subclass with the private-static forwards).


## 1.2.2 (2026-10-31)

- **Fixed: tokens didn't draw on Foundry v14.** With a ring image set, every scene load failed with "Cannot write private member #ringData" and no tokens were drawn. Foundry's token ring class keeps its ring data in a private static field, which its own static methods can't reach when they're called on a subclass (Ringmaker's pop-out ring class). Ringmaker's class now runs those methods on Foundry's own class, so the canvas draws normally and pop-out keeps working. If the ring class can't be adapted, pop-out is turned off and Foundry's own class is used.
- Includes the 1.2.1 fixes below (1.2.1 was not released).

## 1.2.1 (2026-10-31)

Fixes found in a code review of 1.2.0 (not yet tested in a live world).

- **Pop-out checkbox could show unticked when it was set.** The token configuration now finds the token's data more carefully (placed token, prototype token, or a window that hands over the actor), so the box reflects the saved setting.
- A large **Ring size** can no longer let the ring image spill into the background part of the ring texture.

## 1.2.0 (2026-10-31)

Token art can break out of the ring.

- **Let art break out of the ring** (new, per token): a checkbox in the Dynamic Token Ring section of the token configuration (placed and prototype tokens, GM only). For tokens with it on, art outside the ring's opening is drawn over the ring instead of being trimmed, so cut-out art (a creature whose head or wings reach past a disc) shows in front of and beyond the ring; art inside the opening stays under the ring as before. Keep the art's own disc inside the ring's opening, about two thirds of the image's width. Other tokens are drawn as before. Stored as `flags.ringmaker.popOut`.
- API: `setPopOut(tokens, on)` turns it on or off for placed tokens, token documents, prototype tokens or token ids on the viewed scene (GM only).
- Pop-out only matters with **Ring in front of token art** on; with it off every token already uses Foundry's order (art over the ring).

## 1.1.0 (2026-10-31)

Ring size and fit now match Foundry's own rings.

- **Fixed: the ring was too big and the token art sat in a large empty circle.** Ringmaker now finds the ring band in your image (from its transparency) and scales it so its outer edge lands where Foundry's own ring edge is, so ringed tokens are the same size as with the core rings. Images with a drop shadow or extra transparent margin work too.
- **Background behind the token art**: a filled disc the size of the ring's opening is drawn behind the art, so transparent art and the gap at the edge show a solid colour instead of the map. New **Background colour** setting (default `#2b2420`); a token's own ring background colour (Token configuration › Appearance) is used instead when set, and shown exactly rather than blended.
- **Ring in front of token art** (new, on by default): the ring is drawn over the art and the art is trimmed to the opening, so square art no longer pokes out past the ring. Turn it off for Foundry's own order (art over the ring). If a future Foundry version changes its ring shader, Ringmaker falls back to Foundry's own drawing and says so in the console.
- **Ring size** (new, 50–125 %, default 100 %): fine-tune the ring's size against Foundry's own.
- **Token art size inside the ring** now defaults to 1 (Foundry's default) instead of 0.85; the setting is new (`artScale`), so the old 0.85 isn't carried over. Tokens still at the 0.85 Ringmaker set move to the new value the next time Apply runs (or on load, with *Ring existing tokens on load*). A scale you set on a token yourself is still kept.
- The Ringmaker menu shows the ring size, background colour and where the ring band was found in your image.

## 1.0.0 (2026-10-31)

First release.

- Your own ring image (a square PNG with a transparent middle) registered as a Foundry dynamic token ring style. The image keeps its own colours (no colour band). With no image set, nothing is registered and Foundry's ring is left alone.
- **Which tokens**: NPCs only (default) or every token. An NPC is an actor that isn't of the `character` type and has no player owner, so it works in any system.
- **Ring new tokens** (on by default) and **Ring existing tokens on load** (off by default).
- **Token art size inside the ring** (0.85 by default); a scale you set on a token yourself is kept.
- **Open Ringmaker** menu with **Apply ring to existing tokens** (asks first) and **Remove Ringmaker's ring** (puts back what each token had, recorded in `flags.ringmaker`).
- Writes are made by the active GM only.
- API: `game.modules.get("ringmaker").api` with `applyAll`, `remove`, `plan` and `status`.
