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
  plan: null,
  errors: [],
};

type Action =
  | { type: "start" }
  | { type: "finish" }
  | { type: "event"; event: CampaignEvent }
  | { type: "approval_answered"; id: string };

function reducer(state: CampaignState, action: Action): CampaignState {
  if (action.type === "start") return { ...INITIAL_STATE, running: true };
  if (action.type === "finish") return { ...state, running: false, activities: {}, approvals: [] };
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

  /** Answers a pending approval; the waiting agent continues once the server applies it */
  const decide = useCallback(async (id: string, approved: boolean, note?: string) => {
    const response = await fetch(`/api/approvals/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved, note }),
    }).catch(() => null);
    if (response?.ok || response?.status === 404) {
      dispatch({ type: "approval_answered", id });
      if (response.status === 404) {
        dispatch({ type: "event", event: { type: "error", message: "בקשת האישור כבר לא בתוקף" } });
      }
    } else {
      dispatch({ type: "event", event: { type: "error", message: "שליחת התשובה לבקשת האישור נכשלה" } });
    }
  }, []);

  /** Picks up approvals that are waiting on the server, e.g. when opened from a WhatsApp link */
  const loadPendingApprovals = useCallback(async () => {
    const response = await fetch("/api/approvals").catch(() => null);
    if (!response?.ok) return;
    const { approvals } = (await response.json()) as { approvals: ApprovalRequest[] };
    for (const approval of approvals) dispatch({ type: "event", event: { type: "approval_request", approval } });
  }, []);

  useEffect(() => () => controllerRef.current?.abort(), []);

  return { ...state, start, stop, decide, loadPendingApprovals };
}
