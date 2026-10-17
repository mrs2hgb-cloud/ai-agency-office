"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Send, Square } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { ALL_AGENTS, STATUS_META, VirtualOffice } from "@/components/virtual-office";
import type { AgentConfig, AgentId } from "@/components/virtual-office";
import { useCampaignStream } from "@/hooks/useCampaignStream";
import { MAX_BRIEF_LENGTH, type ToolCallRecord } from "@/lib/agents/shared";
import { ApprovalPanel } from "./ApprovalPanel";

const APPROVAL_POLL_MS = 4000;

const EXAMPLE_BRIEFS = [
  "השקה של אפליקציית כושר חדשה לנשים בגילאי 25-40, תקציב 30,000 ₪ לחודש, מטרה: 2,000 הורדות.",
  "קמפיין לחנות קפה שכונתית בתל אביב שפותחת סניף שני, קהל צעיר, דגש על אינסטגרם.",
  "קמפיין לידים לחברת סולאר למשקי בית בצפון, מבצע התקנה ללא מקדמה לחודש אחד.",
  "בדקי אילו לקוחות חוגגים יום הולדת השבוע ושלחי לכל אחד מהם ברכה אישית בוואטסאפ.",
  "תקבעי פגישת היכרות של שעה עם הלקוח החדש דני כהן ביום שלישי הבא, ותפיקי לו חשבונית מס על ריטיינר חודשי של 4,500 ₪.",
];

export function CampaignStudio() {
  const campaign = useCampaignStream();
  const [brief, setBrief] = useState("");
  const { running, syncApprovals } = campaign;

  // While no run is streaming here, poll for approvals requested elsewhere
  // (a WhatsApp link, another tab, the test endpoint)
  useEffect(() => {
    if (running) return;
    void syncApprovals();
    const timer = setInterval(() => void syncApprovals(), APPROVAL_POLL_MS);
    return () => clearInterval(timer);
  }, [running, syncApprovals]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (brief.trim() && !campaign.running) void campaign.start(brief.trim());
  };

  const scrollToAgent = (agent: AgentConfig) =>
    document.getElementById(`output-${agent.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });

  // Agents that have something to show, in office order (CEO first)
  const visible = ALL_AGENTS.filter((a) => campaign.tasks[a.id] || campaign.outputs[a.id]);
  const generalErrors = campaign.errors.filter((e) => !e.agent || e.agent === "ceo");

  return (
    <div className="pb-16">
      <VirtualOffice
        statuses={campaign.statuses}
        tasks={campaign.tasks}
        activities={campaign.activities}
        showControls={false}
        onAgentClick={scrollToAgent}
        subtitle="שלחו בריף, והמנכ״ל יחלק אותו בין הצוות. הסטטוסים מתעדכנים בזמן אמת."
        toolbar={
          <>
            <form
              onSubmit={submit}
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur"
            >
              <label htmlFor="brief" className="text-sm font-semibold text-slate-200">
                בריף לקמפיין
              </label>
              <textarea
                id="brief"
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                maxLength={MAX_BRIEF_LENGTH}
                rows={3}
                disabled={campaign.running}
                placeholder="מה המוצר, מי הקהל, מה התקציב ומה המטרה?"
                className="w-full resize-y rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none disabled:opacity-60"
              />
              <div className="flex flex-wrap items-center gap-2">
                {campaign.running ? (
                  <button
                    type="button"
                    onClick={campaign.stop}
                    className="flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-sm font-bold text-rose-200 transition hover:bg-rose-500/20"
                  >
                    <Square className="h-4 w-4" />
                    עצור
                  </button>
                ) : (
                  <motion.button
                    type="submit"
                    disabled={!brief.trim()}
                    whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-l from-indigo-500 to-sky-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send className="h-4 w-4 -scale-x-100" />
                    שלח למנכ״ל
                  </motion.button>
                )}
                {!campaign.running &&
                  EXAMPLE_BRIEFS.map((example, i) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => setBrief(example)}
                      className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-400 transition hover:border-white/25 hover:text-slate-200"
                    >
                      דוגמה {i + 1}
                    </button>
                  ))}
              </div>
            </form>
            <ApprovalPanel approvals={campaign.approvals} onDecide={campaign.decide} />
          </>
        }
      />

      <section dir="rtl" className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4">
        <AnimatePresence>
          {generalErrors.map((error, i) => (
            <motion.div
              key={`${i}-${error.message}`}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error.message}
            </motion.div>
          ))}
        </AnimatePresence>

        {campaign.plan && (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4 text-sm text-amber-100">
            <span className="font-bold">אסטרטגיית המנכ״ל: </span>
            {campaign.plan.summary}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {visible.map((agent) => (
            <OutputCard
              key={agent.id}
              agent={agent}
              status={campaign.statuses[agent.id]}
              task={campaign.tasks[agent.id]}
              output={campaign.outputs[agent.id]}
              toolCalls={campaign.toolCalls[agent.id]}
              error={campaign.errors.find((e) => e.agent === agent.id && agent.id !== "ceo")?.message}
              wide={agent.id === "ceo"}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function OutputCard({
  agent,
  status,
  task,
  output,
  toolCalls,
  error,
  wide,
}: {
  agent: AgentConfig;
  status: keyof typeof STATUS_META;
  task?: string;
  output?: string;
  toolCalls?: ToolCallRecord[];
  error?: string;
  wide?: boolean;
}) {
  const Icon = agent.icon;
  const meta = STATUS_META[status];

  return (
    <motion.article
      id={`output-${agent.id satisfies AgentId}`}
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] ${wide ? "md:col-span-2" : ""}`}
    >
      <header className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
          style={{ background: `linear-gradient(145deg, ${agent.color}, ${agent.color}99)` }}
        >
          <Icon className="h-4 w-4 text-white" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-white">{agent.name}</h3>
          {task && <p className="truncate text-xs text-slate-400">{task}</p>}
        </div>
        <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: meta.color }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
          {meta.label}
        </span>
      </header>
      {toolCalls && toolCalls.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 border-b border-white/5 px-4 py-2">
          {toolCalls.map((call) => (
            <li
              key={call.id}
              title={call.tool}
              className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${TOOL_OUTCOME_STYLE[call.outcome]}`}
            >
              <span>{call.icon}</span>
              {call.label}
              {call.outcome === "rejected" && " · נדחה"}
              {call.outcome === "error" && " · נכשל"}
              {call.mode === "demo" && <span className="opacity-60"> · דמו</span>}
            </li>
          ))}
        </ul>
      )}
      <div className="max-h-96 overflow-y-auto px-4 py-3">
        {error && <p className="mb-2 text-sm text-rose-300">{error}</p>}
        {output ? (
          <p dir="auto" className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
            {output}
            {status === "working" && <span className="ms-0.5 inline-block h-4 w-1.5 animate-pulse bg-sky-400 align-middle" />}
          </p>
        ) : (
          !error && (
            <p className="text-sm text-slate-500">
              {status === "working" ? "חושב…" : "ממתין לתורו…"}
            </p>
          )
        )}
      </div>
    </motion.article>
  );
}

const TOOL_OUTCOME_STYLE: Record<ToolCallRecord["outcome"], string> = {
  ok: "border-white/10 bg-white/5 text-slate-300",
  rejected: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  error: "border-rose-400/30 bg-rose-500/10 text-rose-200",
};
