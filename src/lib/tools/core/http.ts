import type { ToolMode } from "@/lib/agents/shared";
import { IntegrationError } from "./types";

const REQUEST_TIMEOUT_MS = 20_000;

/**
 * An integration is live when it's configured. Write actions are also held
 * back by TOOLS_DRY_RUN=true, which is handy while wiring up a new account.
 * Unconfigured integrations run in demo mode and return labelled sample data.
 */
export function modeFor(configured: string | undefined, kind: "read" | "write"): ToolMode {
  if (!configured) return "demo";
  if (kind === "write" && process.env.TOOLS_DRY_RUN === "true") return "demo";
  return "live";
}

interface JsonRequest {
  method?: "GET" | "POST" | "PUT";
  headers?: Record<string, string>;
  body?: unknown;
  signal: AbortSignal;
}

export async function requestJson(url: string, { method = "POST", headers, body, signal }: JsonRequest) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new IntegrationError(`${new URL(url).host} returned ${response.status}: ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    // Make answers plain "Accepted" unless the scenario ends with a Webhook response module
    return { response: text };
  }
}

/** POSTs to a Make webhook (optionally protected with Make's x-make-apikey header) */
export async function postToMake(url: string, payload: unknown, signal: AbortSignal) {
  const apiKey = process.env.MAKE_WEBHOOK_API_KEY;
  const result = await requestJson(url, {
    body: payload,
    headers: apiKey ? { "x-make-apikey": apiKey } : undefined,
    signal,
  });
  return asRecord(result);
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : { result: value };
}
