"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { ALL_AGENTS, STATUS_META, VirtualOffice } from "@/components/virtual-office";
import type { AgentConfig, AgentId } from "@/components/virtual-office";
import { useCampaignStream } from "@/hooks/useCampaignStream";
import type { ToolCallRecord } from "@/lib/agents/shared";
import { ApprovalPanel } from "./ApprovalPanel";
import { CommandCenter } from "./CommandCenter";
import { StudioHeader } from "./StudioHeader";

const APPROVAL_POLL_MS = 4000;

export function CampaignStudio() {
  const campaign = useCampaignStream();
  const { running, syncApprovals, addLinkToken } = campaign;

  // Opened from a WhatsApp alert: the link carries a token signed for that one approval
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("approval");
    const token = params.get("t");
    if (id && token) addLinkToken(id, token);
  }, [addLinkToken]);

  // While no run is streaming here, poll for approvals requested elsewhere
  // (a WhatsApp link, another tab, the test endpoint)
  useEffect(() => {
    if (running) return;
    void syncApprovals();
    const timer = setInterval(() => void syncApprovals(), APPROVAL_POLL_MS);
    return () => clearInterval(timer);
  }, [running, syncApprovals]);

  // ON AIR while a run streams, an agent is using a tool, or something waits for approval
  const live = running || campaign.approvals.length > 0 || Object.keys(campaign.activities).length > 0;

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
        live={live}
        header={<StudioHeader live={live} />}
        toolbar={
          <>
            <CommandCenter
              running={running}
              onLaunch={(command) => void campaign.start(command)}
              onStop={campaign.stop}
            />
            <ApprovalPanel
              approvals={campaign.approvals}
              locked={campaign.approvalsLocked}
              keyRequired={campaign.approvalKeyRequired}
              onDecide={campaign.decide}
              onUnlock={campaign.unlockApprovals}
            />
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
              className="flex items-center gap-3 rounded-xl border border-on-air/30 bg-on-air/10 px-4 py-3 text-sm text-[#ffb3b5]"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error.message}
            </motion.div>
          ))}
        </AnimatePresence>

        {campaign.plan && (
          <div className="rounded-2xl border border-gold/30 bg-gradient-to-l from-plum/60 to-charcoal p-4 text-sm leading-relaxed text-gold-pale">
            <span className="font-bold text-gold-light">🎬 חזון הבמאי: </span>
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
      className={`flex flex-col overflow-hidden rounded-2xl border bg-charcoal/85 shadow-lg shadow-black/30 ${
        wide ? "border-gold/40 md:col-span-2" : "border-plum-light/70"
      }`}
    >
      <header className="flex items-center gap-3 border-b border-plum-light/50 bg-plum/30 px-4 py-3">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
          style={{ background: `linear-gradient(145deg, ${agent.color}, ${agent.color}99)` }}
        >
          <Icon className="h-4 w-4 text-white" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-white">
            {agent.name}
            {agent.role && <span className="ms-1.5 text-xs font-medium text-gold-light">· {agent.role}</span>}
          </h3>
          {task && <p className="truncate text-xs text-mist">{task}</p>}
        </div>
        <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: meta.color }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
          {meta.label}
        </span>
      </header>
      {toolCalls && toolCalls.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 border-b border-white/5 bg-ink/40 px-4 py-2">
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
        {error && <p className="mb-2 text-sm text-[#ffb3b5]">{error}</p>}
        {output ? (
          <p dir="auto" className="whitespace-pre-wrap text-sm leading-relaxed text-[#ddd6e6]">
            {output}
            {status === "working" && (
              <span className="ms-0.5 inline-block h-4 w-1.5 animate-pulse bg-gold-light align-middle" />
            )}
          </p>
        ) : (
          !error && <p className="text-sm text-mist-dim">{status === "working" ? "חושב…" : "ממתין לתורו…"}</p>
        )}
      </div>
    </motion.article>
  );
}

const TOOL_OUTCOME_STYLE: Record<ToolCallRecord["outcome"], string> = {
  ok: "border-gold/25 bg-plum/50 text-gold-pale",
  rejected: "border-white/15 bg-charcoal-light text-mist",
  error: "border-on-air/30 bg-on-air/10 text-[#ffb3b5]",
};
