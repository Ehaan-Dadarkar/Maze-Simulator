import { Cell, Dir, DIRS, add, key, same } from "../types/maze";

export type Maze = { size:number; roads:Set<string>; start:Cell; end:Cell; checkpoints:Set<string>; referenceShortest:Cell[] };
export type SensorExit = { dir:Dir; cell:Cell };

export function makeMaze(size=23):Maze{return{size,roads:new Set(),start:{x:20,y:18},end:{x:5,y:18},checkpoints:new Set(),referenceShortest:[]};}
export function cloneMaze(m:Maze):Maze{return{...m,roads:new Set(m.roads),start:{...m.start},end:{...m.end},checkpoints:new Set(m.checkpoints),referenceShortest:m.referenceShortest.map(c=>({...c}))};}
export function inBounds(m:Maze,c:Cell){return c.x>=0&&c.y>=0&&c.x<m.size&&c.y<m.size;}
export function has(m:Maze,c:Cell){return inBounds(m,c)&&m.roads.has(key(c));}
export function setRoad(m:Maze,c:Cell,enabled:boolean){if(!inBounds(m,c))return;if(enabled)m.roads.add(key(c));else m.roads.delete(key(c));}
export function drawSegment(m:Maze,a:Cell,b:Cell){let x=a.x,y=a.y;const dx=Math.sign(b.x-a.x),dy=Math.sign(b.y-a.y);m.roads.add(key({x,y}));while(x!==b.x||y!==b.y){x+=dx;y+=dy;if(inBounds(m,{x,y}))m.roads.add(key({x,y}));}}
export function neighbours(m:Maze,c:Cell):SensorExit[]{return DIRS.map(dir=>({dir,cell:add(c,dir)})).filter(({cell})=>has(m,cell));}
export function senseLocal(m:Maze,c:Cell){return neighbours(m,c);}

/** The supplied reference has a 4 x 4 END box at columns 4–7 and rows 17–20. */
export function endZoneCells(m:Maze):Set<string>{const z=new Set<string>();const minX=Math.max(0,m.end.x-1),minY=Math.max(0,m.end.y-1);for(let y=minY;y<=Math.min(m.size-1,minY+3);y++)for(let x=minX;x<=Math.min(m.size-1,minX+3);x++)z.add(key({x,y}));return z;}
export function isEndZone(m:Maze,c:Cell){return isEndZoneCell(m,c);}
export function isEndZoneCell(m:Maze,c:Cell){return endZoneCells(m).has(key(c));}
export function shortestPathToEndZone(m:Maze,start:Cell):Cell[]{const targets=endZoneCells(m),q:Cell[]=[{...start}],prev=new Map<string,Cell|null>([[key(start),null]]);if(targets.has(key(start)))return[{...start}];let target:Cell|null=null;while(q.length){const c=q.shift()!;for(const {cell}of neighbours(m,c)){const k=key(cell);if(prev.has(k))continue;prev.set(k,c);if(targets.has(k)){target=cell;q.length=0;break;}q.push(cell);}}return target?reconstructPath(prev,target):[];}
function reconstructPath(prev:Map<string,Cell|null>,target:Cell):Cell[]{const out:Cell[]=[];let c:Cell|null={...target};while(c){out.push(c);c=prev.get(key(c))??null;}return out.reverse();}

/** Exact 23x23 road mask traced from the supplied Robo testing reference image. */
export function sampleTwoPath():Maze{const m=makeMaze();const rows=[
".......................",
".#####################.",
".#...#..#..#..#......#.",
".#...#..#..#..#......#.",
".#...#..#..#..########.",
".#####..####..#..#...#.",
".....#.....#..#..#...#.",
".....#.....#..#..#####.",
".....#.....#..#......#.",
".###########.........#.",
"....#..#.............#.",
"....#..#.............#.",
"....#..#####....######.",
"....#..#...........#...",
".####..#...........#...",
".#.............#######.",
".#.............#..#....",
".#....####.....#..#....",
".#....####........###..",
".#########........#....",
"......####........#....",
".......................",
"......................."];rows.forEach((row,y)=>[...row].forEach((v,x)=>{if(v==="#"&&inBounds(m,{x,y}))m.roads.add(key({x,y}));}));m.roads.add(key(m.start));return m;}
export function connected(m:Maze){return has(m,m.start)&&shortestPathToEndZone(m,m.start).length>0;}
export function shortestPath(m:Maze,a:Cell,b:Cell,allowed?:Set<string>):Cell[]{const q:Cell[]=[{...a}],prev=new Map<string,Cell|null>([[key(a),null]]);while(q.length){const c=q.shift()!;if(same(c,b))break;for(const {cell}of neighbours(m,c)){const k=key(cell);if(allowed&&!allowed.has(k))continue;if(!prev.has(k)){prev.set(k,c);q.push(cell);}}}return prev.has(key(b))?reconstructPath(prev,b):[];}
