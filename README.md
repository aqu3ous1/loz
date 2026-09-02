# The Legend of Zelda: Descendants

A complete, playable 3D action-adventure in the Nintendo 64 idiom, written in
plain JavaScript and WebGL. No engine, no build step, no asset files: every
texture, mesh, animation, sound and piece of music is generated in code when
the page loads.

Open `index.html` in a browser and press Enter.

---

## The story

Link is an old man now. He has been past his prime for sixty years, and he is
dying in a bed in Farrow Village with no strength left to hold the sword that
sealed the darkness three generations ago. You are his great-grandson. He calls
you in for one last message: something has slipped its confinement out in a
small desert town in Gerudo, his family are peaceful dwellers who could not hurt
a fly, and you are the only one of his descendants who inherited whatever it was
he had.

He leaves you a chest of old gear. It won't be much use as of now — take it to a
proper blacksmith, and don't let some conman rip you off.

In Hanman Town you watch a young man named **Genmo** take a sweet from a baby and
laugh about it. When the town guard tell him to hand it back, something in him
catches: an aura no one taught him, because no one ever told him whose blood he
carries. His great-grandmother died shortly after his grandfather was born, and
the name Ganon died with her. He strikes the officers down, lifts off the ground,
and meets your eyes for one second before he goes.

Word reaches you on the road that your great-grandfather is dead — and not of old
age. Something dark reached into that house from a long way off and he was too
feeble to turn it aside. The note he left says as much, in the careful way of a
man who did not want to frighten anyone.

Then the creatures that never troubled anyone start troubling everyone.

**Six bosses.** The second is Genmo himself, before he has mastered any of it —
he loses, and swears it back at you on the way out. Only at the sixth is he
whole.

---

## Playing

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Move | `W A S D` | Left stick |
| Camera | Arrow keys / mouse | Right stick |
| Attack | `J` or `X` | West face |
| Action, roll, jump | `Space` | South face |
| Shield | `E` | Right shoulder |
| Target lock | `Shift` | Trigger |
| Item slots | `1` `2` `3` | Face / shoulder |
| Ocarina | `4` | — |
| Swap weapon | `Tab` | — |
| Menu | `Enter` | Start |

The control model is the 1998 one, but the on-screen prompts name the key you
actually press, not a controller nobody has in their hands. `Space` is
context-sensitive and its verb changes with what you are standing near — the
prompt in the corner always tells you what it will do. Target lock holds the
camera on an enemy and switches you to strafing.

## What's in it

- **31 areas**: four settlements, seven overworld regions, six dungeons, seven
  grottos, four shops and the interiors.
- **6 dungeons**, each with a key item, a map of locked rooms and switches, and a
  boss: the **Emberhusk** in Ashvale Mine, **Genmo unmastered** in the Stonebell
  clock tower, **Thornheart** in Elderwood Grove, **Tidewrought** in Lake Nial,
  the **Hollow King** in the Sunken Hollow, and **Genmo, Heir of the Dark** in the
  fortress.
- **Semi-open progression.** Dungeons are soft-gated by how many medallions you
  hold rather than by a fixed chain, so there is usually more than one thing you
  could be doing, and the overworld is worth walking for its own sake: grottos,
  heart pieces, bombable walls, hookshot ledges and side quests.
- **Breath-of-the-Wild-style loadout.** Weapons and shields are picked up, carry
  durability, and are swapped from the menu; the heirloom blade is reforged
  rather than replaced.
- **Masks** that change how the world treats you, including one that makes you
  invisible to certain eyes and one that lets you pass as the dead.
- **Time travel, both kinds.** The *Hymn of Ages* rebuilds the area you are
  standing in sixty years earlier or later — in Elderwood the ground, the trees
  and the people who lived there all change with it, and what you do in one era
  is waiting for you in the other. The *Verse of Return* pulls the last few
  seconds back, a short rewind for a mistimed jump or a puzzle you just broke.

---

## The N64 part

This is not a filter over a modern renderer. The pipeline is rebuilt to have the
same constraints and therefore the same look:

- Everything renders into a **320×240 framebuffer with a 16-bit depth buffer**,
  then blits to the canvas with nearest-neighbour scaling — HUD included, so the
  whole frame is one low-resolution image the way a cartridge would output it.
- **RDP three-point texture filtering** in the fragment shader: the N64 sampled a
  triangle of three texels, not a bilinear quad, and the difference is visible on
  every wall.
- **RGBA5551 output with a 4×4 ordered Bayer dither**, which is where the
  characteristic speckled gradients come from.
- **Per-vertex Gouraud lighting**, two directional lights and an ambient term, no
  specular; **per-vertex linear fog**; optional sub-pixel vertex snapping.
- **Rigid-limb skeletal animation** — a bone hierarchy where each bone owns one
  small mesh and one matrix, exactly as characters were built then, rather than
  smooth skinning.
- A composite-video post pass: scanlines, colour bleed, curvature and vignette,
  all adjustable in the options menu (including off).

Textures are 32×32, drawn as banded pixel art on short palette ramps and
median-cut down so no tile exceeds a 4bpp palette — usually four or five
colours. That is the part people actually recognise: cartridge tiles held a
handful of colours painted as flat bands, because indexed art could not hold a
gradient, and a smooth noise field mapped onto a base colour turns to mush at
320×240 no matter how good the noise is. Characters are dressed by multiplying
one shared neutral value map by a per-object colour, the way the RDP did.
Faces are painted onto a small tile and pressed onto the skull as a polar disc,
which is how the era got expressions without geometry.

## Running it

No build. No dependencies. Open `index.html` from disk or serve the directory:

```sh
python3 -m http.server 8080     # then open http://127.0.0.1:8080/
```

## Development tools

The `tools/` directory drives the real game in headless Chromium (software GL)
so changes can be checked without a human at the keyboard. Start a server on
port 8080 first.

```sh
node tools/playtest.js    # boot, new game, prologue, first steps; screenshots
node tools/deepplay.js    # load all 31 areas; report draws, tris, fps, errors
node tools/tour.js        # gameplay screenshots at named stops (STOPS=...)
node tools/modelshot.js   # pose a character or boss against a fixed camera (RIGS=...)
node tools/combat.js      # drive real input: hits, damage, bombs, bosses, pickups
node tools/story.js       # walk the main story chain through its own triggers
node tools/tex.js         # render every texture at 4x with its colour count (TEX=...)
node tools/move.js        # assert every movement key against three camera angles
node tools/ui.js          # assert the message box and menu open once and close once
```

Screenshots land in `shots/`. `tools/load.js` evaluates the browser sources in
Node for testing pure data code.

## Layout

```
index.html          script order matters; classic scripts, one LZ namespace
src/core/           math, texture synthesis, input, audio synth, GL renderer
src/render/         shaders, bitmap font, HUD icons, sprite batcher
src/game/           actors, animation, collision, camera, player, enemies,
                    bosses, NPCs, items, inventory, dialogue, HUD, menu,
                    save, quest, cutscene script, world
src/game/areas/     the 31 areas, plus kit.js: the level-building vocabulary
src/main.js         game loop, state machine, area transitions
tools/              headless test and screenshot harnesses
```

Roughly 21,000 lines. Everything you see was drawn by the code that runs it.
