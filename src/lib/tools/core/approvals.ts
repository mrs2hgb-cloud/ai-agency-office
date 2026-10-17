import type { ApprovalRequest } from "@/lib/agents/shared";
import type { ApprovalDecision } from "./types";

/**
 * Pending human approvals, keyed by id.
 *
 * Kept in process memory: the campaign stream that is waiting and the
 * POST /api/approvals/[id] call that answers must reach the same server
 * process. That holds for `next start` and a single container. On serverless
 * platforms with many instances, move this to a shared store (Redis, KV)
 * with pub/sub.
 */
interface Pending {
  request: ApprovalRequest;
  resolve: (decision: ApprovalDecision) => void;
}

// globalThis survives dev-mode hot reloads and separate route bundles
const store = ((globalThis as { __approvalStore?: Map<string, Pending> }).__approvalStore ??= new Map());

export const approvalTimeoutMs = () => Number(process.env.APPROVAL_TIMEOUT_SECONDS ?? 600) * 1000;

/** Registers a request and resolves when it's answered, times out, or the run is aborted */
export function waitForApproval(request: ApprovalRequest, signal: AbortSignal): Promise<ApprovalDecision> {
  return new Promise((resolve) => {
    const finish = (decision: ApprovalDecision) => {
      if (!store.delete(request.id)) return;
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      resolve(decision);
    };
    const onAbort = () => finish({ approved: false, note: "The run was stopped" });
    const timer = setTimeout(
      () => finish({ approved: false, note: "No answer before the approval request expired" }),
      approvalTimeoutMs(),
    );

    store.set(request.id, { request, resolve: finish });
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/** Returns false when no pending request has this id */
export function resolveApproval(id: string, decision: ApprovalDecision): boolean {
  const pending = store.get(id);
  if (!pending) return false;
  pending.resolve(decision);
  return true;
}

export function listPendingApprovals(): ApprovalRequest[] {
  return [...store.values()].map((p) => p.request);
}
