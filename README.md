# Ringmaker

Use your own ring image with [Foundry VTT](https://foundryvtt.com)'s dynamic token rings.

Pick one ring image and Ringmaker registers it as a dynamic ring style, so it's drawn by Foundry itself rather than as an overlay. The ring is turned on for NPC tokens (or every token) as they're placed, and for tokens already in the world with one button. Token art and actor portraits are never changed, and **Remove Ringmaker's ring** puts back exactly what each token had before.

Works with any game system.

## Install

In Foundry: **Add-on Modules › Install Module**, paste this manifest URL and click Install:

```
https://github.com/cocoomg11/ringmaker/releases/latest/download/module.json
```

Then enable **Ringmaker** in your world.

## Compatibility

- Foundry VTT v13 and v14 (verified on v14).
- Any game system.

## The ring image

- A **square PNG with a transparent middle**: the token art shows through the hole.
- **256 × 256 or larger** (512 × 512 is ideal). Other sizes are scaled to fit; non-square images are centred.
- **Any band width and margin.** Ringmaker finds the ring band from the image's transparency (pixels at least half opaque; a soft drop shadow is ignored) and scales the image so the band's outer edge lands where Foundry's own ring edge is. Ringed tokens are then the same size as with Foundry's rings; **Ring size** fine-tunes it.
- **A background** is drawn behind the token art, filling the ring's opening (see **Background colour**).
- The image keeps its own colours: Ringmaker turns Foundry's tinted colour band off.
- No image is included; bring your own. While no image is chosen, Ringmaker registers nothing and Foundry's own ring is left alone.

**One ring style per world.** Foundry's dynamic rings use a single ring style for the whole world, so every token with its ring turned on, including ones you turned on yourself, shows Ringmaker's ring while an image is set.

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
| Ring existing tokens on load | off | Each time the world loads, the active GM rings any matching token that doesn't have the ring yet. |

### Art that breaks out of the ring

For cut-out token art (say a dragon whose head and wings reach past a round frame), tick **Let art break out of the ring** in the token's configuration (Appearance › Dynamic Token Ring; GM only, placed or prototype tokens). Art outside the ring's opening is then drawn over the ring instead of trimmed, so the parts that reach past it show in front of the ring; art inside the opening stays under the ring as usual. Give the art a transparent background and keep its own disc inside the ring's opening (about two thirds of the image's width, centred). Other tokens aren't affected. It needs **Ring in front of token art**; with that off, every token's art is already drawn over the ring. The choice is kept in `flags.ringmaker.popOut`.

**Open Ringmaker** (same page) shows what's set and has two buttons:

- **Apply ring to existing tokens**: asks first, then turns the ring on for the prototype tokens of matching actors and every matching token on every scene.
- **Remove Ringmaker's ring**: puts every token and prototype token Ringmaker changed back the way it was. Tokens whose ring you turned on yourself aren't touched.

Upgrading from 1.0.0: tokens still at the 0.85 art size Ringmaker set then move to the current setting the next time **Apply** runs (or at load with *Ring existing tokens on load*).

### How it fits Foundry's ring

Foundry's ring frames are squares where the token art fills the middle two thirds (radius 0.667 of the frame's half-width) and the ring band reaches out to about 0.794; a matching `-bkg` frame is the disc behind the art. Ringmaker builds the same layout from your image: a ring frame scaled to that outer edge and a background disc reaching to the middle of your band. With *Ring in front of token art*, it uses a copy of Foundry's ring shader with the ring and art order swapped; if Foundry's shader isn't the one it expects, it uses Foundry's own and logs a warning.

Only the active GM makes these changes, so nothing happens twice when several GMs are connected. What each token had before is kept in `flags.ringmaker`.

## API

```js
const rm = game.modules.get("ringmaker").api;
rm.plan();                       // { actors, tokens } still to ring, without changing anything
await rm.applyAll({ npcOnly });  // active GM: ring existing tokens
await rm.remove();               // active GM: undo Ringmaker's changes
rm.status();                     // { image, mode, scale, size, background, front, shader, band, registered, active, error }
await rm.setPopOut(tokens, true); // GM: let these tokens' art break out of the ring (false turns it off)
```

## About

Made for my own table and shared in case it's useful to yours. Issues and suggestions are welcome at <https://github.com/cocoomg11/ringmaker/issues>.

## Licence

MIT. See [LICENSE](LICENSE).
