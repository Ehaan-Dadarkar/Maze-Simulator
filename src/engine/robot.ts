import { Maze, senseLocal } from "./maze";
import { Cell, Dir, key, opposite, same } from "../types/maze";

export type KnownGraph = { cells: Set<string>; edges: Set<string> };
export type RobotState = { pos: Cell; heading: Dir; known: KnownGraph; trace: Cell[]; backtracks: number; status: string; mode: "idle"|"dry"|"actual"|"done"; route: Cell[]; actualCursor: number; led: boolean; firstEndReached: boolean; drySteps: number };
export type DryRunResult = { trace: Cell[]; known: KnownGraph; endReached: boolean; backtracks: number; firstEndIndex: number };

export function edge(a: Cell,b: Cell): string { return [key(a),key(b)].sort().join("|"); }
export function createRobot(start: Cell): RobotState { return {pos:{...start},heading:"E",known:{cells:new Set([key(start)]),edges:new Set()},trace:[{...start}],backtracks:0,status:"Ready",mode:"idle",route:[],actualCursor:0,led:false,firstEndReached:false,drySteps:0}; }
export function sense(m: Maze,r: RobotState) { return senseLocal(m,r.pos); }

/** The only bridge between the hidden maze and robot memory. */
export function discoverAt(m: Maze,r: RobotState): void { for(const exit of senseLocal(m,r.pos)){r.known.cells.add(key(exit.cell));r.known.edges.add(edge(r.pos,exit.cell));} r.known.cells.add(key(r.pos)); }
function directionBetween(a: Cell,b: Cell): Dir { if(b.x>a.x)return"E";if(b.x<a.x)return"W";if(b.y>a.y)return"S";return"N"; }
function orderedExits(m: Maze,r: RobotState) { const priority:Record<Dir,Dir[]>={N:["W","N","E","S"],E:["N","E","S","W"],S:["E","S","W","N"],W:["S","W","N","E"]};const rank=new Map(priority[r.heading].map((d,i)=>[d,i]));return senseLocal(m,r.pos).sort((a,b)=>rank.get(a.dir)!-rank.get(b.dir)!); }

/** Explore only from local sensor observations; stop at the first END. */
export function buildDryTrace(m: Maze,start: Cell): DryRunResult {
  const r=createRobot(start);r.mode="dry";r.status="Exploring";discoverAt(m,r);
  const stack:{cell:Cell;incoming?:Dir}[]=[{cell:{...start}}],visited=new Set<string>([key(start)]),usedEdges=new Set<string>(),trace:Cell[]=[{...start}];
  let backtracks=0,firstEndIndex=-1;
  while(stack.length){const current=stack[stack.length-1].cell;r.pos={...current};r.heading=stack[stack.length-1].incoming??r.heading;discoverAt(m,r);if(same(current,m.end)){firstEndIndex=trace.length-1;break;}
    const next=orderedExits(m,r).find(candidate=>!usedEdges.has(edge(current,candidate.cell)));
    if(next){usedEdges.add(edge(current,next.cell));const nextCell={...next.cell},nextKey=key(nextCell);r.heading=next.dir;trace.push(nextCell);if(!visited.has(nextKey)){visited.add(nextKey);stack.push({cell:nextCell,incoming:next.dir});discoverAt(m,r);}continue;}
    stack.pop();if(stack.length){const parent=stack[stack.length-1].cell;trace.push({...parent});backtracks++;r.heading=opposite(directionBetween(current,parent));}
  }
  return {trace,known:{cells:new Set(r.known.cells),edges:new Set(r.known.edges)},endReached:firstEndIndex>=0,backtracks,firstEndIndex};
}

function parseKey(value:string):Cell { const [x,y]=value.split(",").map(Number);return{x,y}; }
export function shortestKnownRoute(graph:KnownGraph,start:Cell,end:Cell):Cell[]{const queue:Cell[]=[start],prev=new Map<string,Cell|null>([[key(start),null]]);while(queue.length){const current=queue.shift()!;if(same(current,end))break;for(const e of graph.edges){const [a,b]=e.split("|");const ck=key(current);const next=a===ck?parseKey(b):b===ck?parseKey(a):null;if(next){const k=key(next);if(graph.cells.has(k)&&!prev.has(k)){prev.set(k,current);queue.push(next);}}}}if(!prev.has(key(end)))return[];const route:Cell[]=[];let cursor:Cell|null=end;while(cursor){route.push(cursor);cursor=prev.get(key(cursor))??null;}return route.reverse();}
export function followStoredRoute(r:RobotState,route:Cell[],cursor:number):RobotState{const next={...r,pos:{...route[cursor]},mode:"actual" as const,actualCursor:cursor,status:cursor>=route.length-1?"END reached":"Replaying stored route",led:cursor>=route.length-1};if(cursor>0)next.heading=directionBetween(route[cursor-1],route[cursor]);return next;}
export function localSensorLabel(m:Maze,r:RobotState):string{return senseLocal(m,r.pos).map(s=>s.dir).join(" ")||"NONE";}
