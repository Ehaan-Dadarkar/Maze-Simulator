import { Cell, Dir, DIRS, add, key, same } from "../types/maze";

export type Maze = { size: number; roads: Set<string>; start: Cell; end: Cell };
export type SensorExit = { dir: Dir; cell: Cell };

export function makeMaze(size = 23): Maze {
  return { size, roads: new Set<string>(), start: { x: 2, y: 20 }, end: { x: 20, y: 2 } };
}
export function cloneMaze(m: Maze): Maze { return { ...m, roads: new Set(m.roads), start: { ...m.start }, end: { ...m.end } }; }
export function inBounds(m: Maze, c: Cell): boolean { return c.x >= 0 && c.y >= 0 && c.x < m.size && c.y < m.size; }
export function has(m: Maze, c: Cell): boolean { return inBounds(m, c) && m.roads.has(key(c)); }
export function setRoad(m: Maze, c: Cell, enabled: boolean): void { if (!inBounds(m, c)) return; if (enabled) m.roads.add(key(c)); else m.roads.delete(key(c)); }
export function drawSegment(m: Maze, a: Cell, b: Cell): void { let x=a.x,y=a.y; const dx=Math.sign(b.x-a.x),dy=Math.sign(b.y-a.y); m.roads.add(key({x,y})); while(x!==b.x||y!==b.y){x+=dx;y+=dy;if(inBounds(m,{x,y}))m.roads.add(key({x,y}));} }
export function neighbours(m: Maze, c: Cell): SensorExit[] { return DIRS.map(dir=>({dir,cell:add(c,dir)})).filter(({cell})=>has(m,cell)); }
export function senseLocal(m: Maze, c: Cell): SensorExit[] { return neighbours(m,c); }
export function sampleTwoPath(): Maze { const m=makeMaze(),S=m.start,E=m.end; drawSegment(m,S,{x:2,y:4}); drawSegment(m,{x:2,y:4},{x:8,y:4}); drawSegment(m,{x:8,y:4},{x:8,y:8}); drawSegment(m,{x:8,y:8},{x:18,y:8}); drawSegment(m,{x:18,y:8},{x:18,y:4}); drawSegment(m,{x:18,y:4},{x:20,y:4}); drawSegment(m,{x:20,y:4},E); drawSegment(m,S,{x:2,y:21}); drawSegment(m,{x:2,y:21},{x:20,y:21}); drawSegment(m,{x:20,y:21},E); return m; }
export function connected(m: Maze): boolean { if(!has(m,m.start)||!has(m,m.end))return false; const seen=new Set<string>([key(m.start)]),q=[m.start]; while(q.length){const c=q.shift()!; for(const n of neighbours(m,c)){const k=key(n.cell);if(!seen.has(k)){seen.add(k);q.push(n.cell);}}} return seen.has(key(m.end)); }
export function shortestPath(m: Maze,a: Cell,b: Cell,allowed?: Set<string>): Cell[] { const q:Cell[]=[a],prev=new Map<string,Cell|null>([[key(a),null]]); while(q.length){const c=q.shift()!;if(same(c,b))break;for(const {cell} of neighbours(m,c)){const k=key(cell);if(allowed&&!allowed.has(k))continue;if(!prev.has(k)){prev.set(k,c);q.push(cell);}}} if(!prev.has(key(b)))return[];const route:Cell[]=[];let cur:Cell|null=b;while(cur){route.push(cur);cur=prev.get(key(cur))??null;}return route.reverse(); }
