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
  /** Replaces the default title block (e.g. a brand header) */
  header?: ReactNode;
  /** Rendered between the header and the office stage */
  toolbar?: ReactNode;
  /** Shows the REC light on the stage frame */
  live?: boolean;
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
  header,
  toolbar,
  live,
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
  const progress = assigned.length ? assigned.filter((a) => statuses[a.id] === "done").length / assigned.length : 0;

  return (
    <section dir="rtl" className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:py-8">
      {header ?? (
        <div>
          <p className="mb-1 text-sm font-medium text-gold-light">סוכנות AI · אולפן הפקה</p>
          <h1 className="bg-gradient-to-l from-gold-pale via-gold-light to-gold bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl">
            המשרד הווירטואלי
          </h1>
          <p className="mt-1 text-sm text-mist">{subtitle}</p>
        </div>
      )}

      {toolbar}

      {/* Monitor bar: counters, controls and progress */}
      <div className="flex flex-col gap-3 rounded-2xl border border-plum-light/60 bg-charcoal/80 px-4 py-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          {counts.map(({ status, count }) => (
            <div
              key={status}
              className="flex items-center gap-2 rounded-lg border border-white/5 bg-ink/70 px-3 py-1.5 text-sm text-mist"
            >
              <span className="h-2 w-2 rounded-full" style={{ background: STATUS_META[status].color }} />
              {STATUS_META[status].label}
              <motion.span
                key={count}
                initial={{ y: -6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="min-w-4 text-center font-bold tabular-nums text-gold-pale"
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
                className="flex items-center gap-2 rounded-lg bg-gradient-to-l from-gold to-gold-light px-4 py-1.5 text-sm font-bold text-ink shadow-lg shadow-gold/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Play className="h-4 w-4" />
                {running ? "פרויקט בתהליך…" : "הפעל פרויקט"}
              </motion.button>
              <button
                type="button"
                onClick={reset}
                aria-label="איפוס"
                className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-ink/70 text-mist transition hover:text-gold-light"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
        <div className="flex flex-1 items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink">
            <motion.div
              className="h-full rounded-full bg-gradient-to-l from-gold-pale via-gold-light to-gold shadow-[0_0_10px_#e8c872]"
              animate={{ width: `${progress * 100}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </div>
          <span className="w-10 text-left font-mono text-xs tabular-nums text-gold-light">
            {Math.round(progress * 100)}%
          </span>
        </div>
      </div>

      {/* Stage */}
      <div className="relative overflow-hidden rounded-3xl border border-gold/20 bg-[radial-gradient(ellipse_at_50%_0%,#2a0f2c_0%,#121118_55%,#0d0c11_100%)] shadow-2xl shadow-black/60">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.55))]" />
        <ViewfinderFrame live={live} />
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
            <OfficeFloor links={TEAM.map((a, i) => ({ id: a.id, to: POSITIONS[i], status: statuses[a.id] }))} />
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
      <div className="rounded-2xl border border-plum-light/60 bg-charcoal/80 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gold-pale">
          <Activity className="h-4 w-4 text-gold" />
          יומן הפקה
        </div>
        {log.length === 0 ? (
          <p className="text-sm text-mist-dim">אין פעילות עדיין.</p>
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
                  className="flex items-center gap-3 border-b border-white/[0.04] pb-1.5 text-sm text-mist last:border-0"
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
                  <span className="font-mono text-xs tabular-nums text-mist-dim">{entry.time}</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </section>
  );
}

/** Camera viewfinder corners and a REC light framing the stage */
function ViewfinderFrame({ live }: { live?: boolean }) {
  const corner = "pointer-events-none absolute z-[2000] h-6 w-6 border-gold/60";
  return (
    <>
      <span className={`${corner} left-4 top-4 border-l-2 border-t-2`} />
      <span className={`${corner} right-4 top-4 border-r-2 border-t-2`} />
      <span className={`${corner} bottom-4 left-4 border-b-2 border-l-2`} />
      <span className={`${corner} bottom-4 right-4 border-b-2 border-r-2`} />
      <div className="pointer-events-none absolute right-12 top-5 z-[2000] flex items-center gap-2 font-mono text-[11px] tracking-widest text-mist">
        <motion.span
          className="h-2 w-2 rounded-full"
          style={{ background: live ? "#e5484d" : "#4a4452" }}
          animate={live ? { opacity: [1, 0.25, 1] } : { opacity: 1 }}
          transition={live ? { duration: 1.2, repeat: Infinity } : undefined}
        />
        {live ? "REC" : "STBY"}
      </div>
      <div className="pointer-events-none absolute left-12 top-5 z-[2000] font-mono text-[11px] tracking-widest text-mist-dim">
        CAM A · STUDIO 1
      </div>
    </>
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
