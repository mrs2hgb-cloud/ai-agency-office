import { connection } from "next/server";

/** Liveness check for the hosting platform (Railway, Render, Docker HEALTHCHECK) */
export async function GET() {
  await connection();
  return Response.json({ ok: true, uptime_s: Math.round(process.uptime()) });
}
