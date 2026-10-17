"use client";

import { motion } from "framer-motion";
import { Clapperboard, Square } from "lucide-react";
import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { MAX_BRIEF_LENGTH } from "@/lib/agents/shared";

/** Shortcuts fill the command so it can be reviewed (and completed) before it's sent */
const QUICK_ACTIONS = [
  {
    label: "🎂 בדיקת ימי הולדת ב-CRM",
    command: "בדקי ב-CRM אילו לקוחות חוגגים יום הולדת השבוע, ושלחי לכל אחד מהם ברכה אישית וחמה בוואטסאפ.",
  },
  {
    label: "📅 תזכורות פגישות ליומן",
    command: "בדקי ביומן אילו פגישות קבועות למחר, ושלחי לכל משתתף תזכורת בוואטסאפ עם השעה והמיקום.",
  },
  {
    label: "🚀 תכנון קמפיין חדש",
    command: "תכנון קמפיין השקה ל: [מוצר / שירות]\nקהל יעד: [...]\nתקציב חודשי: [...] ₪\nמטרה: [...]",
  },
];

interface CommandCenterProps {
  running: boolean;
  onLaunch: (command: string) => void;
  onStop: () => void;
}

/** The director's command line: what the CEO should get the team working on */
export function CommandCenter({ running, onLaunch, onStop }: CommandCenterProps) {
  const [command, setCommand] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const ready = command.trim().length > 0 && !running;

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (ready) onLaunch(command.trim());
  };

  // Ctrl/Cmd + Enter launches, Enter alone adds a line
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
  };

  const applyQuickAction = (text: string) => {
    setCommand(text);
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    // Select the first placeholder so it can be typed over
    const start = text.indexOf("[");
    if (start >= 0) input.setSelectionRange(start, text.indexOf("]", start) + 1);
  };

  return (
    <form
      onSubmit={submit}
      dir="rtl"
      className="relative overflow-hidden rounded-2xl border border-gold/30 bg-gradient-to-b from-plum/70 to-charcoal p-4 shadow-[0_0_40px_rgba(61,19,61,0.6)] sm:p-5"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-gold-light to-transparent" />

      <div className="mb-3 flex items-center justify-between gap-3">
        <label htmlFor="director-command" className="flex items-center gap-2 text-sm font-bold text-gold-pale">
          <Clapperboard className="h-4 w-4 text-gold" />
          מרכז הפקודות · הנחיה למנכ״ל
        </label>
        <span className="hidden text-[11px] text-mist-dim sm:inline" dir="ltr">
          Ctrl + Enter
        </span>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
        <textarea
          ref={inputRef}
          id="director-command"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={MAX_BRIEF_LENGTH}
          rows={3}
          disabled={running}
          placeholder="לדוגמה: התחל קמפיין השקה חדש לאפליקציית כושר, או: בדוק ימי הולדת ב-CRM ושלח ברכות"
          className="min-h-24 flex-1 resize-y rounded-xl border border-plum-light bg-ink/80 px-4 py-3 text-[15px] leading-relaxed text-white placeholder:text-mist-dim focus:border-gold focus:shadow-[0_0_0_3px_rgba(212,175,55,0.15)] focus:outline-none disabled:opacity-60"
        />

        {running ? (
          <button
            type="button"
            onClick={onStop}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-charcoal-light px-6 py-3 text-base font-bold text-mist transition hover:border-on-air/50 hover:text-white lg:w-44"
          >
            <Square className="h-4 w-4" />
            CUT · עצור
          </button>
        ) : (
          <motion.button
            type="submit"
            disabled={!ready}
            whileHover={ready ? { scale: 1.02 } : undefined}
            whileTap={ready ? { scale: 0.97 } : undefined}
            className="group relative flex flex-col items-center justify-center gap-0.5 overflow-hidden rounded-xl border border-gold-light/70 bg-gradient-to-br from-gold-light via-gold to-[#a8862a] px-6 py-3 text-ink shadow-[0_0_24px_rgba(212,175,55,0.35)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none lg:w-44"
          >
            <span className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/40 opacity-0 transition-all duration-700 group-enabled:group-hover:left-[120%] group-enabled:group-hover:opacity-100" />
            <span className="flex items-center gap-2 font-mono text-lg font-black tracking-wider" dir="ltr">
              <Clapperboard className="h-5 w-5" />
              ACTION!
            </span>
            <span className="text-sm font-bold">שגר משימה</span>
          </motion.button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            disabled={running}
            onClick={() => applyQuickAction(action.command)}
            className="rounded-full border border-gold/30 bg-ink/60 px-3.5 py-1.5 text-sm text-gold-pale transition hover:border-gold hover:bg-plum hover:shadow-[0_0_12px_rgba(212,175,55,0.25)] disabled:opacity-40"
          >
            {action.label}
          </button>
        ))}
      </div>
    </form>
  );
}
