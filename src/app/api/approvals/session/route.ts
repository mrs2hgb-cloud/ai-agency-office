import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  approvalsSecret,
  safeEqual,
  sessionToken,
} from "@/lib/auth/approvals-auth";

const FAILED_ATTEMPT_DELAY_MS = 1000;

/** Unlocks approvals in this browser: body { secret } sets an httpOnly session cookie */
export async function POST(request: NextRequest) {
  const secret = approvalsSecret();
  if (!secret) return Response.json({ error: "APPROVALS_API_SECRET is not configured" }, { status: 503 });

  const body: unknown = await request.json().catch(() => null);
  const given = body && typeof body === "object" && "secret" in body && typeof body.secret === "string" ? body.secret : "";
  if (!safeEqual(given.trim(), secret)) {
    // Slows down guessing; use a long random secret regardless
    await new Promise((resolve) => setTimeout(resolve, FAILED_ATTEMPT_DELAY_MS));
    return Response.json({ error: "wrong secret" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, sessionToken(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/approvals",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}

/** Signs this browser out of approvals */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { path: "/api/approvals", maxAge: 0 });
  return response;
}
