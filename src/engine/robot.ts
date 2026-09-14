import { Maze, senseLocal, isEndZoneCell } from "./maze";
import { Cell, Dir, key, opposite, same } from "../types/maze";

export type KnownGraph = { cells: Set<string>; edges: Set<string> };
export type EdgeState = { from: Cell; to: Cell; traversals: 0 | 1 | 2 };
export type JunctionMemory = { position: Cell; exits: Dir[]; visited: boolean };
export type RobotState = { pos: Cell; heading: Dir; known: KnownGraph; trace: Cell[]; backtracks: number; status: string; mode: "idle"|"dry"|"actual"|"done"; route: Cell[]; actualCursor: number; led: boolean; firstEndReached: boolean; drySteps: number; discoveredCheckpoints: Set<string>; junctions: JunctionMemory[]; edgeTraversals: Map<string,0|1|2> };
export type DryRunResult = { trace: Cell[]; known: KnownGraph; endReached: boolean; backtracks: number; firstEndIndex: number; discoveredCheckpoints: Set<string>; junctions: JunctionMemory[]; edgeTraversals: Map<string,0|1|2> };

export function edge(a:Cell,b:Cell){return [key(a),key(b)].sort().join("|");}
export function createRobot(start:Cell):RobotState{return {pos:{...start},heading:"E",known:{cells:new Set([key(start)]),edges:new Set()},trace:[{...start}],backtracks:0,status:"Ready",mode:"idle",route:[],actualCursor:0,led:false,firstEndReached:false,drySteps:0,discoveredCheckpoints:new Set(),junctions:[],edgeTraversals:new Map()};}
export function sense(m:Maze,r:RobotState){return senseLocal(m,r.pos);}
/** Local sensor observations are the only maze information entering robot memory. */
export function discoverAt(m:Maze,r:RobotState){for(const e of senseLocal(m,r.pos)){r.known.cells.add(key(e.cell));r.known.edges.add(edge(r.pos,e.cell));}r.known.cells.add(key(r.pos));}
function dir(a:Cell,b:Cell):Dir{if(b.x>a.x)return"E";if(b.x<a.x)return"W";if(b.y>a.y)return"S";return"N";}
function leftFirst(h:Dir):Dir[]{return ({N:["W","N","E","S"],E:["N","E","S","W"],S:["E","S","W","N"],W:["S","W","N","E"]} as Record<Dir,Dir[]>)[h];}
function local(m:Maze,r:RobotState){const rank=new Map(leftFirst(r.heading).map((d,i)=>[d,i]));return senseLocal(m,r.pos).sort((a,b)=>rank.get(a.dir)!-rank.get(b.dir)!);}
function visitEdge(r:RobotState,a:Cell,b:Cell){const k=edge(a,b);r.edgeTraversals.set(k,Math.min(2,(r.edgeTraversals.get(k)??0)+1) as 0|1|2);}
function discoverCheckpoint(m:Maze,r:RobotState){const k=key(r.pos);if(m.checkpoints.has(k))r.discoveredCheckpoints.add(k);}

/** Trémaux-style exploration: prefer untraversed edges, then once-traversed edges, never >2. Stop Dry Run as soon as END is sensed. */
export function buildDryTrace(m:Maze,start:Cell):DryRunResult{
 const r=createRobot(start);r.mode="dry";r.status="Exploring from local sensors";discoverAt(m,r);discoverCheckpoint(m,r);
 const trace:Cell[]=[{...start}],stack:Cell[]=[{...start}];let backtracks=0,firstEndIndex=-1;
 while(stack.length){const current=stack[stack.length-1];r.pos={...current};discoverAt(m,r);discoverCheckpoint(m,r);const exits=local(m,r);
  if(exits.length>2){const j=r.junctions.find(x=>same(x.position,current));if(j)j.exits=exits.map(x=>x.dir);else r.junctions.push({position:{...current},exits:exits.map(x=>x.dir),visited:true});}
  if(isEndZoneCell(m,current)){firstEndIndex=trace.length-1;r.led=true;break;}
  const next=exits.map(e=>({...e,t:r.edgeTraversals.get(edge(current,e.cell))??0})).filter(e=>e.t<2).sort((a,b)=>a.t-b.t)[0];
  if(!next){stack.pop();if(!stack.length)break;const parent=stack[stack.length-1];visitEdge(r,current,parent);trace.push({...parent});backtracks++;r.pos={...parent};r.heading=dir(current,parent);discoverAt(m,r);discoverCheckpoint(m,r);continue;}
  const nextCell={...next.cell};visitEdge(r,current,nextCell);r.heading=next.dir;trace.push(nextCell);r.pos=nextCell;discoverAt(m,r);discoverCheckpoint(m,r);
  if(isEndZoneCell(m,nextCell)){firstEndIndex=trace.length-1;r.led=true;break;}
  if(!stack.some(c=>same(c,nextCell)))stack.push(nextCell);
 }
 return {trace,known:{cells:new Set(r.known.cells),edges:new Set(r.known.edges)},endReached:firstEndIndex>=0,backtracks,firstEndIndex,discoveredCheckpoints:new Set(r.discoveredCheckpoints),junctions:r.junctions.map(j=>({...j,position:{...j.position},exits:[...j.exits]})),edgeTraversals:new Map(r.edgeTraversals)};
}
function parse(v:string):Cell{const[x,y]=v.split(",").map(Number);return{x,y};}
export function shortestKnownRoute(g:KnownGraph,start:Cell,end:Cell):Cell[]{const q=[{...start}],prev=new Map<string,Cell|null>([[key(start),null]]);while(q.length){const c=q.shift()!;if(same(c,end))break;for(const e of g.edges){const[a,b]=e.split("|");const ck=key(c),n=a===ck?parse(b):b===ck?parse(a):null;if(n&&!prev.has(key(n))){prev.set(key(n),c);q.push(n);}}}if(!prev.has(key(end)))return[];const out:Cell[]=[];let c:Cell|null={...end};while(c){out.push(c);c=prev.get(key(c))??null;}return out.reverse();}
export function simplifyTurns(route:Cell[]):string[]{const out:string[]=[];for(let i=1;i<route.length-1;i++){const a=dir(route[i-1],route[i]),b=dir(route[i],route[i+1]);out.push(b===a?"S":b===opposite(a)?"B":((a==="N"&&b==="W")||(a==="W"&&b==="S")||(a==="S"&&b==="E")||(a==="E"&&b==="N"))?"L":"R");}return out;}
export function followStoredRoute(r:RobotState,route:Cell[],cursor:number):RobotState{const i=Math.max(0,Math.min(cursor,route.length-1));const n={...r,pos:{...route[i]},mode:"actual" as const,actualCursor:i,status:i>=route.length-1?"END reached":"Replaying stored route",led:i>=route.length-1};if(i>0)n.heading=dir(route[i-1],route[i]);return n;}
export function localSensorLabel(m:Maze,r:RobotState){return senseLocal(m,r.pos).map(s=>s.dir).join(" ")||"NONE";}
