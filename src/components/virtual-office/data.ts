import {
  Crown,
  BriefcaseBusiness,
  LayoutTemplate,
  Megaphone,
  Palette,
  PenLine,
  TrendingUp,
} from "lucide-react";
import type { AgentConfig, AgentStatus, AgentStatuses } from "./types";

export const CEO: AgentConfig = {
  id: "ceo",
  name: "המנכ״ל",
  task: "מחלק משימות ומתאם את הצוות",
  icon: Crown,
  color: "#d4af37",
  role: "במאי ראשי",
  skin: "#f1c27d",
  hair: "#3f2a1d",
};

/** Team members, in clockwise order starting from the top of the ring */
export const TEAM: AgentConfig[] = [
  {
    id: "creative",
    name: "קריאייטיב",
    task: "מעצב קונספט ויזואלי",
    icon: Palette,
    color: "#ec4899",
    skin: "#e0ac69",
    hair: "#7c2d12",
  },
  {
    id: "campaigner",
    name: "קמפיינר",
    task: "מגדיר קהלים ותקציב",
    icon: Megaphone,
    color: "#f97316",
    skin: "#c68642",
    hair: "#1c1917",
  },
  {
    id: "copywriter",
    name: "קופירייטר",
    task: "כותב כותרות ומסרים",
    icon: PenLine,
    color: "#8b5cf6",
    skin: "#ffdbac",
    hair: "#a16207",
  },
  {
    id: "analyst",
    name: "אנליסט",
    task: "מנתח נתוני ביצועים",
    icon: TrendingUp,
    color: "#14b8a6",
    skin: "#8d5524",
    hair: "#0c0a09",
  },
  {
    id: "landing",
    name: "בונה דפי נחיתה",
    task: "בונה ומעצב דף נחיתה",
    icon: LayoutTemplate,
    color: "#6366f1",
    skin: "#f1c27d",
    hair: "#44403c",
  },
  {
    id: "assistant",
    name: "מנהלת המשרד",
    task: "תפעול: יומן, לקוחות וחשבוניות",
    icon: BriefcaseBusiness,
    badges: ["📅 יומן", "🧾 חשבוניות", "💬 וואטסאפ"],
    color: "#84cc16",
    skin: "#e0ac69",
    hair: "#57534e",
  },
];

export const ALL_AGENTS: AgentConfig[] = [CEO, ...TEAM];

export const STATUS_META: Record<AgentStatus, { label: string; color: string }> = {
  waiting: { label: "ממתין", color: "#8e8798" },
  working: { label: "בעבודה", color: "#e8c872" },
  done: { label: "הושלם", color: "#6fcf97" },
};

export const STATUS_ORDER: AgentStatus[] = ["waiting", "working", "done"];

export const INITIAL_STATUSES: AgentStatuses = {
  ceo: "waiting",
  creative: "waiting",
  campaigner: "waiting",
  copywriter: "waiting",
  analyst: "waiting",
  landing: "waiting",
  assistant: "waiting",
};
