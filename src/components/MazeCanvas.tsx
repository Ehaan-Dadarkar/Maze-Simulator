import React,{useRef}from"react";
import {Maze,endZoneCells}from"../engine/maze";
import {RobotState}from"../engine/robot";
import {Cell,key}from"../types/maze";
type Tool="none"|"draw"|"erase"|"start"|"end";
type Props={maze:Maze;robot:RobotState;tool:Tool;onEdit:(cell:Cell)=>void;observerMode?:boolean};
export default function MazeCanvas({maze,robot,tool,onEdit}:Props){
 const lastCell=useRef<string|null>(null),n=maze.size,size=760,cell=size/n;
 const trace=new Set(robot.trace.map(key)),route=new Set(robot.route.map(key)),benchmark=new Set(maze.referenceShortest.map(key)),endZone=endZoneCells(maze);
 const cellFromPointer=(e:React.PointerEvent<SVGSVGElement>):Cell|null=>{const r=e.currentTarget.getBoundingClientRect(),x=Math.floor(((e.clientX-r.left)/r.width)*n),y=Math.floor(((e.clientY-r.top)/r.height)*n);return x<0||y<0||x>=n||y>=n?null:{x,y}};
 const paint=(e:React.PointerEvent<SVGSVGElement>)=>{if(tool==="none")return;const c=cellFromPointer(e);if(!c)return;const k=key(c);if(k===lastCell.current&&tool!=="start"&&tool!=="end")return;lastCell.current=k;onEdit(c)};
 return <div className="maze-shell"><svg viewBox={`0 0 ${size} ${size}`} className={`maze-canvas ${tool==="none"?"maze-locked":""}`} aria-label="Autonomous robot maze arena" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);lastCell.current=null;paint(e)}} onPointerMove={e=>{if(e.buttons&1)paint(e)}} onPointerUp={()=>{lastCell.current=null}} onPointerCancel={()=>{lastCell.current=null}}>
 <rect width={size} height={size} fill="#07090d"/>
 {Array.from({length:n+1},(_,i)=><React.Fragment key={i}><line x1={i*cell} y1="0" x2={i*cell} y2={size} className="grid-line"/><line x1="0" y1={i*cell} x2={size} y2={i*cell} className="grid-line"/></React.Fragment>)}
 {[...benchmark].map(k=>{const[x,y]=k.split(",").map(Number);return <rect key={`benchmark-${k}`} x={x*cell+cell*.28} y={y*cell+cell*.28} width={cell*.44} height={cell*.44} rx="2" className="benchmark-road"/>})}
 {[...maze.roads].map(k=>{const[x,y]=k.split(",").map(Number),cls=route.has(k)?"road route-road":trace.has(k)?"road trace-road":"road";return <rect key={k} x={x*cell+cell*.17} y={y*cell+cell*.17} width={cell*.66} height={cell*.66} rx="3" className={cls}/>})}
 {[...endZone].map(k=>{const[x,y]=k.split(",").map(Number);return <rect key={`end-zone-${k}`} x={x*cell+cell*.06} y={y*cell+cell*.06} width={cell*.88} height={cell*.88} className="end-zone"/>})}
 {[...maze.checkpoints].map(k=>{const[x,y]=k.split(",").map(Number);return <circle key={`checkpoint-${k}`} cx={(x+.5)*cell} cy={(y+.5)*cell} r={cell*.12} className="checkpoint-marker"/>})}
 <circle cx={(maze.start.x+.5)*cell} cy={(maze.start.y+.5)*cell} r={cell*.31} className="start-marker"/><text x={(maze.start.x+.5)*cell} y={(maze.start.y+.5)*cell+4} className="marker-text">S</text><text x={(maze.end.x+.5)*cell} y={(maze.end.y+.5)*cell+4} className="end-label">END</text>
 <circle cx={(robot.pos.x+.5)*cell} cy={(robot.pos.y+.5)*cell} r={cell*.25} className="robot-marker"/><text x={(robot.pos.x+.5)*cell} y={(robot.pos.y+.5)*cell+3} className="robot-text">R</text>
 </svg></div>;
}
