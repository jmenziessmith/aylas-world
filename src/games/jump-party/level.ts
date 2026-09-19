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
  worldWidth: 1280,
  groundY: 605,
  startX: 640,
  objects: [
    { id: 'b1', type: 'balloon', colour: 'pink', x: 205, y: 420, bobHeight: 15, bobDuration: 1500 },
    { id: 'b2', type: 'balloon', colour: 'yellow', x: 315, y: 330, bobHeight: 20, bobDuration: 1800 },
    { id: 'b3', type: 'balloon', colour: 'teal', x: 425, y: 415, bobHeight: 13, bobDuration: 1650 },
    { id: 'b4', type: 'balloon', colour: 'purple', x: 535, y: 310, bobHeight: 22, bobDuration: 1950 },
    { id: 'b5', type: 'balloon', colour: 'pink', x: 645, y: 410, bobHeight: 17, bobDuration: 1450 },
    { id: 'b6', type: 'balloon', colour: 'yellow', x: 755, y: 325, bobHeight: 12, bobDuration: 1750 },
    { id: 'b7', type: 'balloon', colour: 'teal', x: 865, y: 415, bobHeight: 19, bobDuration: 1850 },
    { id: 'b8', type: 'balloon', colour: 'purple', x: 975, y: 320, bobHeight: 15, bobDuration: 1550 },
    { id: 'b9', type: 'balloon', colour: 'pink', x: 1085, y: 410, bobHeight: 21, bobDuration: 1900 },
    { id: 'b10', type: 'balloon', colour: 'yellow', x: 1165, y: 315, bobHeight: 14, bobDuration: 1600 },
    { id: 'p1', type: 'puddle', x: 790, y: 595 },
    { id: 'cake1', type: 'cake', x: 465, y: 525 },
    { id: 'bag1', type: 'party-bag', x: 1020, y: 530 }
  ] satisfies PartyObject[]
} as const;

export const JUMP_TARGET = 40;
export const BALLOON_TARGET = 10;
