/** Isometric (2:1) projection helpers. All values are in stage pixels. */

export const GRID = 11;
export const TILE_W = 120;
export const TILE_H = 60;
export const WALL_H = 100;

export const STAGE_W = 1340;
export const STAGE_H = 850;

const ORIGIN_X = STAGE_W / 2;
const ORIGIN_Y = 130;

export interface Point {
  x: number;
  y: number;
}

/** Grid coordinates on the floor plane -> screen coordinates */
export function toScreen(gx: number, gy: number, lift = 0): Point {
  return {
    x: ORIGIN_X + ((gx - gy) * TILE_W) / 2,
    y: ORIGIN_Y + ((gx + gy) * TILE_H) / 2 - lift,
  };
}

export const CENTER = toScreen(GRID / 2, GRID / 2);

/** Radii of the elliptical ring the team sits on (a circle on the iso floor) */
export const RING_RX = 410;
export const RING_RY = 260;

export function ringPosition(index: number, count: number): Point {
  const angle = ((-90 + (index * 360) / count) * Math.PI) / 180;
  return {
    x: CENTER.x + RING_RX * Math.cos(angle),
    y: CENTER.y + RING_RY * Math.sin(angle),
  };
}

export function points(...pts: Point[]): string {
  return pts.map((p) => `${p.x},${p.y}`).join(" ");
}
