import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * Access control for the approval endpoints, keyed on APPROVALS_API_SECRET.
 * A request is allowed when it carries one of:
 *   - `Authorization: Bearer <secret>`             (scripts, Make, curl)
 *   - the session cookie set by /api/approvals/session (the office UI)
 *   - a link token signed for one approval id       (the WhatsApp alert link)
 *
 * Without a secret the endpoints stay open in development and are closed in
 * production, so a missing variable never exposes them.
 */

export const SESSION_COOKIE = "approvals_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export const approvalsSecret = () => process.env.APPROVALS_API_SECRET || undefined;

const sign = (secret: string, purpose: string) => createHmac("sha256", secret).update(purpose).digest("base64url");

/** Cookie value: derived from the secret so the secret itself never sits in a browser */
export const sessionToken = (secret: string) => sign(secret, "approvals-session:v1");

/** Scoped to a single approval, so a forwarded link can't answer anything else */
export function approvalLinkToken(approvalId: string): string | null {
  const secret = approvalsSecret();
  return secret ? sign(secret, `approval:${approvalId}`) : null;
}

/** Constant-time comparison that also hides the length of the expected value */
export function safeEqual(given: string | null | undefined, expected: string): boolean {
  if (!given) return false;
  const a = createHmac("sha256", "compare").update(given).digest();
  const b = createHmac("sha256", "compare").update(expected).digest();
  return timingSafeEqual(a, b);
}

interface AuthOptions {
  /** Accept a link token for this approval id */
  approvalId?: string;
  linkToken?: string | null;
}

/** Returns an error response when the request isn't authorized, or null when it is */
export function authorizeApprovals(request: NextRequest, options: AuthOptions = {}): Response | null {
  const secret = approvalsSecret();
  if (!secret) {
    if (process.env.NODE_ENV !== "production") return null;
    return Response.json({ error: "APPROVALS_API_SECRET is not configured" }, { status: 503 });
  }

  const bearer = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1]?.trim();
  if (safeEqual(bearer, secret)) return null;
  if (safeEqual(request.cookies.get(SESSION_COOKIE)?.value, sessionToken(secret))) return null;
  if (options.approvalId && safeEqual(options.linkToken, sign(secret, `approval:${options.approvalId}`))) return null;

  return Response.json({ error: "unauthorized" }, { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
}
