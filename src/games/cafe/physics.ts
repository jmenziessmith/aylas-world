import { CAFE_ITEMS, type CafeItemId } from './model.js';
import { CAFE_TUNING } from './tuning.js';

export interface TrayTilt { x: number; y: number }

/** Coordinates and radii are fractions of the tray width/height (0..1). */
export interface TrayBody {
  instanceId: string;
  itemId: CafeItemId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  spilled: boolean;
}

export interface TrayPhysicsResult {
  bodies: TrayBody[];
  spilledIds: string[];
}

export function createTrayBody(instanceId: string, itemId: CafeItemId, x: number, y: number): TrayBody {
  return { instanceId, itemId, x, y, vx: 0, vy: 0, radius: CAFE_ITEMS[itemId].physics.radius, spilled: false };
}

export function stepTrayPhysics(bodies: TrayBody[], tilt: TrayTilt, dtSeconds: number): TrayPhysicsResult {
  const spilledIds: string[] = [];
  let remaining = Math.min(Math.max(dtSeconds, 0), 0.12);
  while (remaining > 0) {
    const dt = Math.min(remaining, CAFE_TUNING.maxPhysicsStepSeconds);
    integrate(bodies, tilt, dt);
    solveCollisions(bodies);
    for (const body of bodies) {
      if (!body.spilled && isOverEdge(body)) {
        body.spilled = true;
        spilledIds.push(body.instanceId);
      }
    }
    remaining -= dt;
  }
  return { bodies, spilledIds };
}

function integrate(bodies: TrayBody[], tilt: TrayTilt, dt: number): void {
  for (const body of bodies) {
    if (body.spilled) continue;
    const personality = CAFE_ITEMS[body.itemId].physics;
    body.vx += clamp(tilt.x, -1, 1) * CAFE_TUNING.trayAcceleration * personality.slide * dt;
    body.vy += clamp(tilt.y, -1, 1) * CAFE_TUNING.trayAcceleration * personality.slide * dt;
    const damping = Math.exp(-CAFE_TUNING.velocityDamping * personality.damping * dt);
    body.vx *= damping;
    body.vy *= damping;
    body.x += body.vx * dt;
    body.y += body.vy * dt;
  }
}

function solveCollisions(bodies: TrayBody[]): void {
  for (let aIndex = 0; aIndex < bodies.length; aIndex += 1) {
    const a = bodies[aIndex];
    if (a.spilled) continue;
    for (let bIndex = aIndex + 1; bIndex < bodies.length; bIndex += 1) {
      const b = bodies[bIndex];
      if (b.spilled) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const minimum = a.radius + b.radius;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared >= minimum * minimum) continue;
      const distance = Math.sqrt(distanceSquared);
      const nx = distance === 0 ? 1 : dx / distance;
      const ny = distance === 0 ? 0 : dy / distance;
      const overlap = minimum - distance;
      a.x -= nx * overlap * 0.5;
      a.y -= ny * overlap * 0.5;
      b.x += nx * overlap * 0.5;
      b.y += ny * overlap * 0.5;
      const closingSpeed = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (closingSpeed < 0) {
        const impulse = -(1 + CAFE_TUNING.collisionRestitution) * closingSpeed * 0.5;
        a.vx -= impulse * nx;
        a.vy -= impulse * ny;
        b.vx += impulse * nx;
        b.vy += impulse * ny;
      }
    }
  }
}

function isOverEdge(body: TrayBody): boolean {
  const allowance = body.radius * CAFE_TUNING.spillOverhang;
  return body.x < allowance || body.x > 1 - allowance || body.y < allowance || body.y > 1 - allowance;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
