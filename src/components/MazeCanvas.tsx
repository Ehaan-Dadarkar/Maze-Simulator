import React, { useRef } from "react";
import { Maze, endZoneCells } from "../engine/maze";
import { RobotState } from "../engine/robot";
import { Cell, key } from "../types/maze";

type Tool = "draw" | "erase" | "start" | "end";

type Props = {
  maze: Maze;
  robot: RobotState;
  tool: Tool;
  onEdit: (cell: Cell) => void;
  observerMode?: boolean;
};

export default function MazeCanvas({
  maze,
  robot,
  tool,
  onEdit,
  observerMode = false,
}: Props) {
  const lastCell = useRef<string | null>(null);
  const n = maze.size;
  const size = 760;
  const cell = size / n;
  const trace = new Set(robot.trace.map(key));
  const route = new Set(robot.route.map(key));
  const benchmark = new Set(maze.referenceShortest.map(key));
  const endZone = endZoneCells(maze);

  const cellFromPointer = (
    event: React.PointerEvent<SVGSVGElement>,
  ): Cell | null => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * n);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * n);
    if (x < 0 || y < 0 || x >= n || y >= n) return null;
    return { x, y };
  };

  const paint = (event: React.PointerEvent<SVGSVGElement>) => {
    const cellPosition = cellFromPointer(event);
    if (!cellPosition) return;
    const cellKey = key(cellPosition);
    if (
      cellKey === lastCell.current &&
      tool !== "start" &&
      tool !== "end"
    ) {
      return;
    }
    lastCell.current = cellKey;
    onEdit(cellPosition);
  };

  return (
    <div className="maze-shell">
      <div className="maze-hint">
        {observerMode
          ? "Observer benchmark is visual only. Robot receives local sensor data."
          : `Editor: ${tool}`}
      </div>

      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="maze-canvas"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          lastCell.current = null;
          paint(event);
        }}
        onPointerMove={(event) => {
          if (event.buttons & 1) paint(event);
        }}
        onPointerUp={() => {
          lastCell.current = null;
        }}
        onPointerCancel={() => {
          lastCell.current = null;
        }}
      >
        <rect width={size} height={size} fill="#07090d" />

        {Array.from({ length: n + 1 }, (_, index) => (
          <React.Fragment key={index}>
            <line
              x1={index * cell}
              y1="0"
              x2={index * cell}
              y2={size}
              className="grid-line"
            />
            <line
              x1="0"
              y1={index * cell}
              x2={size}
              y2={index * cell}
              className="grid-line"
            />
          </React.Fragment>
        ))}

        {observerMode &&
          [...benchmark].map((cellKey) => {
            const [x, y] = cellKey.split(",").map(Number);
            return (
              <rect
                key={`benchmark-${cellKey}`}
                x={x * cell + cell * 0.28}
                y={y * cell + cell * 0.28}
                width={cell * 0.44}
                height={cell * 0.44}
                rx="2"
                className="benchmark-road"
              />
            );
          })}

        {[...maze.roads].map((cellKey) => {
          const [x, y] = cellKey.split(",").map(Number);
          const isRoute = route.has(cellKey);
          const isTrace = trace.has(cellKey);
          return (
            <rect
              key={cellKey}
              x={x * cell + cell * 0.17}
              y={y * cell + cell * 0.17}
              width={cell * 0.66}
              height={cell * 0.66}
              rx="3"
              className={
                isRoute
                  ? "road route-road"
                  : isTrace
                    ? "road trace-road"
                    : "road"
              }
            />
          );
        })}

        {[...endZone].map((cellKey) => {
          const [x, y] = cellKey.split(",").map(Number);
          return (
            <rect
              key={`end-zone-${cellKey}`}
              x={x * cell + cell * 0.06}
              y={y * cell + cell * 0.06}
              width={cell * 0.88}
              height={cell * 0.88}
              className="end-zone"
            />
          );
        })}

        {[...maze.checkpoints].map((cellKey) => {
          const [x, y] = cellKey.split(",").map(Number);
          return (
            <circle
              key={`checkpoint-${cellKey}`}
              cx={(x + 0.5) * cell}
              cy={(y + 0.5) * cell}
              r={cell * 0.12}
              className="checkpoint-marker"
            />
          );
        })}

        <circle
          cx={(maze.start.x + 0.5) * cell}
          cy={(maze.start.y + 0.5) * cell}
          r={cell * 0.31}
          className="start-marker"
        />
        <text
          x={(maze.start.x + 0.5) * cell}
          y={(maze.start.y + 0.5) * cell + 4}
          className="marker-text"
        >
          S
        </text>

        <text
          x={(maze.end.x + 0.5) * cell}
          y={(maze.end.y + 0.5) * cell + 4}
          className="end-label"
        >
          END
        </text>

        <circle
          cx={(robot.pos.x + 0.5) * cell}
          cy={(robot.pos.y + 0.5) * cell}
          r={cell * 0.25}
          className="robot-marker"
        />
        <text
          x={(robot.pos.x + 0.5) * cell}
          y={(robot.pos.y + 0.5) * cell + 3}
          className="robot-text"
        >
          R
        </text>
      </svg>
    </div>
  );
}
