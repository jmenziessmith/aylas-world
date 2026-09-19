export type BalloonColour = 'pink' | 'yellow' | 'teal' | 'purple';

export interface PartyObject {
  id: string;
  type: 'balloon' | 'cake' | 'party-bag' | 'puddle';
  x: number;
  y: number;
  colour?: BalloonColour;
  bobHeight?: number;
  bobDuration?: number;
}

export const jumpPartyLevel = {
  worldWidth: 3600,
  groundY: 605,
  startX: 360,
  objects: [
    { id: 'b1', type: 'balloon', colour: 'pink', x: 650, y: 430, bobHeight: 15, bobDuration: 1500 },
    { id: 'b2', type: 'balloon', colour: 'yellow', x: 890, y: 355, bobHeight: 20, bobDuration: 1800 },
    { id: 'p1', type: 'puddle', x: 1110, y: 595 },
    { id: 'b3', type: 'balloon', colour: 'teal', x: 1200, y: 420, bobHeight: 13, bobDuration: 1650 },
    { id: 'cake1', type: 'cake', x: 1430, y: 525 },
    { id: 'b4', type: 'balloon', colour: 'purple', x: 1510, y: 320, bobHeight: 22, bobDuration: 1950 },
    { id: 'b5', type: 'balloon', colour: 'pink', x: 1770, y: 410, bobHeight: 17, bobDuration: 1450 },
    { id: 'bag1', type: 'party-bag', x: 1960, y: 530 },
    { id: 'b6', type: 'balloon', colour: 'yellow', x: 2020, y: 345, bobHeight: 12, bobDuration: 1750 },
    { id: 'p2', type: 'puddle', x: 2260, y: 595 },
    { id: 'b7', type: 'balloon', colour: 'teal', x: 2320, y: 420, bobHeight: 19, bobDuration: 1850 },
    { id: 'b8', type: 'balloon', colour: 'purple', x: 2570, y: 360, bobHeight: 15, bobDuration: 1550 },
    { id: 'cake2', type: 'cake', x: 2770, y: 525 },
    { id: 'b9', type: 'balloon', colour: 'pink', x: 2860, y: 415, bobHeight: 21, bobDuration: 1900 },
    { id: 'bag2', type: 'party-bag', x: 3090, y: 530 },
    { id: 'b10', type: 'balloon', colour: 'yellow', x: 3160, y: 335, bobHeight: 14, bobDuration: 1600 },
    { id: 'b11', type: 'balloon', colour: 'teal', x: 3370, y: 420, bobHeight: 18, bobDuration: 1800 },
    { id: 'b12', type: 'balloon', colour: 'purple', x: 3460, y: 300, bobHeight: 16, bobDuration: 1700 }
  ] satisfies PartyObject[]
} as const;

export const JUMP_TARGET = 40;
export const BALLOON_TARGET = 10;
