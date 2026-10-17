"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, KeyRound, Lock, ShieldAlert, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ALL_AGENTS } from "@/components/virtual-office";
import type { ApprovalKind, ApprovalRequest } from "@/lib/agents/shared";

const KIND_LABEL: Record<ApprovalKind, string> = {
  whatsapp_broadcast: "הפצה בוואטסאפ",
  campaign_publish: "פרסום קמפיין",
  financial_document: "מסמך כספי",
  other: "פעולה",
};

interface ApprovalPanelProps {
  approvals: ApprovalRequest[];
  /** This browser isn't signed in to approvals */
  locked: boolean;
  /** An answer was refused without the key: ask for it */
  keyRequired: boolean;
  onDecide: (id: string, approved: boolean, note?: string) => Promise<void>;
  onUnlock: (secret: string) => Promise<boolean>;
}

/** Human-in-the-loop: actions the agents are holding until the owner answers */
export function ApprovalPanel({ approvals, locked, keyRequired, onDecide, onUnlock }: ApprovalPanelProps) {
  const [unlockOpen, setUnlockOpen] = useState(false);

  if (approvals.length === 0) {
    if (!locked && !keyRequired) return null;
    return unlockOpen || keyRequired ? (
      <UnlockForm onUnlock={onUnlock} />
    ) : (
      <button
        type="button"
        dir="rtl"
        onClick={() => setUnlockOpen(true)}
        className="flex items-center gap-2 self-start rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-400 transition hover:border-white/25 hover:text-slate-200"
      >
        <Lock className="h-3.5 w-3.5" />
        התחברות למשרד
      </button>
    );
  }

  return (
    <AnimatePresence>
      {approvals.length > 0 && (
        <motion.section
          dir="rtl"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          aria-live="polite"
          className="flex flex-col gap-3 rounded-2xl border border-amber-400/40 bg-amber-500/[0.07] p-4 shadow-lg shadow-amber-500/10"
        >
          <h2 className="flex items-center gap-2 text-sm font-bold text-amber-200">
            <ShieldAlert className="h-4 w-4" />
            ממתין לאישור שלך ({approvals.length})
          </h2>
          {keyRequired && <UnlockForm onUnlock={onUnlock} />}
          <AnimatePresence initial={false}>
            {approvals.map((approval) => (
              <ApprovalCard key={approval.id} approval={approval} onDecide={onDecide} />
            ))}
          </AnimatePresence>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

function ApprovalCard({ approval, onDecide }: { approval: ApprovalRequest; onDecide: ApprovalPanelProps["onDecide"] }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const agent = ALL_AGENTS.find((a) => a.id === approval.agent);
  const expires = new Date(approval.expiresAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });

  const decide = async (approved: boolean) => {
    setBusy(true);
    await onDecide(approval.id, approved, note.trim() || undefined);
    setBusy(false);
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/70"
    >
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-amber-400 px-2 py-0.5 font-bold text-slate-950">{KIND_LABEL[approval.kind]}</span>
          <span className="text-slate-400">
            {agent?.name} · <code className="text-slate-500">{approval.tool}</code>
          </span>
          <span className="ms-auto text-slate-500">בתוקף עד {expires}</span>
        </div>
        <p className="text-sm leading-relaxed text-white">{approval.summary}</p>
        {Object.keys(approval.details).length > 0 && (
          <details className="text-xs text-slate-400">
            <summary className="cursor-pointer select-none text-slate-300">פרטים מלאים</summary>
            <pre dir="auto" className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 font-mono">
              {JSON.stringify(approval.details, null, 2)}
            </pre>
          </details>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="הערה לסוכן (לא חובה)"
            className="min-w-40 flex-1 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => decide(true)}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            אשר
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => decide(false)}
            className="flex items-center gap-1.5 rounded-lg border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-sm font-bold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
            דחה
          </button>
        </div>
      </div>
    </motion.article>
  );
}

/** Exchanges the approvals key for a session cookie in this browser */
function UnlockForm({ onUnlock }: { onUnlock: ApprovalPanelProps["onUnlock"] }) {
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = await onUnlock(secret.trim());
    setBusy(false);
    setFailed(!ok);
    if (ok) setSecret("");
  };

  return (
    <form
      dir="rtl"
      onSubmit={submit}
      className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-slate-950/70 p-3"
    >
      <KeyRound className="h-4 w-4 shrink-0 text-amber-300" />
      <span className="text-sm text-slate-300">כדי להפעיל סוכנים ולאשר פעולות, הזינו את מפתח המשרד:</span>
      <input
        type="password"
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        autoComplete="current-password"
        placeholder="APPROVALS_API_SECRET"
        className="min-w-40 flex-1 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
      />
      <button
        type="submit"
        disabled={busy || !secret.trim()}
        className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-amber-300 disabled:opacity-50"
      >
        התחברות
      </button>
      {failed && <span className="w-full text-xs text-rose-300">המפתח שגוי</span>}
    </form>
  );
}
