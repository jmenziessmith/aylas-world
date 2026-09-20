const ROOT = "/assets/cafe";

/** Central asset lookup for the cafe. Missing future art can be handled by the scene placeholder. */
export const CAFE_ASSETS = {
  "counter-bg": `${ROOT}/backgrounds/counter.png`,
  "carry-bg": `${ROOT}/backgrounds/carry.png`,
  "serve-bg": `${ROOT}/backgrounds/serve.png`,

  "ayla-welcome": `${ROOT}/characters/ayla-welcome.png`,
  "ayla-point": `${ROOT}/characters/ayla-point.png`,
  "ayla-empty-tray": `${ROOT}/characters/ayla-empty-tray.png`,
  "ayla-carry": `${ROOT}/characters/ayla-carry.png`,
  "ayla-spill": `${ROOT}/characters/ayla-spill.png`,
  "ayla-cheer": `${ROOT}/characters/ayla-cheer.png`,
  "ayla-thumbs-up": `${ROOT}/characters/ayla-thumbs-up.png`,

  "customer-bunny": `${ROOT}/customers/bunny-waiting.png`,
  "customer-bunny-happy": `${ROOT}/customers/bunny-happy.png`,
  "customer-elephant": `${ROOT}/customers/elephant-waiting.png`,
  "customer-elephant-happy": `${ROOT}/customers/elephant-happy.png`,
  "customer-monster": `${ROOT}/customers/purple-monster-waiting.png`,
  "customer-monster-happy": `${ROOT}/customers/purple-monster-happy.png`,

  tray: `${ROOT}/trays/carry-tray.png`,
  table: `${ROOT}/table/wooden-table.png`,
  "serving-plate": `${ROOT}/table/serving-plate.png`,
  napkin: `${ROOT}/table/napkin.png`,
  "flower-vase": `${ROOT}/table/flower-vase.png`,
  "hand-left": `${ROOT}/hands/left.png`,
  "hand-right": `${ROOT}/hands/right.png`,
  instruction: `${ROOT}/ui/hold-phone-flat.png`,
  footprint: `${ROOT}/ui/footprint.png`,
  "step-progress-empty": `${ROOT}/ui/step-progress-empty.png`,
  "success-star": `${ROOT}/ui/success-star.png`,
  "celebration-heart": `${ROOT}/ui/celebration-heart.png`,
  "speech-bubble": `${ROOT}/ui/speech-bubble.png`,
  "speech-bubble-pink": `${ROOT}/ui/speech-bubble-pink.png`,
  "status-empty": `${ROOT}/ui/status-empty.png`,
  "status-complete": `${ROOT}/ui/status-complete.png`,

  "counter-tray": `${ROOT}/counter/counter-tray.png`,
  "storage-box-heart": `${ROOT}/counter/storage-box-heart.png`,
  "storage-box-flower": `${ROOT}/counter/storage-box-flower.png`,
  "cake-dome": `${ROOT}/counter/cake-dome.png`,
  "utensil-pot": `${ROOT}/counter/utensil-pot.png`,
  "chalkboard-standing": `${ROOT}/counter/chalkboard-standing.png`,
  "chalkboard-hanging": `${ROOT}/counter/chalkboard-hanging.png`,
  "chalkboard-panel": `${ROOT}/counter/chalkboard-panel.png`,
  "order-paper": `${ROOT}/counter/order-paper.png`,

  "target-cupcake": `${ROOT}/targets/cupcake.png`,
  "target-drink": `${ROOT}/targets/drink.png`,
  "target-cookie": `${ROOT}/targets/cookie.png`,
  "target-spoon": `${ROOT}/targets/spoon.png`,
  "target-ice-cream": `${ROOT}/targets/ice-cream.png`,

  "item-cupcake-heart": `${ROOT}/items/cupcake-heart.png`,
  "item-cupcake-chocolate": `${ROOT}/items/cupcake-chocolate.png`,
  "item-cupcake-strawberry": `${ROOT}/items/cupcake-strawberry.png`,
  "item-drink-orange": `${ROOT}/items/drink-orange.png`,
  "item-drink-strawberry": `${ROOT}/items/drink-strawberry.png`,
  "item-drink-green": `${ROOT}/items/drink-green.png`,
  "item-cookie-chocolate-chip": `${ROOT}/items/cookie-chocolate-chip.png`,
  "item-cookie-heart": `${ROOT}/items/cookie-heart.png`,
  "item-ice-cream-vanilla": `${ROOT}/items/ice-cream-vanilla.png`,
  "item-ice-cream-chocolate": `${ROOT}/items/ice-cream-chocolate.png`,
  "item-ice-cream-mint": `${ROOT}/items/ice-cream-mint.png`,
  "item-spoon-blue": `${ROOT}/items/spoon-blue.png`,

  // Current vertical-slice model ids. Variant-specific keys above remain ready
  // for data-driven order expansion.
  "item-cookie": `${ROOT}/items/cookie-chocolate-chip.png`,
  "item-juice": `${ROOT}/items/drink-orange.png`,
  "item-cupcake": `${ROOT}/items/cupcake-heart.png`,
} as const satisfies Record<string, string>;

export type CafeAssetKey = keyof typeof CAFE_ASSETS;
