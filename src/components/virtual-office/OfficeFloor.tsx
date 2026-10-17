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
/** Acoustic panels along each back wall (grid offsets) */
const PANEL_STARTS = [0.9, 3.1, 7.1, 9.3];
/** Marquee bulbs along the gold trim at the top of the walls */
const TRIM_BULBS = 22;
const GOLD = "#d4af37";
const GOLD_LIGHT = "#e8c872";

/** A rectangle on the left wall (gx = 0) between grid positions a..b and heights lo..hi */
const leftWallRect = (a: number, b: number, lo: number, hi: number) =>
  points(toScreen(0, b, lo), toScreen(0, a, lo), toScreen(0, a, hi), toScreen(0, b, hi));
/** The same on the right wall (gy = 0) */
const rightWallRect = (a: number, b: number, lo: number, hi: number) =>
  points(toScreen(a, 0, lo), toScreen(b, 0, lo), toScreen(b, 0, hi), toScreen(a, 0, hi));

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
          fill={(gx + gy) % 2 === 0 ? "#17151d" : "#141219"}
          stroke="#2b2633"
          strokeOpacity={0.7}
          strokeWidth={1}
        />,
      );
    }
  }

  const c = GRID / 2;
  const stage = (r: number) =>
    points(toScreen(c - r, c - r), toScreen(c + r, c - r), toScreen(c + r, c + r), toScreen(c - r, c + r));

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
          <stop offset="0%" stopColor="#2e0f30" />
          <stop offset="100%" stopColor="#141118" />
        </linearGradient>
        <linearGradient id="wall-right" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3d133d" />
          <stop offset="100%" stopColor="#17121b" />
        </linearGradient>
        <linearGradient id="panel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a0e2b" />
          <stop offset="100%" stopColor="#1a0c1c" />
        </linearGradient>
        <radialGradient id="stage-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={GOLD_LIGHT} stopOpacity={0.32} />
          <stop offset="60%" stopColor="#7b3a7e" stopOpacity={0.18} />
          <stop offset="100%" stopColor="#3d133d" stopOpacity={0.05} />
        </radialGradient>
        {/* Brightest where it lands on the stage, fading up into the rig */}
        <linearGradient id="spot-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff3cf" stopOpacity={0} />
          <stop offset="55%" stopColor="#fff3cf" stopOpacity={0.05} />
          <stop offset="100%" stopColor={GOLD_LIGHT} stopOpacity={0.26} />
        </linearGradient>
        <linearGradient id="side-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b26bb5" stopOpacity={0.16} />
          <stop offset="100%" stopColor="#7b3a7e" stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* Back walls */}
      <polygon
        points={points(toScreen(0, GRID), toScreen(0, 0), toScreen(0, 0, WALL_H), toScreen(0, GRID, WALL_H))}
        fill="url(#wall-left)"
      />
      <polygon
        points={points(toScreen(0, 0), toScreen(GRID, 0), toScreen(GRID, 0, WALL_H), toScreen(0, 0, WALL_H))}
        fill="url(#wall-right)"
      />
      {PANEL_STARTS.map((s) => (
        <g key={`panel-${s}`} stroke="#5a2a5c" strokeOpacity={0.6}>
          <polygon points={leftWallRect(s, s + 1.4, 22, 84)} fill="url(#panel)" />
          <polygon points={rightWallRect(s, s + 1.4, 22, 84)} fill="url(#panel)" />
        </g>
      ))}
      {/* Gold trim along the top of the walls */}
      <polyline
        points={points(toScreen(0, GRID, WALL_H), toScreen(0, 0, WALL_H), toScreen(GRID, 0, WALL_H))}
        fill="none"
        stroke={GOLD}
        strokeOpacity={0.75}
        strokeWidth={2.5}
      />
      {Array.from({ length: TRIM_BULBS }, (_, i) => {
        const t = ((i % (TRIM_BULBS / 2)) + 0.5) * ((GRID * 2) / TRIM_BULBS);
        const p = i < TRIM_BULBS / 2 ? toScreen(0, t, WALL_H) : toScreen(t, 0, WALL_H);
        return (
          <motion.circle
            key={`trim-${i}`}
            cx={p.x}
            cy={p.y}
            r={2.6}
            fill="#fff6dc"
            style={{ filter: `drop-shadow(0 0 4px ${GOLD_LIGHT})` }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2.8, repeat: Infinity, delay: (i % 7) * 0.4 }}
          />
        );
      })}

      {/* Floor slab edges */}
      <polygon
        points={points(toScreen(0, GRID), toScreen(GRID, GRID), toScreen(GRID, GRID, -FLOOR_DEPTH), toScreen(0, GRID, -FLOOR_DEPTH))}
        fill="#0d0b10"
      />
      <polygon
        points={points(toScreen(GRID, GRID), toScreen(GRID, 0), toScreen(GRID, 0, -FLOOR_DEPTH), toScreen(GRID, GRID, -FLOOR_DEPTH))}
        fill="#09080c"
      />

      {tiles}

      {/* Soft side beams from the lighting rig */}
      <polygon points={`${STAGE_W * 0.12},0 ${STAGE_W * 0.2},0 ${CENTER.x - 60},${CENTER.y + 40} ${CENTER.x - 260},${CENTER.y + 40}`} fill="url(#side-beam)" />
      <polygon points={`${STAGE_W * 0.8},0 ${STAGE_W * 0.88},0 ${CENTER.x + 260},${CENTER.y + 40} ${CENTER.x + 60},${CENTER.y + 40}`} fill="url(#side-beam)" />

      {/* The director's stage in the middle */}
      <polygon points={stage(2.1)} fill="url(#stage-glow)" />
      <polygon points={stage(2.1)} fill="none" stroke={GOLD} strokeOpacity={0.7} strokeWidth={2} />
      <polygon points={stage(1.75)} fill="none" stroke={GOLD} strokeOpacity={0.3} strokeWidth={1} strokeDasharray="2 6" />
      {/* Marquee bulbs around the stage edge */}
      {[0, 1, 2, 3].flatMap((side) =>
        Array.from({ length: 9 }, (_, i) => {
          const t = -2.1 + (i * 4.2) / 8;
          const [gx, gy] = [
            [c + t, c - 2.1],
            [c + 2.1, c + t],
            [c - t, c + 2.1],
            [c - 2.1, c - t],
          ][side];
          const p = toScreen(gx, gy);
          return (
            <motion.circle
              key={`bulb-${side}-${i}`}
              cx={p.x}
              cy={p.y}
              r={2.4}
              fill="#fff6dc"
              style={{ filter: `drop-shadow(0 0 3px ${GOLD_LIGHT})` }}
              animate={{ opacity: [0.35, 1, 0.35] }}
              transition={{ duration: 2.4, repeat: Infinity, delay: ((side * 9 + i) % 6) * 0.4 }}
            />
          );
        }),
      )}
      {/* Spotlight on the director */}
      <polygon
        points={`${CENTER.x - 14},0 ${CENTER.x + 14},0 ${CENTER.x + 130},${CENTER.y + 30} ${CENTER.x - 130},${CENTER.y + 30}`}
        fill="url(#spot-beam)"
      />

      {/* Team ring */}
      <ellipse
        cx={CENTER.x}
        cy={CENTER.y}
        rx={RING_RX}
        ry={RING_RY}
        fill="none"
        stroke={GOLD}
        strokeOpacity={0.18}
        strokeWidth={1.5}
        strokeDasharray="3 11"
      />

      {/* Director -> agent cues */}
      {links.map(({ id, to, status }) => {
        const color = status === "waiting" ? "#3a3346" : STATUS_META[status].color;
        return (
          <g key={id}>
            <motion.line
              x1={CENTER.x}
              y1={CENTER.y}
              x2={to.x}
              y2={to.y}
              stroke={color}
              strokeWidth={status === "waiting" ? 1.5 : 2.5}
              strokeOpacity={status === "waiting" ? 0.6 : 0.85}
              strokeDasharray="8 8"
              strokeLinecap="round"
              animate={status === "working" ? { strokeDashoffset: [0, -32] } : { strokeDashoffset: 0 }}
              transition={
                status === "working" ? { duration: 0.8, repeat: Infinity, ease: "linear" } : { duration: 0.3 }
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
