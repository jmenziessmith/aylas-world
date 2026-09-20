# Ayla's Cafe artwork inventory

The playable prototype uses the source sheets in `assets/cafe`. Run
`tools/slice-cafe-sprites.ps1` from the repository root to recreate all cropped
files under `public/assets/cafe`. The script verifies that each background is
2172 x 724, checks for long green guide lines around every mapped crop, rejects
overlapping crop rectangles, crops inside the guides, preserves the transparent
canvas around each sprite, and removes residual neon-green guide components.

## Used artwork

- Counter, carry, and serving backgrounds are exact 2172 x 724 source images.
- Ayla has welcome, pointing, empty-tray, spill, cheer, and thumbs-up poses. A
  loaded walking pose was extracted for reference but is not used in play
  because its fixed food would contradict the live order.
- Bunny, elephant, and purple monster each have a waiting and happy/eating pose
  without a table baked into the image.
- Twelve food objects are independent sprites: three cupcakes, three drinks,
  two cookies, three ice creams, and a spoon.
- The empty tray, left and right hands, phone instruction, table, serving
  targets, plate, napkin, vase, footprint, star, and heart are independent.

The current proof uses the chocolate-chip cookie, orange drink, and heart
cupcake, plus the waiting/happy states for bunny, elephant, and purple monster.
The remaining extracted variants are available through the typed manifest for
later rounds. `ayla-carry` deliberately maps to the empty-tray pose; the fixed
loaded walking image remains an extracted reference and is not loaded by play.

The five 1672 x 941 images without green guides are composition mockups. They
contain baked UI, text, trays, food, customers, and tables, so the game does not
use them. The customer sheet dated 11:20:51 also bakes every customer into a
table and is excluded. The 11:20:50 serving background (3) has a permanent
foreground table and is excluded in favour of the clean serving background.

## Artwork still needed

Produce these as transparent PNGs in the same soft 3D storybook style. Put one
sprite per non-overlapping 1 px solid green rectangle, with at least 24 px of
transparent padding between the painted sprite and its rectangle. Do not add
text, shadows from unseen scenery, UI, food, tables, or trays unless requested.

1. **Crocodile customer, waiting and happy.** Front-facing green child
   crocodile in a red backward cap and teal hoodie. Crop at mid-torso, include
   the chair back, and leave the entire lower edge clean so the separate table
   can cover it. Waiting pose has open eyes and hands together. Happy pose has
   closed smiling eyes and raised hands. Match the scale and camera angle of the
   bunny/elephant/purple customer bust sheet.
2. **Ayla walking with an empty tray.** Faithful pink Ayla design: brown eyes,
   dark curved horns, pointed ears, pink nose, small fangs, pink tuft, purple
   polka-dot headband, cream apron and colourful shoes. Three-quarter view,
   one foot raised in a clear walking pose. The tray must be empty; no food may
   overlap Ayla or the tray. This replaces the current proof sprite, which has a
   cupcake and orange drink permanently painted onto it.
3. **Empty and filled single footprint pair.** Two separate transparent sprites
   with identical bounds, 128 x 128 preferred. Use the existing rounded paw
   shape: empty is cream/grey, filled is warm yellow. No number or surrounding
   progress bar. Ten instances will be rendered by the game.
4. **Serving targets with matching bounds.** Five separate 192 x 192 sprites
   for cupcake, drink, cookie, spoon, and ice cream. Use a pale cream fill,
   coloured dashed edge, and a centred flat silhouette. The supplied target
   art is usable, but its differing widths make programmatic layout harder.
5. **Ayla serving pose without furniture.** Ayla leaning forward with both hands
   extended as if placing a plate. Do not include a table, plate, food, or tray.
   The supplied pose has a wooden table and cupcake permanently merged into it.

The source art includes no clean crocodile customer and no generic walking Ayla.
The prototype moves the empty-tray Ayla pose during the journey and may show a
solid placeholder for the crocodile. Green-bordered source sheets should remain
available as production inputs and should never be loaded directly by the game.
