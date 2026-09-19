export type LandingKind = 'rock' | 'log' | 'crocodile';

export interface LandingTarget {
  id: string;
  kind: LandingKind;
  x: number;
  y: number;
  scale?: number;
}

export interface RetrievalItem {
  id: string;
  texture: string;
  x: number;
  y: number;
  scale: number;
}

export interface RiverLevel {
  id: string;
  worldWidth: number;
  maxJumpDistance: number;
  start: { x: number; y: number };
  farBank: { x: number; y: number };
  targets: LandingTarget[];
  items: RetrievalItem[];
}
