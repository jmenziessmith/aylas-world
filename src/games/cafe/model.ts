export type CafeItemId = 'cookie' | 'juice' | 'cupcake' | 'ice-cream' | 'spoon';
export type ServingSurface = 'plate' | 'coaster';
export type CafeItemStatus = 'loaded' | 'spilled' | 'served';

export interface CafeItemDefinition {
  id: CafeItemId;
  label: string;
  emoji: string;
  servingSurface: ServingSurface;
  physics: {
    radius: number;
    slide: number;
    damping: number;
  };
}

export interface OrderLine {
  itemId: CafeItemId;
  count: number;
}

export interface CafeOrder {
  id: string;
  lines: readonly OrderLine[];
  steps: number;
}

export interface CafeItemInstance {
  id: string;
  itemId: CafeItemId;
  status: CafeItemStatus;
}

export interface CafeRound {
  order: CafeOrder;
  items: CafeItemInstance[];
  nextInstanceNumber: number;
  recoveryCount: number;
}

export type RoundOutcome = 'in-progress' | 'perfect' | 'kind-success' | 'retry';

export const CAFE_ITEMS: Readonly<Record<CafeItemId, CafeItemDefinition>> = {
  cookie: {
    id: 'cookie', label: 'Cookie', emoji: '🍪', servingSurface: 'plate',
    physics: { radius: 0.054, slide: 1.08, damping: 0.96 },
  },
  juice: {
    id: 'juice', label: 'Juice', emoji: '🧃', servingSurface: 'coaster',
    physics: { radius: 0.06, slide: 0.78, damping: 1.12 },
  },
  cupcake: {
    id: 'cupcake', label: 'Cupcake', emoji: '🧁', servingSurface: 'plate',
    physics: { radius: 0.062, slide: 0.9, damping: 1.02 },
  },
  'ice-cream': {
    id: 'ice-cream', label: 'Ice cream', emoji: '🍨', servingSurface: 'plate',
    physics: { radius: 0.06, slide: 0.88, damping: 1.04 },
  },
  spoon: {
    id: 'spoon', label: 'Spoon', emoji: '🥄', servingSurface: 'plate',
    physics: { radius: 0.042, slide: 0.8, damping: 1.14 },
  },
};

export const CAFE_ORDERS: readonly CafeOrder[] = [
  { id: 'first-treats', lines: [{ itemId: 'cookie', count: 1 }, { itemId: 'juice', count: 1 }], steps: 10 },
  { id: 'cookie-count', lines: [{ itemId: 'cookie', count: 2 }, { itemId: 'juice', count: 1 }], steps: 10 },
  { id: 'cupcake-treat', lines: [{ itemId: 'cupcake', count: 1 }, { itemId: 'juice', count: 1 }], steps: 10 },
  { id: 'cool-treat', lines: [{ itemId: 'ice-cream', count: 1 }, { itemId: 'juice', count: 1 }], steps: 10 },
  { id: 'dessert-pair', lines: [{ itemId: 'cupcake', count: 1 }, { itemId: 'ice-cream', count: 1 }], steps: 10 },
];

/** A spoon is an optional extra to balance on the tray, never part of an order. */
const OPTIONAL_ITEM_LIMITS: Partial<Record<CafeItemId, number>> = { spoon: 1 };

export function createRound(order: CafeOrder = CAFE_ORDERS[0]): CafeRound {
  return { order, items: [], nextInstanceNumber: 1, recoveryCount: 0 };
}

export function canAddItem(round: CafeRound, itemId: CafeItemId): boolean {
  const required = round.order.lines.find((line) => line.itemId === itemId)?.count
    ?? OPTIONAL_ITEM_LIMITS[itemId]
    ?? 0;
  const present = round.items.filter((item) => item.itemId === itemId).length;
  return present < required;
}

export function addItem(round: CafeRound, itemId: CafeItemId): CafeItemInstance | undefined {
  if (!canAddItem(round, itemId)) return undefined;
  const item = { id: `cafe-item-${round.nextInstanceNumber}`, itemId, status: 'loaded' as const };
  round.nextInstanceNumber += 1;
  round.items.push(item);
  return item;
}

export function removeLoadedItem(round: CafeRound, instanceId: string): boolean {
  const index = round.items.findIndex((item) => item.id === instanceId && item.status === 'loaded');
  if (index < 0) return false;
  round.items.splice(index, 1);
  return true;
}

export function validateLoadedOrder(round: CafeRound): boolean {
  const expected = new Map(round.order.lines.map((line) => [line.itemId, line.count]));
  const loaded = new Map<CafeItemId, number>();
  for (const item of round.items) {
    if (item.status === 'loaded') loaded.set(item.itemId, (loaded.get(item.itemId) ?? 0) + 1);
  }
  return [...expected].every(([itemId, count]) => loaded.get(itemId) === count);
}

export function markSpilled(round: CafeRound, instanceId: string): boolean {
  const item = round.items.find((candidate) => candidate.id === instanceId);
  if (!item || item.status !== 'loaded') return false;
  item.status = 'spilled';
  return true;
}

export function markServed(round: CafeRound, instanceId: string, targetItemId: CafeItemId): boolean {
  const item = round.items.find((candidate) => candidate.id === instanceId);
  const required = round.order.lines.some((line) => line.itemId === targetItemId);
  if (!item || !required || item.status !== 'loaded' || item.itemId !== targetItemId) return false;
  item.status = 'served';
  return true;
}

/** Puts spilled items back on the tray for a gentle retry of the carry phase. */
export function beginRecovery(round: CafeRound): CafeItemInstance[] {
  const recovered = round.items.filter((item) => item.status === 'spilled');
  for (const item of recovered) item.status = 'loaded';
  if (recovered.length > 0) round.recoveryCount += 1;
  return recovered;
}

export function getRoundOutcome(round: CafeRound): RoundOutcome {
  const requiredItemIds = new Set(round.order.lines.map((line) => line.itemId));
  const requiredItems = round.items.filter((item) => requiredItemIds.has(item.itemId));
  const served = requiredItems.filter((item) => item.status === 'served').length;
  const spilled = requiredItems.filter((item) => item.status === 'spilled').length;
  const expected = round.order.lines.reduce((sum, line) => sum + line.count, 0);
  if (served + spilled < expected) return 'in-progress';
  if (served === expected) return 'perfect';
  return 'retry';
}
