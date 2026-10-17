"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Activity, Play, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ALL_AGENTS, CEO, INITIAL_STATUSES, STATUS_META, STATUS_ORDER, TEAM } from "./data";
import { CENTER, STAGE_H, STAGE_W, ringPosition } from "./geometry";
import { OfficeFloor } from "./OfficeFloor";
import type { AgentActivity } from "@/lib/agents/shared";
import type { AgentConfig, AgentId, AgentStatus, AgentStatuses } from "./types";
import { Workstation } from "./Workstation";

interface LogEntry {
  id: number;
  text: string;
  status: AgentStatus;
  time: string;
  /** Tool icon for external-tool entries */
  icon?: string;
}

export interface VirtualOfficeProps {
  /** Pass statuses to control the office from outside. Omit for the built-in demo. */
  statuses?: Partial<AgentStatuses>;
  /** Live task titles per agent; replace the default role descriptions */
  tasks?: Partial<Record<AgentId, string>>;
  /** External tool each agent is using right now (icon above its head) */
  activities?: Partial<Record<AgentId, AgentActivity>>;
  onAgentClick?: (agent: AgentConfig, status: AgentStatus) => void;
  showControls?: boolean;
  subtitle?: string;
  /** Rendered between the header and the office stage */
  toolbar?: ReactNode;
}

const POSITIONS = TEAM.map((_, i) => ringPosition(i, TEAM.length));
const AGENT_BY_ID = Object.fromEntries(ALL_AGENTS.map((a) => [a.id, a])) as Record<AgentId, AgentConfig>;

export function VirtualOffice({
  statuses: controlled,
  tasks,
  activities = {},
  onAgentClick,
  showControls = true,
  subtitle = "לחצו על דמות כדי להחליף סטטוס, או הפעילו פרויקט לדוגמה.",
  toolbar,
}: VirtualOfficeProps) {
  const [internal, setInternal] = useState<AgentStatuses>(INITIAL_STATUSES);
  const [running, setRunning] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const statuses: AgentStatuses = { ...internal, ...controlled };
  const taskOf = (id: AgentId) => tasks?.[id] ?? AGENT_BY_ID[id].task;

  const { wrapRef, scale, offset, ready } = useStageScale();

  // Log status transitions and external tool use, whether they came from the
  // demo, a click, or a controlling parent. Derived during render on change.
  const activityKeys = Object.fromEntries(
    ALL_AGENTS.map((a) => [a.id, activities[a.id] ? `${activities[a.id]!.icon}${activities[a.id]!.label}` : ""]),
  ) as Record<AgentId, string>;
  const [logState, setLogState] = useState({ statuses, activityKeys, entries: [] as LogEntry[], seq: 0 });
  const statusChanged = ALL_AGENTS.filter((a) => statuses[a.id] !== logState.statuses[a.id]);
  const activityChanged = ALL_AGENTS.filter(
    (a) => activityKeys[a.id] && activityKeys[a.id] !== logState.activityKeys[a.id],
  );
  if (statusChanged.length || ALL_AGENTS.some((a) => activityKeys[a.id] !== logState.activityKeys[a.id])) {
    const time = new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    let seq = logState.seq;
    const statusEntries = statusChanged
      .filter((agent) => statuses[agent.id] !== "waiting")
      .map((agent): LogEntry => {
        const status = statuses[agent.id];
        const text =
          status === "working"
            ? `${agent.name} · ${taskOf(agent.id)}`
            : agent.id === "ceo"
              ? "המנכ״ל אישר – הפרויקט הושלם 🎉"
              : `${agent.name} · המשימה הושלמה`;
        return { id: ++seq, text, status, time };
      });
    const activityEntries = activityChanged.map((agent): LogEntry => {
      const activity = activities[agent.id]!;
      return { id: ++seq, text: `${agent.name} · ${activity.label}`, status: "working", time, icon: activity.icon };
    });
    const entries = [...statusEntries, ...activityEntries].reverse();
    setLogState({ statuses, activityKeys, entries: [...entries, ...logState.entries].slice(0, 8), seq });
  }
  const log = logState.entries;
  const clearLog = () => setLogState((prev) => ({ ...prev, entries: [] }));

  const setStatus = useCallback((id: AgentId, status: AgentStatus) => {
    setInternal((prev) => ({ ...prev, [id]: status }));
  }, []);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));

  useEffect(() => clearTimers, []);

  const reset = () => {
    clearTimers();
    setRunning(false);
    setInternal(INITIAL_STATUSES);
    clearLog();
  };

  const runProject = () => {
    reset();
    setRunning(true);
    setStatus("ceo", "working");

    let remaining = TEAM.length;
    TEAM.forEach((agent, i) => {
      const start = 1000 + i * 450;
      later(start, () => setStatus(agent.id, "working"));
      later(start + 2500 + Math.random() * 4000, () => {
        setStatus(agent.id, "done");
        if (--remaining === 0) {
          later(700, () => {
            setStatus("ceo", "done");
            setRunning(false);
          });
        }
      });
    });
  };

  const handleClick = (agent: AgentConfig) => {
    const current = statuses[agent.id];
    onAgentClick?.(agent, current);
    if (controlled?.[agent.id] !== undefined) return;
    const next = STATUS_ORDER[(STATUS_ORDER.indexOf(current) + 1) % STATUS_ORDER.length];
    setStatus(agent.id, next);
  };

  const counts = STATUS_ORDER.map((s) => ({
    status: s,
    count: ALL_AGENTS.filter((a) => statuses[a.id] === s).length,
  }));
  // With live tasks, only agents that were actually assigned work count toward progress
  const assigned = tasks ? TEAM.filter((a) => tasks[a.id]) : TEAM;
  const progress = assigned.length
    ? assigned.filter((a) => statuses[a.id] === "done").length / assigned.length
    : 0;

  return (
    <section dir="rtl" className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:py-10">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-1 text-sm font-medium text-indigo-300">סוכנות AI · מרחב עבודה</p>
          <h1 className="bg-gradient-to-l from-white via-indigo-100 to-indigo-300 bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl">
            המשרד הווירטואלי
          </h1>
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {counts.map(({ status, count }) => (
            <div
              key={status}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 backdrop-blur"
            >
              <span className="h-2 w-2 rounded-full" style={{ background: STATUS_META[status].color }} />
              {STATUS_META[status].label}
              <motion.span
                key={count}
                initial={{ y: -6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="min-w-4 text-center font-bold tabular-nums text-white"
              >
                {count}
              </motion.span>
            </div>
          ))}
          {showControls && (
            <>
              <motion.button
                type="button"
                onClick={runProject}
                disabled={running}
                whileHover={{ scale: running ? 1 : 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-l from-indigo-500 to-sky-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Play className="h-4 w-4" />
                {running ? "פרויקט בתהליך…" : "הפעל פרויקט"}
              </motion.button>
              <button
                type="button"
                onClick={reset}
                aria-label="איפוס"
                className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {toolbar}

      {/* Progress */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <motion.div
          className="h-full rounded-full bg-gradient-to-l from-emerald-400 to-sky-400"
          animate={{ width: `${progress * 100}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>

      {/* Stage */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-indigo-950/60 via-slate-950 to-slate-950 shadow-2xl shadow-black/50">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.18),transparent_60%)]" />
        <div ref={wrapRef} dir="ltr" className="relative w-full overflow-x-auto overflow-y-hidden">
          <div
            className="relative top-0 origin-top-left transition-opacity duration-500"
            style={{
              marginBottom: STAGE_H * (scale - 1),
              marginRight: STAGE_W * (scale - 1),
              left: offset,
              width: STAGE_W,
              height: STAGE_H,
              transform: `scale(${scale})`,
              opacity: ready ? 1 : 0,
            }}
          >
            <OfficeFloor
              links={TEAM.map((a, i) => ({ id: a.id, to: POSITIONS[i], status: statuses[a.id] }))}
            />
            <Workstation
              agent={{ ...CEO, task: taskOf("ceo") }}
              status={statuses.ceo}
              activity={activities.ceo}
              x={CENTER.x}
              y={CENTER.y}
              isCeo
              onClick={() => handleClick(CEO)}
            />
            {TEAM.map((agent, i) => (
              <Workstation
                key={agent.id}
                agent={{ ...agent, task: taskOf(agent.id) }}
                activity={activities[agent.id]}
                status={statuses[agent.id]}
                x={POSITIONS[i].x}
                y={POSITIONS[i].y}
                onClick={() => handleClick(agent)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Activity log */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Activity className="h-4 w-4 text-indigo-300" />
          יומן פעילות
        </div>
        {log.length === 0 ? (
          <p className="text-sm text-slate-500">אין פעילות עדיין.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            <AnimatePresence initial={false}>
              {log.map((entry) => (
                <motion.li
                  key={entry.id}
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-3 text-sm text-slate-300"
                >
                  {entry.icon ? (
                    <span className="w-2 shrink-0 text-center text-sm leading-none">{entry.icon}</span>
                  ) : (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: STATUS_META[entry.status].color }}
                    />
                  )}
                  <span className="flex-1">{entry.text}</span>
                  <span className="font-mono text-xs tabular-nums text-slate-500">{entry.time}</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </section>
  );
}

/** Below this the characters become unreadable, so narrow screens scroll sideways instead */
const MIN_SCALE = 0.6;

/** Scales the fixed-size stage down to fit its container, and centers it */
function useStageScale() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState({ scale: 1, offset: 0, ready: false });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      const scale = Math.max(MIN_SCALE, Math.min(1, width / STAGE_W));
      const scaledWidth = STAGE_W * scale;
      setState({ scale, offset: Math.max(0, (width - scaledWidth) / 2), ready: true });
      // Start scrolled to the CEO when the stage is wider than the screen
      if (scaledWidth > width) el.scrollLeft = (scaledWidth - width) / 2;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { wrapRef, ...state };
}
