import type { RiverLevel } from '../types/level';

export const crocodileRiver: RiverLevel = {
  id: 'crocodile-river-01',
  worldWidth: 3820,
  maxJumpDistance: 560,
  start: { x: 410, y: 510 },
  farBank: { x: 3470, y: 475 },
  targets: [
    // Add or move entries to extend the crossing; movement code does not know the route.
    { id: 'r1', kind: 'rock', x: 760, y: 520, scale: 0.23 },
    { id: 'c1', kind: 'crocodile', x: 1000, y: 385, scale: 0.21 },
    { id: 'l1', kind: 'log', x: 1190, y: 430, scale: 0.2 },
    { id: 'c2', kind: 'crocodile', x: 1450, y: 335, scale: 0.20 },
    { id: 'l2', kind: 'log', x: 1560, y: 545, scale: 0.2 },
    { id: 'r2', kind: 'rock', x: 1930, y: 420, scale: 0.22 },
    { id: 'c3', kind: 'crocodile', x: 2130, y: 555, scale: 0.21 },
    { id: 'l3', kind: 'log', x: 2310, y: 385, scale: 0.2 },
    { id: 'l4', kind: 'log', x: 2650, y: 525, scale: 0.2 },
    { id: 'c4', kind: 'crocodile', x: 2860, y: 430, scale: 0.16 },
    { id: 'r7', kind: 'rock', x: 3070, y: 480, scale: 0.22 }
  ],
  items: [
    { id: 'teddy', texture: 'teddy', x: 3585, y: 375, scale: 0.1 },
    { id: 'ball', texture: 'ball', x: 3720, y: 390, scale: 0.085 },
    { id: 'car', texture: 'car', x: 3590, y: 520, scale: 0.085 },
    { id: 'backpack', texture: 'backpack', x: 3720, y: 510, scale: 0.085 }
  ]
};
