# Ayla's Cafe test evidence

Tested on 20 September 2026 against the local Vite app at
`http://localhost:5173/?game=cafe`.

## Automated checks

- `corepack pnpm build` — passed. TypeScript and the Vite production build
  completed successfully. Vite reported only its existing large-chunk warning.
- `corepack pnpm exec tsc -p tsconfig.cafe-tests.json --noEmit` — passed.
- `npm test` — 21/21 tests passed. Coverage includes exact order
  matching, wrong serving-target rejection, spill recovery, tray movement and
  edge spilling, body separation, orientation mapping, calibration, careful
  step filtering, a full ten-step carry, repeated-item and all-item recovery,
  neutral velocity damping, null-only sensor acceleration fallback, stale
  orientation recovery, matching orientation/gravity tilt units, and layout
  geometry at five landscape phone/tablet sizes.
- Asset manifest verification — declared cafe asset paths are checked against
  `public/assets/cafe`; shared home/sound artwork uses Mermaid's existing files.
- `GET /?game=cafe` — returned HTTP 200 from the local Vite server.

## Browser interaction status

The repository's in-app Browser skill was initialized and its required recovery
procedure was followed. Browser discovery returned no available browser backend
(`agent.browsers.list()` returned an empty list), so the skill prohibited a
standalone Playwright substitution. An attempt to launch the URL in an OS
browser was rejected by automatic approval review. No browser was launched, no
canvas interaction was run, and no screenshot was captured.

The following checks remain for a supported in-app browser session:

- Drag the requested cookie and juice from the counter onto the tray.
- Drop a cupcake distractor on the tray and verify that it returns to the
  counter without advancing the order.
- Reposition a loaded item, then complete the exact order.
- Choose **Play with buttons**, calibrate, alternate Space presses at least
  300 ms apart, and verify ten progress steps reach the serving phase.
- Hold each arrow/WASD direction and verify that tray items move in the matching
  direction; use sustained tilt to spill one item.
- In the serving phase, drop an item on the wrong picture and verify that it
  returns to the tray, then serve an item on its matching picture.
- After a spill, serve the remaining item, choose **Fetch missing**, carry the
  recovered item again, and finish the round.
- At Fire HD 8 landscape sizes (1280x800 and 960x600), verify that buttons,
  tray edges, drag sources, serving targets, and progress indicators remain
  visible and comfortably touchable.
- In portrait, verify that the existing rotate-device overlay replaces the game.
- Capture one counter, carry, and serving screenshot after the interaction
  checks pass.
