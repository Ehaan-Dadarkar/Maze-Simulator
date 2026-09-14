# Meshmerize Autonomous Maze Robot Simulator

A browser simulator for the Meshmerize-style autonomous maze problem.

## Core rule

The **MAIN MAZE is hidden from the robot**. The robot begins with only its start cell. At each visited cell, the virtual sensors expose only the immediate N/E/S/W road exits. Those observations are added to the robot's own graph memory.

The robot never calls the hidden maze's shortest-path function while exploring or choosing its stored route.

## Modes

### Dry Run

1. Robot starts at START with an empty map.
2. It senses local exits and records observed edges.
3. It explores using deterministic DFS-style traversal with relative direction priority.
4. It stops when it first reaches END.
5. The route stored for the actual run is calculated from the robot's discovered graph only.

This intentionally models the information limit: if a shorter branch was never discovered before the first END, the robot cannot magically know it.

### Actual Run

The robot replays the route stored after the dry run. No hidden maze data is consulted.

## Custom maze editor

- **draw**: paint road cells; drag to draw
- **erase**: remove road cells
- **start**: move START
- **end**: move END
- **Robot View**: hides every cell/edge that the robot has not discovered

## Development

```bash
npm install
npm run dev
npm run build
```

The project is a Vite + React + TypeScript application and can be deployed directly to Vercel.
