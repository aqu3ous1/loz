# Design notes

Why the code is shaped the way it is. Read `README.md` first for what the game
is; this is the reasoning behind the parts that are easy to get wrong.

## Everything is generated

There are no asset files. Textures, meshes, the bitmap font, HUD icons,
animation clips, sound effects and music are all produced at boot from code.

This is not a stunt — it is what makes the art consistent. A hand-drawn 64×64
tile and a procedural one look equally low-resolution, but procedural tiles
share their noise basis, their palette construction and their posterization
step, so a hundred surfaces made by six routines automatically belong to the
same world. It also means a colour change is one hex literal, not a repaint.

The cost is that texture synthesis runs on the main thread at startup. Boot is
staged (`Assets.step`) so the loading bar advances and the tab never appears
hung.

## The renderer emulates constraints, not effects

A "retro filter" applied over a modern pipeline gets the resolution right and
everything else wrong. The renderer instead reproduces the constraints that
*caused* the look:

- **320×240 framebuffer, `DEPTH_COMPONENT16`.** Not a post-process downscale:
  the scene, the HUD and the text all render at that resolution and the whole
  frame is blitted up with nearest-neighbour. That is why the HUD has the same
  pixel size as the world, which is the single strongest tell.
- **Three-point filtering.** The RDP sampled three texels of a triangle, not
  four of a quad. `tex3Point()` in the fragment shader picks the half of the
  texel quad the sample falls in and interpolates across it. Bilinear filtering
  looks subtly, uncannily modern on the same textures.
- **RGBA5551 with a 4×4 Bayer dither.** Five bits per channel is where the era's
  banding and its speckled gradients come from. The dither is computed from
  `gl_FragCoord` with no array lookups so it works on the oldest GLSL.
- **Vertex lighting only.** Two directional lights plus ambient, computed per
  vertex in the vertex shader, no specular term. Ground meshes additionally bake
  a shade into vertex colours at build time, as cartridges did.
- **Linear per-vertex fog**, because that is what the hardware had, and because
  short draw distances are the reason those worlds feel enclosed.

The composite-video pass (scanlines, bleed, curvature, vignette) is the one
concession to taste rather than accuracy, and every part of it is adjustable to
zero in the options menu.

## Rigid-limb skeletons

Characters are a bone hierarchy where each bone owns **one small mesh and one
matrix**. There is no vertex skinning. This is how N64 characters actually
worked, and it dictates the art: joints have to be built as overlapping
volumes — a sphere at the shoulder, a bulge at the elbow — because nothing
bends. Building the limbs correctly is what makes the animation read.

`Animator.update()` samples the clip into a flat pose array; `computeMatrices()`
walks the hierarchy once. Bone world matrices are exposed by name
(`boneMatrix('itemR')`) so a sword mesh can be submitted with the hand's matrix
rather than parented into the rig.

**One frame per actor.** `World.update()` advances each non-culled actor's
animator after that actor has picked its clip for the frame. Nothing else ticks
it; if that call is removed, every rig silently freezes in its bind pose and
only positions and yaw still change — a failure that is easy to mistake for an
art problem.

## Round primitives, never boxes

`MeshBuilder` has `box()` and `taper()`, and character code must not use them.
A tapered box is four-sided; at any angle other than face-on it reads as a
plank. The primitives that matter are:

- `tube(rings, sides, opts)` — a swept ring set along x, y or z, with per-ring
  radii (`r`, or `rx`/`rz` for an ellipse). Limbs, necks, horns, roots, fingers,
  crowns, gravestones, cliffs and cactus arms are all this one call.
- `limb(...)` — the straight tapered case of `tube`, with an optional bulge.
- `ovoid(...)` — heads, hands, boulder shoulders, foliage clusters.
- `ribbon(pts, side, opts)` — a flat swept strip with both faces emitted.
  `tube` can only ring around a fixed axis, so anything that fans outward from
  a centre (petals, fins, leaves, membranes) has to be a ribbon or it comes out
  as a horizontal plate.

**Place surface details at the radius the body actually has there.** The
recurring bug in this codebase has been putting an eye, a face or a lava core at
a flat `z` offset and having the torso swallow it. Where a body is a swept
profile, compute its radius at that height first (see `chestR()` in
`bosses.js`).

## Faces

A character's face is a 64×64 tile with a plain-skin swatch in one corner. The
skull is an `ovoid` whose UV function samples only that swatch, so the head is
one material and one draw call. The face is then pressed on as a **polar disc**:
a fan of rings centred on the front of the skull, radius just under the head's,
with UVs mapped from local x/y. A square patch would show its own edge; a disc's
outline follows the head and there is no seam.

## Terrain

A heightfield with a per-quad material chosen by majority vote of its corners.
Two details do most of the work:

- **Triplanar UVs on steep quads.** Where `|n.y| < 0.62` the texture projects
  onto a vertical plane instead of from above, or cliffs smear into vertical
  streaks.
- **Material splatting.** One material per quad makes every path edge a
  staircase along the grid. Boundary quads are drawn a second time per minority
  material with per-vertex alpha — 1 at that material's own corners, 0
  elsewhere — feathering the join across the triangle. The splat pass reuses the
  base pass's untinted vertex shades; tinting them toward the minority
  material's tone as well applies the shift twice and fringes dirt edges orange.
- **Baked aerial perspective.** Valley rims are only thirty or forty units out,
  so distance fog barely touches them. High ground is washed toward the fog
  colour at bake time, which is what turns the same geometry from a grey wall
  into mountains. Steep ground also gets a raised ambient floor: a valley seen
  from a low camera is mostly slope, and slope at full shadow reads as a wall.

Fog colour must match the bottom of the sky texture, or the horizon shows as a
band where the two disagree.

## Progression

Dungeons are gated by `K.medallionCount` — how many you hold — rather than by a
fixed chain. At any point there is usually more than one dungeon you could
enter and more than one direction worth walking. The story beats that must
happen in order (the prologue, Hanman, the news of Link's death, the final
fortress) are driven by inventory flags in `quest.js` and staged by `script.js`,
so the world can stay open around them.

## Testing without a keyboard

Everything under `tools/` drives the real game in headless Chromium with
software GL. These are not unit tests; they load the actual page, click through
the boot flow, and then either screenshot or assert on live game state. They
have caught, among others: rotated wall colliders the player could walk through,
a load-order bug that crashed the moment a weapon was equipped, an inverted
skybox gradient, and the animator never being ticked at all.

Screenshot review is the point. Most of the art problems in this project were
invisible in code and obvious in a 960×720 capture.
