"use client";

import { motion } from "framer-motion";
import { STATUS_META } from "./data";
import {
  CENTER,
  GRID,
  RING_RX,
  RING_RY,
  STAGE_H,
  STAGE_W,
  WALL_H,
  points,
  toScreen,
  type Point,
} from "./geometry";
import type { AgentStatus } from "./types";

interface Link {
  id: string;
  to: Point;
  status: AgentStatus;
}

const FLOOR_DEPTH = 16;
const WINDOW_STARTS = [1.4, 4.7, 8];

export function OfficeFloor({ links }: { links: Link[] }) {
  const tiles = [];
  for (let gx = 0; gx < GRID; gx++) {
    for (let gy = 0; gy < GRID; gy++) {
      tiles.push(
        <polygon
          key={`${gx}-${gy}`}
          points={points(
            toScreen(gx, gy),
            toScreen(gx + 1, gy),
            toScreen(gx + 1, gy + 1),
            toScreen(gx, gy + 1),
          )}
          fill={(gx + gy) % 2 === 0 ? "#1e293b" : "#1a2335"}
          stroke="#334155"
          strokeOpacity={0.45}
          strokeWidth={1}
        />,
      );
    }
  }

  const c = GRID / 2;
  const rugR = 1.9;

  return (
    <svg
      className="absolute inset-0"
      width={STAGE_W}
      height={STAGE_H}
      viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
      aria-hidden
    >
      <defs>
        <linearGradient id="wall-left" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e1b4b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="wall-right" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#272463" />
          <stop offset="100%" stopColor="#131c33" />
        </linearGradient>
        <linearGradient id="window" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#818cf8" stopOpacity={0.55} />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.15} />
        </linearGradient>
        <radialGradient id="rug" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.05} />
        </radialGradient>
      </defs>

      {/* Back walls */}
      <polygon
        points={points(
          toScreen(0, GRID),
          toScreen(0, 0),
          toScreen(0, 0, WALL_H),
          toScreen(0, GRID, WALL_H),
        )}
        fill="url(#wall-left)"
      />
      <polygon
        points={points(
          toScreen(0, 0),
          toScreen(GRID, 0),
          toScreen(GRID, 0, WALL_H),
          toScreen(0, 0, WALL_H),
        )}
        fill="url(#wall-right)"
      />
      {WINDOW_STARTS.map((s) => (
        <g key={s}>
          <polygon
            points={points(
              toScreen(0, s + 1.8, 28),
              toScreen(0, s, 28),
              toScreen(0, s, 82),
              toScreen(0, s + 1.8, 82),
            )}
            fill="url(#window)"
            stroke="#a5b4fc"
            strokeOpacity={0.3}
          />
          <polygon
            points={points(
              toScreen(s, 0, 28),
              toScreen(s + 1.8, 0, 28),
              toScreen(s + 1.8, 0, 82),
              toScreen(s, 0, 82),
            )}
            fill="url(#window)"
            stroke="#a5b4fc"
            strokeOpacity={0.3}
          />
        </g>
      ))}
      <polyline
        points={points(
          toScreen(0, GRID, WALL_H),
          toScreen(0, 0, WALL_H),
          toScreen(GRID, 0, WALL_H),
        )}
        fill="none"
        stroke="#6366f1"
        strokeOpacity={0.5}
        strokeWidth={2}
      />

      {/* Floor slab edges */}
      <polygon
        points={points(
          toScreen(0, GRID),
          toScreen(GRID, GRID),
          toScreen(GRID, GRID, -FLOOR_DEPTH),
          toScreen(0, GRID, -FLOOR_DEPTH),
        )}
        fill="#0b1222"
      />
      <polygon
        points={points(
          toScreen(GRID, GRID),
          toScreen(GRID, 0),
          toScreen(GRID, 0, -FLOOR_DEPTH),
          toScreen(GRID, GRID, -FLOOR_DEPTH),
        )}
        fill="#070d19"
      />

      {tiles}

      {/* CEO rug */}
      <polygon
        points={points(
          toScreen(c - rugR, c - rugR),
          toScreen(c + rugR, c - rugR),
          toScreen(c + rugR, c + rugR),
          toScreen(c - rugR, c + rugR),
        )}
        fill="url(#rug)"
        stroke="#f59e0b"
        strokeOpacity={0.5}
        strokeWidth={1.5}
      />

      {/* Team ring */}
      <ellipse
        cx={CENTER.x}
        cy={CENTER.y}
        rx={RING_RX}
        ry={RING_RY}
        fill="none"
        stroke="#6366f1"
        strokeOpacity={0.25}
        strokeWidth={2}
        strokeDasharray="4 10"
      />

      {/* CEO -> agent links */}
      {links.map(({ id, to, status }) => {
        const color = status === "waiting" ? "#475569" : STATUS_META[status].color;
        return (
          <g key={id}>
            <motion.line
              x1={CENTER.x}
              y1={CENTER.y}
              x2={to.x}
              y2={to.y}
              stroke={color}
              strokeWidth={status === "waiting" ? 1.5 : 2.5}
              strokeOpacity={status === "waiting" ? 0.5 : 0.8}
              strokeDasharray="8 8"
              strokeLinecap="round"
              animate={status === "working" ? { strokeDashoffset: [0, -32] } : { strokeDashoffset: 0 }}
              transition={
                status === "working"
                  ? { duration: 0.8, repeat: Infinity, ease: "linear" }
                  : { duration: 0.3 }
              }
            />
            {status === "working" && (
              <motion.circle
                r={5}
                fill={color}
                style={{ filter: `drop-shadow(0 0 6px ${color})` }}
                initial={{ cx: CENTER.x, cy: CENTER.y }}
                animate={{ cx: [CENTER.x, to.x], cy: [CENTER.y, to.y], opacity: [0, 1, 1, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
