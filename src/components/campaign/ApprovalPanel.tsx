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
        className="flex items-center gap-2 self-start rounded-full border border-gold/30 bg-ink/60 px-3 py-1.5 text-xs text-gold-pale transition hover:border-gold hover:text-gold-light"
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
          className="rounded-2xl bg-gradient-to-br from-gold-light via-gold/70 to-plum-light p-px shadow-[0_0_36px_rgba(212,175,55,0.25)]"
        >
          <div className="flex flex-col gap-3 rounded-[15px] bg-gradient-to-b from-[#1e1221] to-ink p-4 sm:p-5">
            <h2 className="flex items-center gap-3">
              <motion.span
                className="text-xl"
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                aria-hidden
              >
                ✋
              </motion.span>
              <span className="text-base font-bold text-gold-pale">ממתין לאישור שלך ({approvals.length})</span>
              <span
                className="ms-auto flex items-center gap-1.5 rounded-full border border-gold/50 bg-gold/10 px-2.5 py-0.5 font-mono text-[11px] font-bold tracking-[0.2em] text-gold-light"
                dir="ltr"
              >
                <ShieldAlert className="h-3 w-3" />
                VIP
              </span>
            </h2>
            {keyRequired && <UnlockForm onUnlock={onUnlock} />}
            <AnimatePresence initial={false}>
              {approvals.map((approval) => (
                <ApprovalCard key={approval.id} approval={approval} onDecide={onDecide} />
              ))}
            </AnimatePresence>
          </div>
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
      className="overflow-hidden rounded-xl border border-plum-light bg-plum/25"
    >
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-gradient-to-l from-gold to-gold-light px-2.5 py-0.5 font-bold text-ink">
            {KIND_LABEL[approval.kind]}
          </span>
          <span className="text-mist">
            {agent?.name} · <code className="text-mist-dim">{approval.tool}</code>
          </span>
          <span className="ms-auto font-mono text-mist-dim">בתוקף עד {expires}</span>
        </div>
        <p className="text-[15px] leading-relaxed text-white">{approval.summary}</p>
        {Object.keys(approval.details).length > 0 && (
          <details className="text-xs text-mist">
            <summary className="cursor-pointer select-none text-gold-light/80 hover:text-gold-light">
              פרטים מלאים
            </summary>
            <pre
              dir="auto"
              className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-white/5 bg-ink/80 p-3 font-mono"
            >
              {JSON.stringify(approval.details, null, 2)}
            </pre>
          </details>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="הערה לסוכן (לא חובה)"
            className="min-w-40 flex-1 rounded-lg border border-plum-light bg-ink/80 px-3 py-2 text-sm text-white placeholder:text-mist-dim focus:border-gold focus:outline-none"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => decide(true)}
            className="flex items-center gap-1.5 rounded-lg border border-gold-light bg-gradient-to-br from-gold-light via-gold to-[#a8862a] px-5 py-2 text-sm font-black text-ink shadow-[0_0_18px_rgba(212,175,55,0.45)] transition hover:shadow-[0_0_26px_rgba(232,200,114,0.7)] disabled:opacity-50"
          >
            <Check className="h-4 w-4" strokeWidth={3} />
            אשר ביצוע
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => decide(false)}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-charcoal-light px-4 py-2 text-sm font-bold text-mist transition hover:border-white/30 hover:text-white disabled:opacity-50"
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
      className="flex flex-wrap items-center gap-2 rounded-xl border border-gold/30 bg-ink/80 p-3"
    >
      <KeyRound className="h-4 w-4 shrink-0 text-gold" />
      <span className="text-sm text-gold-pale">כדי להפעיל סוכנים ולאשר פעולות, הזינו את מפתח המשרד:</span>
      <input
        type="password"
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        autoComplete="current-password"
        placeholder="APPROVALS_API_SECRET"
        className="min-w-40 flex-1 rounded-lg border border-plum-light bg-charcoal px-3 py-2 text-sm text-white placeholder:text-mist-dim focus:border-gold focus:outline-none"
      />
      <button
        type="submit"
        disabled={busy || !secret.trim()}
        className="rounded-lg bg-gradient-to-l from-gold to-gold-light px-4 py-2 text-sm font-bold text-ink transition hover:shadow-[0_0_14px_rgba(212,175,55,0.5)] disabled:opacity-50"
      >
        התחברות
      </button>
      {failed && <span className="w-full text-xs text-[#ffb3b5]">המפתח שגוי</span>}
    </form>
  );
}
