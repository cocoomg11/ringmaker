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
| Token art size inside the ring | 0.85 | Foundry's ring subject scale on the tokens Ringmaker rings. A scale you set on a token yourself is kept. |
| Ring existing tokens on load | off | Each time the world loads, the active GM rings any matching token that doesn't have the ring yet. |

**Open Ringmaker** (same page) shows what's set and has two buttons:

- **Apply ring to existing tokens**: asks first, then turns the ring on for the prototype tokens of matching actors and every matching token on every scene.
- **Remove Ringmaker's ring**: puts every token and prototype token Ringmaker changed back the way it was. Tokens whose ring you turned on yourself aren't touched.

Only the active GM makes these changes, so nothing happens twice when several GMs are connected. What each token had before is kept in `flags.ringmaker`.

## API

```js
const rm = game.modules.get("ringmaker").api;
rm.plan();                       // { actors, tokens } still to ring, without changing anything
await rm.applyAll({ npcOnly });  // active GM: ring existing tokens
await rm.remove();               // active GM: undo Ringmaker's changes
rm.status();                     // { image, mode, scale, registered, active, error }
```

## About

Made for my own table and shared in case it's useful to yours. Issues and suggestions are welcome at <https://github.com/cocoomg11/ringmaker/issues>.

## Licence

MIT. See [LICENSE](LICENSE).
