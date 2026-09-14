import { Maze, senseLocal, isEndZoneCell } from "./maze";
import { Cell, Dir, key, opposite, same } from "../types/maze";

export type KnownGraph = { cells: Set<string>; edges: Set<string> };
export type EdgeState = { from: Cell; to: Cell; traversals: 0 | 1 | 2 };
export type JunctionMemory = { position: Cell; exits: Dir[]; visited: boolean };
export type RobotState = {
  pos: Cell; heading: Dir; known: KnownGraph; trace: Cell[]; backtracks: number;
  status: string; mode: "idle" | "dry" | "actual" | "done"; route: Cell[];
  actualCursor: number; led: boolean; firstEndReached: boolean; drySteps: number;
  discoveredCheckpoints: Set<string>; junctions: JunctionMemory[];
  edgeTraversals: Map<string, 0 | 1 | 2>;
};
export type DryRunResult = {
  trace: Cell[]; known: KnownGraph; endReached: boolean; endCell: Cell | null;
  backtracks: number; firstEndIndex: number; discoveredCheckpoints: Set<string>;
  junctions: JunctionMemory[]; edgeTraversals: Map<string, 0 | 1 | 2>;
};

export function edge(a: Cell, b: Cell): string { return [key(a), key(b)].sort().join("|"); }

export function createRobot(start: Cell): RobotState {
  return {
    pos: { ...start }, heading: "E", known: { cells: new Set([key(start)]), edges: new Set() },
    trace: [{ ...start }], backtracks: 0, status: "Ready", mode: "idle", route: [],
    actualCursor: 0, led: false, firstEndReached: false, drySteps: 0,
    discoveredCheckpoints: new Set(), junctions: [], edgeTraversals: new Map(),
  };
}

export function sense(m: Maze, r: RobotState) { return senseLocal(m, r.pos); }

/** Local sensor observations are the only maze information entering robot memory. */
export function discoverAt(m: Maze, r: RobotState) {
  for (const e of senseLocal(m, r.pos)) {
    r.known.cells.add(key(e.cell));
    r.known.edges.add(edge(r.pos, e.cell));
  }
  r.known.cells.add(key(r.pos));
}

function dir(a: Cell, b: Cell): Dir {
  if (b.x > a.x) return "E"; if (b.x < a.x) return "W";
  if (b.y > a.y) return "S"; return "N";
}

function relativeTurn(from: Dir, to: Dir): "S" | "L" | "R" | "B" {
  if (from === to) return "S";
  if (to === opposite(from)) return "B";
  if ((from === "N" && to === "W") || (from === "W" && to === "S") ||
      (from === "S" && to === "E") || (from === "E" && to === "N")) return "L";
  return "R";
}

function turnCost(from: Dir, to: Dir): number {
  const turn = relativeTurn(from, to);
  return turn === "S" ? 0 : turn === "R" || turn === "L" ? 1 : 3;
}

function leftRightTieBreak(h: Dir, a: Dir, b: Dir): Dir {
  // Direction is only a tie-breaker. This prevents the old global left-first bias
  // from dominating every junction while keeping behavior deterministic.
  const rightOrder: Record<Dir, Dir[]> = {
    N: ["E", "W", "S"], E: ["S", "N", "W"], S: ["W", "E", "N"], W: ["N", "S", "E"],
  };
  const order = rightOrder[h];
  return order.indexOf(a) <= order.indexOf(b) ? a : b;
}

/**
 * Adaptive junction policy.
 *
 * The robot cannot see the hidden maze or predict an undiscovered route to END.
 * Therefore this policy deliberately uses only information already available at
 * the current sensor position:
 *   1. Never prefer an already-finished edge over an unexplored edge.
 *   2. Prefer an unexplored straight continuation because it preserves momentum
 *      and avoids the systematic left-turn bias of the old policy.
 *   3. Prefer an unexplored turn over an edge already traversed once.
 *   4. Use the relative turn cost and a deterministic tie-breaker only when the
 *      exploration state is otherwise equivalent.
 *
 * Trémaux traversal limits remain the safety mechanism; this policy only decides
 * which legal local edge to take next.
 */
function chooseAdaptiveExit(r: RobotState, current: Cell, exits: ReturnType<typeof senseLocal>) {
  const candidates = exits
    .map((e) => ({
      ...e,
      traversals: r.edgeTraversals.get(edge(current, e.cell)) ?? 0,
      turn: relativeTurn(r.heading, e.dir),
      cost: turnCost(r.heading, e.dir),
    }))
    .filter((e) => e.traversals < 2);

  if (!candidates.length) return null;

  const minTraversals = Math.min(...candidates.map((e) => e.traversals));
  const frontier = candidates.filter((e) => e.traversals === minTraversals);

  // Among equally unexplored edges, straight is preferred, then the cheaper turn.
  const sorted = frontier.sort((a, b) => {
    const straightDelta = Number(a.turn !== "S") - Number(b.turn !== "S");
    if (straightDelta !== 0) return straightDelta;
    if (a.cost !== b.cost) return a.cost - b.cost;
    return 0;
  });

  const bestCost = sorted[0].cost;
  const tied = sorted.filter((e) => e.cost === bestCost);
  if (tied.length === 1) return tied[0];

  // Do not encode a permanent left-first/right-first maze bias.
  const chosenDir = leftRightTieBreak(r.heading, tied[0].dir, tied[1].dir);
  return tied.find((e) => e.dir === chosenDir) ?? tied[0];
}

function local(m: Maze, r: RobotState) {
  // Preserve the physical sensor order; junction choice is handled separately.
  return senseLocal(m, r.pos);
}

function visitEdge(r: RobotState, a: Cell, b: Cell) {
  const k = edge(a, b);
  r.edgeTraversals.set(k, Math.min(2, (r.edgeTraversals.get(k) ?? 0) + 1) as 0 | 1 | 2);
}

function discoverCheckpoint(m: Maze, r: RobotState) {
  const k = key(r.pos); if (m.checkpoints.has(k)) r.discoveredCheckpoints.add(k);
}

/** Trémaux-style adaptive exploration using only local exits. Stops immediately when the END sensor activates. */
export function buildDryTrace(m: Maze, start: Cell): DryRunResult {
  const r = createRobot(start); r.mode = "dry"; r.status = "Exploring from local sensors";
  discoverAt(m, r); discoverCheckpoint(m, r);
  const trace: Cell[] = [{ ...start }], stack: Cell[] = [{ ...start }];
  let backtracks = 0, firstEndIndex = -1, endCell: Cell | null = null;

  while (stack.length) {
    const current = stack[stack.length - 1];
    r.pos = { ...current }; discoverAt(m, r); discoverCheckpoint(m, r);
    const exits = local(m, r);

    if (exits.length > 2) {
      const existing = r.junctions.find((x) => same(x.position, current));
      if (existing) existing.exits = exits.map((x) => x.dir);
      else r.junctions.push({ position: { ...current }, exits: exits.map((x) => x.dir), visited: true });
    }

    // END is terminal during Dry Run. The robot must stop here and cannot continue exploring.
    if (isEndZoneCell(m, current)) {
      firstEndIndex = trace.length - 1; endCell = { ...current }; r.led = true; break;
    }

    const next = chooseAdaptiveExit(r, current, exits);

    if (!next) {
      stack.pop(); if (!stack.length) break;
      const parent = stack[stack.length - 1]; visitEdge(r, current, parent);
      trace.push({ ...parent }); backtracks++; r.pos = { ...parent }; r.heading = dir(current, parent);
      discoverAt(m, r); discoverCheckpoint(m, r); continue;
    }

    const nextCell = { ...next.cell }; visitEdge(r, current, nextCell); r.heading = next.dir;
    trace.push(nextCell); r.pos = nextCell; discoverAt(m, r); discoverCheckpoint(m, r);
    if (isEndZoneCell(m, nextCell)) {
      firstEndIndex = trace.length - 1; endCell = { ...nextCell }; r.led = true; break;
    }
    if (!stack.some((c) => same(c, nextCell))) stack.push(nextCell);
  }

  return {
    trace, known: { cells: new Set(r.known.cells), edges: new Set(r.known.edges) },
    endReached: firstEndIndex >= 0, endCell, backtracks, firstEndIndex,
    discoveredCheckpoints: new Set(r.discoveredCheckpoints),
    junctions: r.junctions.map((j) => ({ ...j, position: { ...j.position }, exits: [...j.exits] })),
    edgeTraversals: new Map(r.edgeTraversals),
  };
}

function parse(v: string): Cell { const [x, y] = v.split(",").map(Number); return { x, y }; }

/** Shortest route through the graph the robot has learned. If the exact END anchor was not sensed,
 * use the closest learned cell to that anchor; this represents entering the physical END box. */
export function shortestKnownRoute(g: KnownGraph, start: Cell, target: Cell): Cell[] {
  let destination = target;
  if (!g.cells.has(key(destination))) {
    let best: Cell | null = null, bestDistance = Infinity;
    for (const value of g.cells) {
      const c = parse(value); const d = Math.abs(c.x - target.x) + Math.abs(c.y - target.y);
      if (d < bestDistance) { best = c; bestDistance = d; }
    }
    if (!best) return [];
    destination = best;
  }

  const q: Cell[] = [{ ...start }];
  const prev = new Map<string, Cell | null>([[key(start), null]]);
  while (q.length) {
    const c = q.shift()!; if (same(c, destination)) break;
    for (const e of g.edges) {
      const [a, b] = e.split("|"); const ck = key(c);
      const next = a === ck ? parse(b) : b === ck ? parse(a) : null;
      if (next && !prev.has(key(next))) { prev.set(key(next), c); q.push(next); }
    }
  }
  if (!prev.has(key(destination))) return [];
  const out: Cell[] = []; let c: Cell | null = { ...destination };
  while (c) { out.push(c); c = prev.get(key(c)) ?? null; }
  return out.reverse();
}

export function simplifyTurns(route: Cell[]): string[] {
  const out: string[] = [];
  for (let i = 1; i < route.length - 1; i++) {
    const a = dir(route[i - 1], route[i]), b = dir(route[i], route[i + 1]);
    out.push(relativeTurn(a, b));
  }
  return out;
}

export function followStoredRoute(r: RobotState, route: Cell[], cursor: number): RobotState {
  const i = Math.max(0, Math.min(cursor, route.length - 1));
  const next = { ...r, pos: { ...route[i] }, mode: "actual" as const, actualCursor: i,
    status: i >= route.length - 1 ? "END reached" : "Replaying stored route", led: i >= route.length - 1 };
  if (i > 0) next.heading = dir(route[i - 1], route[i]);
  return next;
}

export function localSensorLabel(m: Maze, r: RobotState) {
  return senseLocal(m, r.pos).map((s) => s.dir).join(" ") || "NONE";
}
