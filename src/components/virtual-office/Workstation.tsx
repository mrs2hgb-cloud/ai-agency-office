"use client";

import { AnimatePresence, motion, type TargetAndTransition } from "framer-motion";
import { Check, Hourglass, LoaderCircle } from "lucide-react";
import type { AgentActivity } from "@/lib/agents/shared";
import { STATUS_META } from "./data";
import type { AgentConfig, AgentStatus } from "./types";

interface WorkstationProps {
  agent: AgentConfig;
  status: AgentStatus;
  x: number;
  y: number;
  isCeo?: boolean;
  /** External tool in use: its icon replaces the role icon above the head */
  activity?: AgentActivity;
  onClick?: () => void;
}

const BODY_ANIMATION: Record<AgentStatus, TargetAndTransition> = {
  waiting: { y: [0, -1.5, 0], transition: { duration: 3, repeat: Infinity, ease: "easeInOut" } },
  working: { y: [0, -2, 0], transition: { duration: 0.45, repeat: Infinity, ease: "easeInOut" } },
  done: { y: [0, -14, 0, -5, 0], transition: { duration: 0.7, ease: "easeOut" } },
};

const HEAD_ANIMATION: Record<AgentStatus, TargetAndTransition> = {
  waiting: { rotate: [0, -6, 0, 6, 0], transition: { duration: 6, repeat: Infinity, ease: "easeInOut" } },
  working: { rotate: [-2, 2, -2], transition: { duration: 0.9, repeat: Infinity } },
  done: { rotate: 0 },
};

const STATUS_ICON = { waiting: Hourglass, working: LoaderCircle, done: Check };

const GOLD = "#d4af37";
const GOLD_LIGHT = "#e8c872";

/**
 * A single desk + character. Everything is positioned relative to the
 * anchor point (x, y), which is the center of the desk top.
 */
export function Workstation({ agent, status, x, y, isCeo, activity, onClick }: WorkstationProps) {
  const meta = STATUS_META[status];
  const Icon = agent.icon;
  const StatusIcon = STATUS_ICON[status];
  const awaitingApproval = Boolean(activity?.awaitingApproval);

  return (
    <div className="absolute" style={{ left: x, top: y, zIndex: Math.round(y) }}>
      <div style={{ transform: isCeo ? "scale(1.15)" : undefined }}>
        <motion.button
          type="button"
          onClick={onClick}
          title={`${agent.name} · ${meta.label}${activity ? ` – ${activity.label}` : status === "working" ? ` – ${agent.task}` : ""}`}
          aria-label={`${agent.name}: ${meta.label}`}
          className="group relative block h-0 w-0 cursor-pointer outline-none"
          whileHover={{ y: -4 }}
          whileTap={{ scale: 0.97 }}
        >
          {/* Floor pool of light: plum at rest, the status color while active, pulsing gold on hold */}
          <motion.div
            className="pointer-events-none absolute rounded-[50%] blur-md"
            style={{
              left: awaitingApproval ? -100 : -78,
              top: awaitingApproval ? -6 : 2,
              width: awaitingApproval ? 200 : 156,
              height: awaitingApproval ? 90 : 72,
              background: awaitingApproval
                ? `radial-gradient(ellipse, ${GOLD_LIGHT}aa, ${GOLD}33 60%, transparent 75%)`
                : status === "waiting"
                  ? "radial-gradient(ellipse, rgba(74,26,76,0.55), rgba(0,0,0,0.35) 70%)"
                  : `${meta.color}44`,
            }}
            animate={
              awaitingApproval
                ? { opacity: [0.55, 1, 0.55], scale: [0.95, 1.06, 0.95] }
                : status === "working"
                  ? { opacity: [0.5, 1, 0.5] }
                  : { opacity: 1 }
            }
            transition={awaitingApproval || status === "working" ? { duration: 1.4, repeat: Infinity } : undefined}
          />

          {/* Studio rim light behind the character */}
          <div
            className="pointer-events-none absolute left-[-58px] top-[-128px] h-[120px] w-[116px] rounded-full blur-lg"
            style={{
              background: `radial-gradient(circle at 50% 62%, ${
                awaitingApproval ? `${GOLD_LIGHT}80` : status === "working" ? `${GOLD_LIGHT}40` : "rgba(123,58,126,0.5)"
              }, transparent 68%)`,
            }}
          />

          {/* Character */}
          <motion.div
            key={`body-${status}`}
            className="absolute left-[-26px] top-[-92px] h-[74px] w-[52px]"
            animate={BODY_ANIMATION[status]}
          >
            <div
              className="absolute left-[3px] top-[28px] h-[46px] w-[46px] rounded-t-[20px] shadow-inner"
              style={{ background: `linear-gradient(160deg, ${agent.color}, ${agent.color}aa)` }}
            >
              <div
                className="absolute left-1/2 top-0 h-[10px] w-[14px] -translate-x-1/2 rounded-b-full"
                style={{ background: agent.skin }}
              />
              {isCeo && (
                <div className="absolute left-1/2 top-[8px] h-[18px] w-[5px] -translate-x-1/2 rounded-b-sm bg-ink" />
              )}
            </div>
            <motion.div
              className="absolute left-[11px] top-0 h-[30px] w-[30px] rounded-full"
              style={{ background: agent.skin }}
              animate={HEAD_ANIMATION[status]}
            >
              <div className="absolute inset-x-0 top-0 h-[13px] rounded-t-full" style={{ background: agent.hair }} />
              <div className="absolute left-[8px] top-[15px] h-[3px] w-[3px] rounded-full bg-slate-900" />
              <div className="absolute right-[8px] top-[15px] h-[3px] w-[3px] rounded-full bg-slate-900" />
              {status === "done" && (
                <div className="absolute left-1/2 top-[19px] h-[5px] w-[10px] -translate-x-1/2 rounded-b-full border-b-2 border-slate-900" />
              )}
            </motion.div>
          </motion.div>

          {/* Desk */}
          <Desk isCeo={isCeo} statusColor={meta.color} active={status !== "waiting"} />

          {/* Hands on the keyboard */}
          {[-16, 6].map((hx, i) => (
            <motion.div
              key={hx}
              className="absolute h-[9px] w-[9px] rounded-full shadow"
              style={{ left: hx, top: -26, background: agent.skin }}
              animate={status === "working" ? { y: [0, -3, 0] } : { y: 0 }}
              transition={status === "working" ? { duration: 0.25, repeat: Infinity, delay: i * 0.12 } : undefined}
            />
          ))}

          {/* Icon bubble above the head */}
          <motion.div
            className="absolute left-[-22px] top-[-152px] h-[44px] w-[44px]"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          >
            {awaitingApproval ? (
              <motion.div
                className="absolute -inset-[6px] rounded-full border-[3px] border-gold-light"
                animate={{ scale: [1, 1.15, 1], opacity: [1, 0.55, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                style={{ boxShadow: `0 0 22px ${GOLD_LIGHT}, 0 0 44px ${GOLD}66` }}
              />
            ) : status === "working" ? (
              <motion.div
                className="absolute -inset-[5px] rounded-full border-[3px] border-transparent border-t-gold-light border-r-gold"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
            ) : (
              <div
                className="absolute -inset-[5px] rounded-full border-2"
                style={{
                  borderColor: meta.color,
                  borderStyle: status === "waiting" ? "dashed" : "solid",
                  boxShadow: status === "done" ? `0 0 16px ${meta.color}` : undefined,
                }}
              />
            )}
            <div
              className="relative grid h-full w-full place-items-center rounded-full shadow-lg ring-1 ring-white/20"
              style={{
                background: `linear-gradient(145deg, ${agent.color}, ${agent.color}99)`,
                opacity: status === "waiting" ? 0.75 : 1,
              }}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {activity ? (
                  <motion.span
                    key={activity.icon}
                    className="text-[22px] leading-none drop-shadow"
                    initial={{ scale: 0, rotate: -30 }}
                    animate={
                      awaitingApproval
                        ? { scale: [1, 1.12, 1], rotate: 0, opacity: [1, 0.45, 1] }
                        : { scale: 1, rotate: 0 }
                    }
                    exit={{ scale: 0 }}
                    transition={
                      awaitingApproval
                        ? { duration: 1, repeat: Infinity }
                        : { type: "spring", stiffness: 420, damping: 18 }
                    }
                  >
                    {activity.icon}
                  </motion.span>
                ) : (
                  <motion.span key="role" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                    <Icon className="h-5 w-5 text-white drop-shadow" strokeWidth={2.2} />
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <div
              className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-[6px] border-t-[7px] border-x-transparent"
              style={{ borderTopColor: agent.color }}
            />
            <AnimatePresence mode="popLayout">
              <motion.div
                key={status}
                className="absolute -bottom-1 -right-1 grid h-[19px] w-[19px] place-items-center rounded-full ring-2 ring-ink"
                style={{ background: meta.color }}
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
              >
                <StatusIcon
                  className={`h-[11px] w-[11px] text-ink ${status === "working" ? "animate-spin" : ""}`}
                  strokeWidth={3}
                />
              </motion.div>
            </AnimatePresence>
            {status === "done" && <Burst color={meta.color} />}

            {/* What the external tool is doing */}
            <AnimatePresence>
              {activity && (
                <motion.div
                  key={activity.label}
                  dir="rtl"
                  className={`absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-semibold shadow-lg ${
                    activity.awaitingApproval
                      ? "bg-gradient-to-l from-gold to-gold-light text-ink shadow-gold/40"
                      : "border border-plum-light bg-ink/90 text-gold-pale"
                  }`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                >
                  {activity.label}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Name tag */}
          <div dir="rtl" className="absolute left-0 top-[54px] flex -translate-x-1/2 flex-col items-center gap-1">
            <div
              className={`flex items-center gap-2 whitespace-nowrap rounded-full border bg-ink/90 px-3 py-1 text-[13px] font-semibold text-white shadow-lg shadow-black/50 transition-colors group-hover:border-gold/60 group-focus-visible:ring-2 group-focus-visible:ring-gold-light ${
                isCeo ? "border-gold/70" : "border-plum-light"
              }`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: agent.color }} />
              {agent.name}
              {agent.role && <span className="text-[11px] font-medium text-gold-light">· {agent.role}</span>}
              <span className="h-3 w-px bg-white/15" />
              <span className="flex items-center gap-1 text-xs font-medium" style={{ color: meta.color }}>
                <motion.span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: meta.color }}
                  animate={status === "working" ? { opacity: [1, 0.2, 1] } : { opacity: 1 }}
                  transition={status === "working" ? { duration: 1, repeat: Infinity } : undefined}
                />
                {meta.label}
              </span>
            </div>
            {agent.badges && (
              <div className="flex gap-1">
                {agent.badges.map((badge) => (
                  <span
                    key={badge}
                    className="whitespace-nowrap rounded-full border border-gold/30 bg-plum/80 px-1.5 py-px text-[10px] font-medium text-gold-pale"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            )}
          </div>
        </motion.button>
      </div>
    </div>
  );
}

function Desk({ isCeo, statusColor, active }: { isCeo?: boolean; statusColor: string; active: boolean }) {
  const top = isCeo ? "#4a1a4c" : "#2a2532";
  const left = isCeo ? "#3d133d" : "#1d1a24";
  const right = isCeo ? "#2a0e2b" : "#15131b";

  return (
    <svg
      className="pointer-events-none absolute left-[-66px] top-[-33px] overflow-visible"
      width={132}
      height={96}
      viewBox="0 0 132 96"
    >
      <polygon points="6,33 66,63 66,85 6,55" fill={left} />
      <polygon points="66,63 126,33 126,55 66,85" fill={right} />
      <polygon points="66,3 126,33 66,63 6,33" fill={top} stroke={GOLD} strokeOpacity={isCeo ? 0.8 : 0.28} />
      <polyline
        points="6,33 66,63 126,33"
        fill="none"
        stroke={GOLD}
        strokeOpacity={isCeo ? 0.9 : 0.35}
        strokeWidth={1.2}
      />

      {isCeo ? (
        /* Clapperboard */
        <g transform="translate(20 22)">
          <rect x={0} y={6} width={20} height={13} rx={1} fill="#0d0c11" stroke={GOLD} strokeWidth={0.8} />
          <g transform="rotate(-14 0 6)">
            <rect x={0} y={1} width={20} height={5} fill="#0d0c11" stroke={GOLD} strokeWidth={0.8} />
            {[2, 7, 12, 17].map((sx) => (
              <polygon key={sx} points={`${sx},1 ${sx + 2.5},1 ${sx + 0.5},6 ${sx - 2},6`} fill="#f6e7b8" />
            ))}
          </g>
        </g>
      ) : (
        /* Mug */
        <>
          <ellipse cx={30} cy={36} rx={5} ry={2.5} fill="#e8dfd0" />
          <rect x={25} y={28} width={10} height={8} fill="#e8dfd0" />
          <ellipse cx={30} cy={28} rx={5} ry={2.5} fill="#4a2a1a" />
        </>
      )}

      {/* Laptop (back side facing the viewer) */}
      <polygon points="80,40 102,29 102,12 80,23" fill="#0d0c11" stroke={GOLD} strokeOpacity={0.35} />
      <circle
        cx={91}
        cy={26}
        r={3}
        fill={active ? statusColor : "#4a4452"}
        style={active ? { filter: `drop-shadow(0 0 4px ${statusColor})` } : undefined}
      />
    </svg>
  );
}

function Burst({ color }: { color: string }) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2">
      {Array.from({ length: 10 }, (_, i) => {
        const angle = (i / 10) * Math.PI * 2;
        return (
          <motion.span
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full"
            style={{ background: i % 2 ? color : "#fde68a" }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(angle) * 46, y: Math.sin(angle) * 46, opacity: 0, scale: 0.4 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
        );
      })}
    </div>
  );
}
