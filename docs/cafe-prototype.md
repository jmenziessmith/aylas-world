# Ayla’s Café mechanics prototype

Run `npm run dev` and open `http://localhost:5173/?game=cafe`, or choose
**Ayla’s Café** from the launcher. The café uses the existing Phaser/TypeScript
app, home navigation, landscape orientation prompt, and resize handling.

## Playing on desktop

1. Press **Let’s play**. Drag the cookie and orange juice onto the pink counter
   tray. When the order is correct, the game continues to carry setup.
   The cupcake is a distractor in the first order. Wrong or extra items bounce
   back; loaded items can be rearranged.
2. Press **Let’s go → Play with buttons → Ready**.
3. Use arrow keys or WASD to tilt. Tap Space ten times to walk. Holding a tilt
   for several seconds slides treats off the tray. Releasing the key levels it
   again, and friction slows the treats down.
4. Drag each surviving treat onto its matching picture on the table.
5. If anything spilled, **Fetch missing** brings only the missing treats for a
   second trip. Already served treats stay on the customer’s table.
6. **Another friend** advances through three starter orders, including two
   cookies plus a drink, and three customers.

Touch fallback also works: drag within the carrying tray to tilt and release to
level it; on desktop Space takes a step. There is no time limit. If every item
falls, Ayla returns to the counter so the order can be loaded again.
The sound button toggles speech and small synthesized sound effects.

## Playing with phone motion

Open the deployed app over HTTPS (or another secure browser context). A phone
opening the development computer’s plain HTTP LAN address can use touch
fallback, but motion permission will be unavailable there.

Choose **Use phone motion** using the visible button. On iOS the two permission
requests are started inside that tap, as in Jump Party. Once granted, the game
remembers that choice for later café rounds and visits on that device. Hold the device approximately flat, tap
**Ready**, and keep it still during the roughly one-second calibration. Walk
ten careful steps. When a tablet provides tilt but no walk events, Ayla starts
walking slowly after a brief wait; detected steps immediately take over. The
upper Ayla sprite moves with accepted steps and the main tray contains
independent sliding objects. Permission denial, missing sensors, and absent
readings lead to the button controls. The app pauses play in portrait and
displays the existing rotate-device prompt. Backgrounding the app pauses play
and requires calibration on return.

Approximate steps use acceleration peaks, a gravity filter when direct linear
acceleration is unavailable, a refractory period, cadence confidence, and a
rotation/violent-shake rejection window. This is a playful walking detector,
not a pedometer; gentle rhythmic hand motion can still resemble walking.

## Checks and tuning

- `npm test`: deterministic model, physics, sensor adapter, and round-flow
  checks. These do not replace browser drag-and-drop or real-device tests.
- `npm run typecheck`: strict application TypeScript check.
- `npm run build`: TypeScript check and Vite production build.
- `?game=cafe&debug=1` in development shows tilt, steps, and input mode.
  Production builds omit that diagnostic display.

Sensor and physics constants are in `src/games/cafe/tuning.ts`. Test the walk
thresholds and tilt direction on Safari iPhone, installed iOS PWA, Android
Chrome, and Fire HD 8 before treating this as production-ready. Test landscape
rotation in both directions, permission refusal, a ten-step walk, shaking,
background/resume, all/partial spills, and recovery. Browser interaction and
hardware validation are still outstanding; see `cafe-browser-test.md` for the
checks actually performed and the environment limitations.

## Prototype scope and artwork

This proves matching/counting, calibration, carrying, spills, recovery, and
serving. It intentionally starts with three food types and three customers.
Memory/category orders, saved rewards, and the larger food catalogue remain
future content. Physics uses lightweight circles, not liquid or tipping
simulation. Replacements are automatically fetched for the short recovery
trip; the child does not reload the original complete order.

Clean supplied sprites are extracted into `public/assets/cafe`. Unavailable
art keys render labelled solid blocks. Selection puts Ayla behind the counter,
with draggable food in wooden boxes, a cake stand, flowers, and an illustrated
order paper; it has no added chalkboard. Every scene background shares a pinned
left edge. Walking uses the supplied sideways walking pose and the ten-slot
progress strip with gold/green status icons. Phone motion permission is
remembered, and Ayla walks slowly when a tablet provides tilt but no walk
events. This small journey pose contains decorative painted food; the main
tray's live food remains independent. Serving uses a larger foreground table,
a tray to its left, and the order paper to its right, without the animated drag
hint.
Home and sound use the same image controls as Mermaid Magic. The serving
background is pinned to its left edge so the Ayla’s Café sign remains visible;
the oversized tray and food sit to the left of the large table. A completed
round advances automatically after ten seconds if the next-round button is not
pressed.
`cafe-artwork.md` contains the inventory and precise briefs for additional
artwork; `cafe-contact-sheet.png` previews all extracted sprites. The source
sheets and composition mockups are retained under `assets/cafe`.
