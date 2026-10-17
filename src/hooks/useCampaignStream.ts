"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { INITIAL_STATUSES } from "@/components/virtual-office/data";
import type { AgentId, AgentStatuses } from "@/components/virtual-office/types";
import type {
  AgentActivity,
  ApprovalRequest,
  CampaignEvent,
  PlannedTask,
  ToolCallRecord,
} from "@/lib/agents/shared";

export interface CampaignState {
  running: boolean;
  statuses: AgentStatuses;
  tasks: Partial<Record<AgentId, string>>;
  /** Streamed text per agent; filled in as `delta` events arrive */
  outputs: Partial<Record<AgentId, string>>;
  /** The external tool each agent is using right now */
  activities: Partial<Record<AgentId, AgentActivity>>;
  toolCalls: Partial<Record<AgentId, ToolCallRecord[]>>;
  approvals: ApprovalRequest[];
  /** Listing approvals needs the approvals key (this browser isn't signed in) */
  approvalsLocked: boolean;
  /** An answer or a campaign start was refused for lack of the key; the panel asks for it */
  approvalKeyRequired: boolean;
  plan: { summary: string; tasks: PlannedTask[] } | null;
  errors: { agent?: AgentId; message: string }[];
}

const INITIAL_STATE: CampaignState = {
  running: false,
  statuses: INITIAL_STATUSES,
  tasks: {},
  outputs: {},
  activities: {},
  toolCalls: {},
  approvals: [],
  approvalsLocked: false,
  approvalKeyRequired: false,
  plan: null,
  errors: [],
};

type Action =
  | { type: "start" }
  | { type: "finish" }
  | { type: "event"; event: CampaignEvent }
  | { type: "approval_answered"; id: string }
  | { type: "approvals_synced"; approvals: ApprovalRequest[] }
  | { type: "approvals_locked"; locked: boolean }
  | { type: "approval_key_required" }
  | { type: "approvals_unlocked" };

function reducer(state: CampaignState, action: Action): CampaignState {
  if (action.type === "start") return { ...INITIAL_STATE, running: true, approvalsLocked: state.approvalsLocked };
  if (action.type === "approvals_locked") return { ...state, approvalsLocked: action.locked };
  if (action.type === "approval_key_required") return { ...state, approvalKeyRequired: true };
  if (action.type === "approvals_unlocked") return { ...state, approvalsLocked: false, approvalKeyRequired: false };
  if (action.type === "finish") return { ...state, running: false, activities: {}, approvals: [] };
  if (action.type === "approvals_synced") return { ...state, approvals: action.approvals };
  if (action.type === "approval_answered") {
    return { ...state, approvals: state.approvals.filter((a) => a.id !== action.id) };
  }

  const { event } = action;
  switch (event.type) {
    case "activity": {
      const activities = { ...state.activities };
      if (event.activity) activities[event.agent] = event.activity;
      else delete activities[event.agent];
      return { ...state, activities };
    }
    case "tool_call":
      return {
        ...state,
        toolCalls: { ...state.toolCalls, [event.agent]: [...(state.toolCalls[event.agent] ?? []), event.call] },
      };
    case "approval_request":
      if (state.approvals.some((a) => a.id === event.approval.id)) return state;
      return { ...state, approvals: [...state.approvals, event.approval] };
    case "approval_resolved":
      return { ...state, approvals: state.approvals.filter((a) => a.id !== event.id) };
    case "status":
      return {
        ...state,
        statuses: { ...state.statuses, [event.agent]: event.status },
        tasks: event.task ? { ...state.tasks, [event.agent]: event.task } : state.tasks,
      };
    case "plan":
      return { ...state, plan: { summary: event.summary, tasks: event.tasks } };
    case "delta":
      return {
        ...state,
        outputs: { ...state.outputs, [event.agent]: (state.outputs[event.agent] ?? "") + event.text },
      };
    case "result":
      return { ...state, outputs: { ...state.outputs, [event.agent]: event.output } };
    case "error":
      return { ...state, errors: [...state.errors, { agent: event.agent, message: event.message }] };
    case "done":
      return { ...state, running: false };
    default:
      return state;
  }
}

/**
 * Starts a campaign on POST /api/campaign and applies the server-sent events
 * to local state. Uses fetch rather than EventSource, since EventSource
 * only supports GET requests.
 */
export function useCampaignStream() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const controllerRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => controllerRef.current?.abort(), []);

  const start = useCallback(async (brief: string) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    dispatch({ type: "start" });

    const fail = (message: string) => dispatch({ type: "event", event: { type: "error", message } });

    try {
      const response = await fetch("/api/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief }),
        signal: controller.signal,
      });
      if (response.status === 401) {
        dispatch({ type: "approval_key_required" });
        fail("כדי להפעיל את הסוכנים צריך להתחבר עם מפתח המשרד");
        return;
      }
      if (response.status === 503) {
        fail("מפתח המשרד לא הוגדר בשרת (APPROVALS_API_SECRET), ולכן הפעלת הסוכנים חסומה");
        return;
      }
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null);
        fail(body?.error ?? `השרת החזיר שגיאה ${response.status}`);
        return;
      }

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;

        // SSE messages are separated by a blank line
        let boundary: number;
        while ((boundary = buffer.indexOf("\n\n")) !== -1) {
          const message = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const data = message
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trimStart())
            .join("\n");
          if (data) dispatch({ type: "event", event: JSON.parse(data) as CampaignEvent });
        }
      }
    } catch {
      if (!controller.signal.aborted) fail("החיבור לשרת נותק");
    } finally {
      if (controllerRef.current === controller) dispatch({ type: "finish" });
    }
  }, []);

  // Signed tokens from WhatsApp alert links, by approval id. They authorize
  // that one approval without the approvals key.
  const linkTokens = useRef(new Map<string, string>());
  const addLinkToken = useCallback((id: string, token: string) => linkTokens.current.set(id, token), []);

  /** Answers a pending approval; the waiting agent continues once the server applies it */
  const decide = useCallback(async (id: string, approved: boolean, note?: string) => {
    const response = await fetch(`/api/approvals/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved, note, token: linkTokens.current.get(id) }),
    }).catch(() => null);
    if (response?.status === 401) {
      dispatch({ type: "approval_key_required" });
    } else if (response?.ok || response?.status === 404) {
      dispatch({ type: "approval_answered", id });
      if (response.status === 404) {
        dispatch({ type: "event", event: { type: "error", message: "בקשת האישור כבר לא בתוקף" } });
      }
    } else {
      dispatch({ type: "event", event: { type: "error", message: "שליחת התשובה לבקשת האישור נכשלה" } });
    }
  }, []);

  /**
   * Replaces the list with what's waiting on the server: requests made outside
   * this tab's run (another tab, a test request, a WhatsApp link). When the
   * server wants the approvals key, only link-token approvals are fetched.
   */
  const syncApprovals = useCallback(async () => {
    const response = await fetch("/api/approvals", { cache: "no-store" }).catch(() => null);
    if (response?.ok) {
      const { approvals } = (await response.json()) as { approvals: ApprovalRequest[] };
      dispatch({ type: "approvals_locked", locked: false });
      dispatch({ type: "approvals_synced", approvals });
      return;
    }
    if (response?.status !== 401) return;

    dispatch({ type: "approvals_locked", locked: true });
    const linked = await Promise.all(
      [...linkTokens.current].map(async ([id, token]) => {
        const r = await fetch(`/api/approvals/${id}?t=${encodeURIComponent(token)}`, { cache: "no-store" }).catch(() => null);
        if (r?.status === 404) linkTokens.current.delete(id);
        return r?.ok ? ((await r.json()) as { approval: ApprovalRequest }).approval : null;
      }),
    );
    dispatch({ type: "approvals_synced", approvals: linked.filter((a): a is ApprovalRequest => a !== null) });
  }, []);

  /** Exchanges the approvals key for an httpOnly session cookie in this browser */
  const unlockApprovals = useCallback(
    async (secret: string): Promise<boolean> => {
      const response = await fetch("/api/approvals/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      }).catch(() => null);
      if (!response?.ok) return false;
      dispatch({ type: "approvals_unlocked" });
      await syncApprovals();
      return true;
    },
    [syncApprovals],
  );

  useEffect(() => () => controllerRef.current?.abort(), []);

  return { ...state, start, stop, decide, syncApprovals, unlockApprovals, addLinkToken };
}
