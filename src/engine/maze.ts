import { Cell, Dir, DIRS, add, key, same } from "../types/maze";

/** Organiser/environment model. The robot never receives the hidden fields directly. */
export type Maze = {
  size: number;
  roads: Set<string>;
  start: Cell;
  end: Cell;
  /** Observer/scoring data only. The robot does not know these locations. */
  checkpoints: Set<string>;
  /** Observer-only mathematical benchmark captured at Dry Run start. */
  referenceShortest: Cell[];
};
export type SensorExit = { dir: Dir; cell: Cell };

export function makeMaze(size = 23): Maze {
  return {
    size,
    roads: new Set<string>(),
    start: { x: 2, y: 20 },
    end: { x: 20, y: 2 },
    checkpoints: new Set<string>(),
    referenceShortest: [],
  };
}

export function cloneMaze(m: Maze): Maze {
  return {
    ...m,
    roads: new Set(m.roads),
    start: { ...m.start },
    end: { ...m.end },
    checkpoints: new Set(m.checkpoints),
    referenceShortest: m.referenceShortest.map((c) => ({ ...c })),
  };
}

export function inBounds(m: Maze, c: Cell): boolean {
  return c.x >= 0 && c.y >= 0 && c.x < m.size && c.y < m.size;
}

export function has(m: Maze, c: Cell): boolean {
  return inBounds(m, c) && m.roads.has(key(c));
}

export function setRoad(m: Maze, c: Cell, enabled: boolean): void {
  if (!inBounds(m, c)) return;
  if (enabled) m.roads.add(key(c));
  else m.roads.delete(key(c));
}

export function drawSegment(m: Maze, a: Cell, b: Cell): void {
  let x = a.x;
  let y = a.y;
  const dx = Math.sign(b.x - a.x);
  const dy = Math.sign(b.y - a.y);
  m.roads.add(key({ x, y }));
  while (x !== b.x || y !== b.y) {
    x += dx;
    y += dy;
    if (inBounds(m, { x, y })) m.roads.add(key({ x, y }));
  }
}

export function neighbours(m: Maze, c: Cell): SensorExit[] {
  return DIRS.map((dir) => ({ dir, cell: add(c, dir) })).filter(({ cell }) =>
    has(m, cell),
  );
}

/** Only local road exits are exposed to the robot. */
export function senseLocal(m: Maze, c: Cell): SensorExit[] {
  return neighbours(m, c);
}

/**
 * The official end marker is a 400 x 400 mm white box while normal lines are 30 mm.
 * With this simulator's 23-cell / 2300 mm arena model, that is a 4 x 4-cell zone.
 * The robot does not receive this set; it only gets the simulated end sensor signal.
 */
export function endZoneCells(m: Maze): Set<string> {
  const zone = new Set<string>();
  const minX = Math.max(0, Math.floor(m.end.x - 1));
  const minY = Math.max(0, Math.floor(m.end.y - 1));
  const maxX = Math.min(m.size - 1, minX + 3);
  const maxY = Math.min(m.size - 1, minY + 3);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) zone.add(key({ x, y }));
  }
  return zone;
}

export function isEndZone(m: Maze, c: Cell): boolean {
  return isEndZoneCell(m, c);
}

export function isEndZoneCell(m: Maze, c: Cell): boolean {
  return endZoneCells(m).has(key(c));
}

/**
 * Observer-only shortest route to the END box.
 * It may finish on any road cell inside the 400 x 400 mm END zone because
 * entering the white box is the completion condition, not reaching its
 * centre coordinate.
 */
export function shortestPathToEndZone(m: Maze, start: Cell): Cell[] {
  const targets = endZoneCells(m);
  const q: Cell[] = [start];
  const prev = new Map<string, Cell | null>([[key(start), null]]);

  if (targets.has(key(start))) return [{ ...start }];

  let target: Cell | null = null;
  while (q.length) {
    const current = q.shift()!;
    for (const { cell } of neighbours(m, current)) {
      const k = key(cell);
      if (prev.has(k)) continue;
      prev.set(k, current);
      if (targets.has(k)) {
        target = cell;
        q.length = 0;
        break;
      }
      q.push(cell);
    }
  }

  if (!target) return [];
  return reconstructPath(prev, target);
}

function reconstructPath(prev: Map<string, Cell | null>, target: Cell): Cell[] {
  const route: Cell[] = [];
  let current: Cell | null = { ...target };
  while (current) {
    route.push(current);
    current = prev.get(key(current)) ?? null;
  }
  return route.reverse();
}

export function sampleTwoPath(): Maze {
  const m = makeMaze();
  const S = m.start;
  const E = m.end;

  drawSegment(m, S, { x: 2, y: 4 });
  drawSegment(m, { x: 2, y: 4 }, { x: 8, y: 4 });
  drawSegment(m, { x: 8, y: 4 }, { x: 8, y: 8 });
  drawSegment(m, { x: 8, y: 8 }, { x: 18, y: 8 });
  drawSegment(m, { x: 18, y: 8 }, { x: 18, y: 4 });
  drawSegment(m, { x: 18, y: 4 }, { x: 20, y: 4 });
  drawSegment(m, { x: 20, y: 4 }, E);

  drawSegment(m, S, { x: 2, y: 21 });
  drawSegment(m, { x: 2, y: 21 }, { x: 20, y: 21 });
  drawSegment(m, { x: 20, y: 21 }, E);

  // Observer-only checkpoint references. The real arena has no circles painted on it.
  for (const c of [
    { x: 8, y: 8 },
    { x: 18, y: 8 },
    { x: 18, y: 4 },
    { x: 20, y: 21 },
  ]) {
    m.checkpoints.add(key(c));
  }

  return m;
}

export function connected(m: Maze): boolean {
  if (!has(m, m.start)) return false;
  return shortestPathToEndZone(m, m.start).length > 0;
}

export function shortestPath(
  m: Maze,
  a: Cell,
  b: Cell,
  allowed?: Set<string>,
): Cell[] {
  const q: Cell[] = [a];
  const prev = new Map<string, Cell | null>([[key(a), null]]);

  while (q.length) {
    const c = q.shift()!;
    if (same(c, b)) break;

    for (const { cell } of neighbours(m, c)) {
      const k = key(cell);
      if (allowed && !allowed.has(k)) continue;
      if (!prev.has(k)) {
        prev.set(k, c);
        q.push(cell);
      }
    }
  }

  if (!prev.has(key(b))) return [];
  return reconstructPath(prev, b);
}
