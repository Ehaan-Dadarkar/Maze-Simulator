export type Cell = { x: number; y: number };
export type Dir = "N" | "E" | "S" | "W";

export const DIRS: Dir[] = ["N", "E", "S", "W"];
export const VEC: Record<Dir, { x: number; y: number }> = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
};

export function add(c: Cell, d: Dir): Cell {
  return { x: c.x + VEC[d].x, y: c.y + VEC[d].y };
}

export function key(c: Cell): string {
  return `${c.x},${c.y}`;
}

export function parseKey(value: string): Cell {
  const [x, y] = value.split(",").map(Number);
  return { x, y };
}

export function same(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}

export function opposite(d: Dir): Dir {
  return d === "N" ? "S" : d === "S" ? "N" : d === "E" ? "W" : "E";
}
