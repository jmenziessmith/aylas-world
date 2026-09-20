/** Shared design coordinates keep the rendered tray and its input/physics region together. */
export const CAFE_LAYOUT = {
  width: 1000,
  height: 600,
  prepTray: { x: 830, y: 493, w: 300, h: 130 },
  carryTray: { x: 485, y: 437, w: 420, h: 260 },
  serveTray: { x: 240, y: 385, w: 416, h: 272 },
  sourceSlots: [
    { x: 220, y: 350 }, { x: 400, y: 350 }, { x: 580, y: 350 },
    { x: 310, y: 475 }, { x: 490, y: 475 },
  ],
  walker: { startX: 500, endX: 700, y: 265 },
  progress: { x: 500, y: 52, width: 510, height: 118, firstSlot: 40 / 629, lastSlot: 584 / 629 },
  table: { x: 618, y: 641, width: 950, height: 673 },
  customer: { x: 615, y: 210, width: 250, height: 270 },
  serveTargetRadius: 76,
} as const;

export function servingPositions(count: number): { x: number; y: number }[] {
  if (count === 1) return [{ x: 640, y: 438 }];
  if (count === 2) return [{ x: 570, y: 425 }, { x: 750, y: 425 }];
  return [{ x: 560, y: 408 }, { x: 720, y: 408 }, { x: 640, y: 542 }].slice(0, count);
}

export function progressPosition(index: number, count: number): { x: number; y: number } {
  const bar = CAFE_LAYOUT.progress;
  const fraction = count <= 1 ? .5 : bar.firstSlot + (bar.lastSlot - bar.firstSlot) * index / (count - 1);
  return { x: bar.x + (fraction - .5) * bar.width, y: bar.y - 4 };
}
