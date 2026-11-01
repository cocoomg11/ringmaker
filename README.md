# Ringmaker

Use your own ring image with [Foundry VTT](https://foundryvtt.com)'s dynamic token rings.

Pick one ring image and Ringmaker registers it as a dynamic ring style, so Foundry draws it itself rather than as an overlay. With it you can:

- ring all your NPCs at once (or every token), including new tokens as you place them;
- set the ring's size and the colour behind the art;
- let a token's art break out of the frame;
- frame each token's art inside the ring (zoom and focus);
- script it all through a GM-only API.

Token art and actor portraits are never changed, and **Remove Ringmaker's ring** puts back exactly what each token had before.

<!-- screenshot: a scene with several NPC tokens wearing the custom ring -->

## Requirements

- Foundry VTT v13 or v14 (verified on v14).
- Works with any game system.
- No other modules needed.

## Install

In Foundry: **Add-on Modules › Install Module**, paste this manifest URL and click Install, then enable **Ringmaker** in your world:

```
https://github.com/cocoomg11/ringmaker/releases/latest/download/module.json
```

## Contents

- [Quick start](#quick-start)
- [How to use](#making-a-ring-image): [Making a ring image](#making-a-ring-image) · [Framing token art](#framing-token-art) · [Works with Foundry's ring options](#works-with-foundrys-ring-options)
- [Settings](#settings)
- [Troubleshooting](#troubleshooting)
- [Removing its data](#removing-its-data)
- [The Wanderer's family](#the-wanderers-family)
- [For developers](#for-developers)
- [License](#license)

## Quick start

1. **Enable it.** In your world, open **Game Settings › Manage Modules**, tick **Ringmaker** and save.
2. **Pick your ring image.** Go to **Game Settings › Configure Settings › Ringmaker** and choose a **Ring image**: a square PNG with a transparent middle (see [Making a ring image](#making-a-ring-image)). Foundry reloads. Until you pick one, Ringmaker does nothing.
3. **Choose which tokens.** **Which tokens** starts on *NPCs only*. Switch it to *Every token* if you want player characters ringed too. Leave **Ring new tokens** on so tokens you place from now on get the ring.
4. **Check the look.** Click **Open Ringmaker** on the same page. Move **Ring size**, pick a **Background colour**, and watch the preview. Click **Save and reload** when you like it.
5. **Ring what's already there.** In the same window, click **Apply ring to existing tokens** and confirm. (Changed your mind later? **Remove Ringmaker's ring** puts everything back.)
6. **Try it.** Drag an NPC onto a scene: it arrives with your ring. For a token whose art sits badly in the ring, open its Token Configuration, go to **Appearance › Dynamic Token Ring** and use the **Art framing** row (Zoom, Focus, **Fit**).

<!-- screenshot: Game Settings page for Ringmaker with the Ring image picker and the Open Ringmaker button -->

## Making a ring image

Ringmaker needs one picture: the ring itself, with a see-through middle. The token art shows through the hole.

### Requirements

| | What to use | Why |
| --- | --- | --- |
| **Format** | PNG or WebP **with transparency** (alpha) | Ringmaker finds the ring from the image's transparency. A JPG has no transparency, so the whole square (corners and middle) covers the token. |
| **Shape** | Square, ring centred | Other shapes work (the image is scaled to fit and centred, e.g. 600 × 512), but the ring's centre must be the image's centre. |
| **Size** | 512 × 512 recommended; 256 × 256 or larger | Every image is redrawn into a 512 × 512 frame. Bigger (up to 2048) works but adds no detail; 128 works but looks soft on big tokens. |
| **Middle** | Fully transparent | A filled-in centre (even dark grey) means no ring is found: the image is drawn over the art and hides it. |
| **Band** | Any width, solid (at least half opaque) | The band is the area that is at least half opaque, measured from the centre outwards. Thin and thick bands both work. |
| **Margin** | Any; a small margin is fine | The band's outer edge is scaled to where Foundry's own ring edge is, so the empty margin around it doesn't matter. |
| **Decorations** | Spikes, gems, studs: fine | Thin points (spikes) are less than half opaque on average around the circle, so they don't count as the band and simply stick out past it. Keep them inside the image; anything past the frame edge is cut off, more so with **Ring size** above 100 %. |
| **Shadows** | Soft drop shadows are fine | Pixels less than half opaque are ignored when measuring. |
| **Colours** | Any; the image keeps its own colours | It's only tinted while a ring colour or ring effect is active (see below). |

How it measures: Ringmaker averages the transparency in circles from the centre out. The **outer edge** is the last circle that is at least half opaque; the **inner edge** (the hole) is where that solid band starts going inwards. The image is then scaled so the outer edge sits where Foundry's own ring edge is (× **Ring size**), and a **background disc** is drawn under the art out to the middle of the band. With **Ring in front of token art** on, the art is trimmed to that disc, so the art's edge is hidden under the ring.

### Step by step

1. **Make the image.** Any image editor: a 512 × 512 transparent canvas, the ring centred and touching (or nearly touching) the edges, the middle erased to fully transparent. Export as PNG.
2. **Upload it** to your Foundry data (for example with the file picker's upload button) into any folder you like.
3. **Set it.** *Game Settings › Configure Settings › Ringmaker › Ring image*, pick the file, save. Foundry reloads.
4. **Check it.** *Open Ringmaker* shows the ring over a sample picture. If it says **Couldn't load it: no ring band found**, the image has no transparent middle (see Troubleshooting). Look at a few placed tokens too: a cut-out creature and a full square portrait.
5. **Tune it** in *Open Ringmaker* (preview first, then **Save and reload**):
   - **Ring size**: the whole ring (and the art inside) bigger or smaller than Foundry's rings, 50–125 %.
   - **Ring in front of token art**: on trims the art to the ring's opening (tidy for square portraits); off is Foundry's order, so cut-out art can reach over the ring.
   - **Background colour**: what shows behind cut-out art inside the ring.

## Framing token art

Most token art is framed for a square, so inside a round ring a face can be off-centre or too small. Each token can have its own framing (token configuration › Appearance › Dynamic Token Ring › **Art framing**, GM only). The token on the canvas updates as you type; the image file is never changed.

| Field | What it does | Range |
| --- | --- | --- |
| **Zoom** | 1 is Foundry's framing. Above 1 zooms in (crops the background), below 1 shows more of the picture. | 0.5–3 |
| **Focus X / Y** | The point of the picture drawn at the ring's centre, from the top left (0, 0) to the bottom right (1, 1). 0.5 / 0.5 is the middle. | 0–1 |
| **Fit** | Measures the transparent edge of cut-out art and sets the zoom so the figure just fills the ring's opening. Does nothing useful on a full square picture (it has no transparent edge). | |

Examples:

- **A head-and-shoulders portrait** with the face in the upper middle: Zoom 1.2, Focus 0.5 / 0.4.
- **A face on the left of the picture**: Zoom 1.3, Focus 0.35 / 0.4.
- **A big creature whose head is in one corner** (say top right): Zoom 2–2.5, Focus on the head, e.g. 0.7 / 0.3.
- **A small cut-out figure with lots of empty space around it**: press **Fit**.

A good target: the face about 40–50 % of the ring's opening wide, eyes a little above the centre, shoulders or the creature's neck filling the rest. Zoom 1 and focus 0.5 / 0.5 store nothing. For several tokens at once use the API (`setArtFraming`, `fitArt`).

## Works with Foundry's ring options

Tested on Foundry v14 with Ringmaker's ring in front of the art (the default).

| Foundry option (token configuration or world setting) | With Ringmaker |
| --- | --- |
| **Ring colour** (tint) | Works. The band is tinted with the colour × the image's red channel, so on a dark or blue-ish ring the tint is darker. Only the part of the band outside 60 % of the frame's radius is tinted (see Troubleshooting). White means "no tint". |
| **Background colour** | Works: replaces Ringmaker's background colour for that token. White (`#ffffff`) counts as "not set", so it shows the world background colour instead. |
| **Subject texture** (a separate image for the ring) | Works: Foundry draws the subject texture instead of the token image, and Zoom / Focus apply to it. **Fit** measures the token image, not the subject texture. |
| **Subject scale** | Works, and combines with Zoom (they multiply). A scale you set yourself is kept by Apply and Remove. |
| **Effects: Pulse, Gradient** | Work: the ring image itself pulses or sweeps. |
| **Effects: Background wave** | Works on the background disc. |
| **Effects: Invisibility** | Works (Foundry's own invisibility tint). |
| **World setting "Dynamic token ring" style** | Overridden while a ring image is set: every ringed token, player characters included, shows Ringmaker's ring. Foundry's styles can't be used at the same time; clear the ring image to go back to them. |
| **Token sizes 1×1 to 4×4** | Work; the ring scales with the token. |
| **Non-square tokens (e.g. 2×1)** | The ring stays round and is sized to the smaller side, as Foundry's own rings. |
| **Fit modes (cover, fill, …), Scale X/Y, mirroring** | Work as with Foundry's rings: the ring grows with the scale, mirroring flips the art only. |

## Settings

All in **Game Settings › Configure Settings › Ringmaker** (world settings, GM only):

| Setting | Default | What it does |
| --- | --- | --- |
| Ring image | empty | The image (file picker). Changing it reloads Foundry. |
| Which tokens | NPCs only | *NPCs only* or *Every token*. An NPC is an actor whose type isn't `character` and that no player owns, so this works the same in any system. |
| Ring new tokens | on | Tokens placed from now on get the ring as they're created. |
| Ring size | 100 % | The ring's size compared with Foundry's own rings (50–125 %). The background and token art follow. Reloads Foundry. |
| Background colour | `#2b2420` | The colour behind the token art inside the ring. A token's own ring background colour (Token configuration › Appearance) is used instead when it has one. Reloads Foundry. |
| Ring in front of token art | on | Draws the ring over the token art and trims the art to the ring's opening. Off: Foundry's own order (art over the ring, so cut-out art can reach past it). Reloads Foundry. |
| Token art size inside the ring | 1 | Foundry's ring subject scale on the tokens Ringmaker rings. 1 keeps the ring at its normal size; below 1 the ring grows around the art, above 1 it shrinks. A scale you set on a token yourself is kept. |
| Per-token art zoom | on | Lets each token have its own art framing (zoom and focus point, see below). Off ignores stored framings. Reloads Foundry. |
| Ring effect on targeted tokens | Off | *Off*, *Pulse*, *Gradient* or *Flash once*. See below. Reloads Foundry. |
| Debug logging | off | Writes what Ringmaker is doing to the browser console. Errors are always logged. Wanderer's Satchel can switch it with your other modules. |
| Ring existing tokens on load | off | Each time the world loads, the active GM rings any matching token that doesn't have the ring yet. |

### Art that breaks out of the ring

<!-- screenshot: a pop-out token (art reaching past the ring) next to a normal one -->

For cut-out token art (say a dragon whose head and wings reach past a round frame), tick **Art breaks out of ring** in the token's configuration (Appearance › Dynamic Token Ring; GM only, placed or prototype tokens). Art outside the ring's opening is then drawn over the ring instead of trimmed, so the parts that reach past it show in front of the ring; art inside the opening stays under the ring as usual. Give the art a transparent background and keep its own disc inside the ring's opening (about two thirds of the image's width, centred). Other tokens aren't affected. It needs **Ring in front of token art**; with that off, every token's art is already drawn over the ring. The choice is kept in `flags.ringmaker.popOut`.

### Art framing: zoom and focus per token

<!-- screenshot: the Art framing row in the Token Configuration (Zoom, Focus X / Y, Fit) -->

See [Framing token art](#framing-token-art) for the fields and examples. The token on the canvas follows each change before you save, and the image itself is never changed. Stored as `flags.ringmaker.artZoom` and `flags.ringmaker.artFocus`; zoom 1 and focus 0.5 / 0.5 clear them, and **Remove Ringmaker's ring** deletes them. The world setting **Per-token art zoom** turns the feature off (stored values are then ignored).

### Ring effect on targeted tokens

With **Ring effect on targeted tokens** set, a token with Ringmaker's ring gets one of Foundry's own ring effects while it is targeted: **Pulse** or **Gradient** (Foundry's ring pulse and gradient effects) for as long as anyone targets it, or **Flash once** (Foundry's ring flash, in the targeting player's colour) at the moment it's targeted. Each client draws it for itself and nothing is saved to the world. Tokens without the ring are ignored. Off by default; while it's off Ringmaker doesn't listen for targeting at all.

### The Ringmaker window

**Open Ringmaker** (same page as the settings) shows what's set, a live preview and three buttons. It follows Foundry's light and dark themes (see [The Wanderer's family](#the-wanderers-family)) and reopens where you last left it.

- **Page head**: a badge with the overall state (Ring ready, No ring image, Image didn't load, Reload needed) and which tokens Ringmaker targets.
- **Ring image**: the image path, where the ring band was found, and the current ring size, art size, background colour and drawing order.

<!-- screenshot: the Open Ringmaker window with the live preview -->

- **Ring look (preview)**: a sample token picture with your ring image over it. Move **Ring size**, pick a **Background colour** or tick **Ring in front of token art** and the preview follows at once, before anything is saved. **Save and reload** stores those three settings and asks to reload Foundry. The preview uses the same layout maths as the ring itself, so the ring, background and art sizes match; it doesn't show a token's own background colour, ring effects or the soft edges Foundry's shader draws.
- **Apply ring to existing tokens**: asks first, then turns the ring on for the prototype tokens of matching actors and every matching token on every scene.
- **Remove Ringmaker's ring**: asks first (with a count), then puts every token and prototype token Ringmaker changed back the way it was and deletes all of Ringmaker's flags on them (recorded values and the pop-out choice). Tokens whose ring you turned on yourself keep their ring.
- **Debug logging**: the same world setting as in the module settings (GM only).
- **Reset window position**: forgets where the window was left, so it opens at Foundry's default spot next time.

### One ring image per world

A different ring image per actor isn't available: Foundry's dynamic rings draw every token from one ring texture per world, so Ringmaker can't give one actor its own image without changing undocumented parts of Foundry's ring code.

Upgrading from 1.0.0: tokens still at the 0.85 art size Ringmaker set then move to the current setting the next time **Apply** runs (or at load with *Ring existing tokens on load*).

### How it fits Foundry's ring

Foundry's ring frames are squares where the token art fills the middle two thirds (radius 0.667 of the frame's half-width) and the ring band reaches out to about 0.794; a matching `-bkg` frame is the disc behind the art. Ringmaker builds the same layout from your image: a ring frame scaled to that outer edge and a background disc reaching to the middle of your band. With *Ring in front of token art*, it uses a copy of Foundry's ring shader with the ring and art order swapped; if Foundry's shader isn't the one it expects, it uses Foundry's own and logs a warning.

Only the active GM makes these changes, so nothing happens twice when several GMs are connected. What each token had before is kept in `flags.ringmaker`.

## Troubleshooting

| What you see | Cause | Fix |
| --- | --- | --- |
| The ring covers the whole token (a filled disc or square) and *Open Ringmaker* says **no ring band found** | The image has no transparent middle (a filled centre, or a JPG) | Erase the middle to full transparency and save as PNG or WebP. |
| A white or coloured square around the ring | The image's corners aren't transparent (JPG, or a background layer left on) | Delete the background layer; export PNG with transparency. |
| The ring is much smaller or bigger than Foundry's rings | A faint ring (less than half opaque) or a solid shape far outside it is being measured as the band | Make the band solid; keep outer decorations thin (spikes) or partly transparent; adjust **Ring size**. |
| Gems or spikes are cut off at the edge | They reach past the image frame, or **Ring size** is above 100 % | Leave a little margin in the image, or lower **Ring size**. |
| A ring colour or the pulse only tints the outer part of a very thick band | Foundry tints only a fixed colour band (60–100 % of the frame's radius) | Use a thinner band, or accept the untinted inner part. |
| Lots of background shows around the art inside a thin ring | A thin band leaves a large opening, and Foundry sizes the art for its own ring | Raise **Zoom** on those tokens (or **Ring size**). |
| A token shows Foundry's steel or bronze ring instead | No ring image is set, or it failed to load | Set the image; check *Open Ringmaker* for an error. |
| Art reaches over the ring | **Art breaks out of ring** is ticked on that token, or **Ring in front of token art** is off | Untick it, or turn the setting on. |
| I changed the image and nothing happened | Changing the ring image reloads Foundry; other players see it after their next reload | Ask players to reload (F5). |

**One ring style per world.** Foundry's dynamic rings use a single ring style for the whole world, so every token with its ring turned on, including ones you turned on yourself, shows Ringmaker's ring while an image is set. No image is included; while none is chosen, Ringmaker registers nothing and Foundry's own ring is left alone.

## Removing its data

Use **Remove Ringmaker's ring** in the Ringmaker window: it puts back what each token had and deletes Ringmaker's flags on them. Settings and the window position stay (see the list below).

Ringmaker writes only under its own name, and only when you apply the ring or tick pop-out:

- `flags.ringmaker.prior` on tokens and actor prototype tokens: what the token's ring had before (`{ enabled, scale, applied }`), written for every token Apply goes over (from 1.4 also for tokens whose ring was already on). **Remove Ringmaker's ring** restores it and deletes this flag.
- `flags.ringmaker.artZoom` (number) and `flags.ringmaker.artFocus` (`{ x, y }`) on tokens and prototype tokens: the art framing (from 1.4). **Remove Ringmaker's ring** deletes them; zoom 1 or focus 0.5 / 0.5 in the token configuration clears them too.
- `flags.ringmaker.popOut` (boolean) on tokens and prototype tokens: the pop-out checkbox. **Remove Ringmaker's ring** deletes it (from 1.3); you can also untick the box or run `await rm.setPopOut(tokens, false)`. It does nothing while no ring image is set.
- Remove deletes the whole `flags.ringmaker` namespace on each token and prototype token it touches, so nothing of Ringmaker's is left on them.
- World settings under `ringmaker` (image, which tokens, ring new tokens, ring size, background colour, ring in front, art size, per-token art zoom, ring effect on targeted tokens, debug logging, ring existing on load). **Remove Ringmaker's ring** does not reset these; they go with the module's data.
- The target effect writes nothing: it is drawn on each client only.
- A hidden client setting `ringmaker.windowPlacement` (from 1.6): where the Ringmaker window was left, per user and browser. **Reset window position** in the window clears it; **Remove Ringmaker's ring** leaves it alone (it isn't token data).
- Ringmaker also sets Foundry's own `ring.enabled` and `ring.subject.scale` on tokens it rings; Remove puts them back.

## The Wanderer's family

Five free modules that work on their own and fit together. Each one switches on only what you use.

| Module | What it does |
|---|---|
| [Wanderer's Toolkit](https://github.com/cocoomg11/wayfarers-toolkit) | GM kit for D&D 5e: quest log, travel and flights, inns, loot rolls, boss frames, a three-coin economy. |
| [Red Book](https://github.com/cocoomg11/red-book) | Session prep: a live session log, next-session board, scene readiness check, Session Start. |
| [Wanderer's Satchel](https://github.com/cocoomg11/wanderers-satchel) | Optional hub: one window for the family, update check, combined health check, settings backup. |
| [Ringmaker](https://github.com/cocoomg11/ringmaker) | Your own ring image for Foundry's dynamic token rings. Any game system. |
| [Loot Ledger](https://github.com/cocoomg11/loot-ledger) | Priced, rollable loot pools and roll tables for D&D 5e, built from a classic-MMO item compendium. |

They share one look that follows Foundry's light and dark themes. None of them needs the others.

## For developers

### Public API and hooks

```js
const rm = game.modules.get("ringmaker").api;
rm.plan();                       // GM: { actors, tokens } still to ring, without changing anything
await rm.applyAll({ npcOnly });  // active GM: ring existing tokens
await rm.remove();               // active GM: undo Ringmaker's changes
rm.status();                     // { image, mode, scale, size, background, front, targetEffect, shader, band, registered, active, error }
await rm.setPopOut(tokens, true); // GM: let these tokens' art break out of the ring (false turns it off)
rm.removePlan();                 // { actors, tokens } that Remove would change, without changing anything
await rm.remove({ confirm: true }); // same as remove(), but asks first with counts
await rm.setArtFraming(tokens, { zoom: 1.3, focus: { x: 0.55, y: 0.6 } }); // GM: art zoom and focus (either part may be left out)
await rm.setArtZoom(tokens, 1.3); // GM: zoom only (1 clears it)
await rm.fitArt(tokens);          // GM: measure each image and set the zoom that fills the opening
rm.open();                        // GM: open the Ringmaker tools window (for launchers such as Wanderer's Satchel)
```

| Member | Stability | Notes |
| --- | --- | --- |
| `plan({ npcOnly })` | stable | |
| `applyAll({ npcOnly })` | stable | active GM only |
| `remove()` | stable | active GM only; from 1.3 also deletes every Ringmaker flag |
| `status()` | stable | `targetEffect` added in 1.3 |
| `setPopOut(tokens, on)` | experimental | new in 1.2; GM only |
| `removePlan()` | experimental | new in 1.3 |
| `setArtFraming(tokens, { zoom, focus })` | experimental | new in 1.4; GM only |
| `setArtZoom(tokens, zoom)` | experimental | new in 1.4; GM only |
| `fitArt(tokens)` | experimental | new in 1.4; GM only |
| `open()` | experimental | new in 1.6.2; GM only; opens the Ringmaker tools window |

Every member is GM only: as a player, each call shows a "GM only" notice and returns `undefined`. (From 1.4.2; before, `plan()` and `status()` worked for players.)

`tokens` is one or a list of placed tokens, token documents, prototype tokens, actors (their prototype token) or token ids on the viewed scene. `remove({ confirm })` is new in 1.4. Ringmaker fires no hooks of its own and listens only to Foundry's.

## About

Made for my own table and shared in case it's useful to yours. Issues and suggestions are welcome at <https://github.com/cocoomg11/ringmaker/issues>.

## License

MIT. See [LICENSE](LICENSE).
