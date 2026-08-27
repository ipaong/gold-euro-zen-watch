export type MetricName =
  | "provider_failure"
  | "ai_fallback"
  | "settlement_lag"
  | "settlement_failure"
  | "settlement_completed"
  | "stale_market"
  | "stale_news"
  | "auth_session_failure";

export type MetricValue = string | number | boolean;

export interface ObservabilityEvent {
  name: MetricName;
  at: number;
  labels: Record<string, MetricValue>;
}

const events: ObservabilityEvent[] = [];
const MAX_EVENTS = 200;

/**
 * Record only operational metadata. Callers must pass provider/model/status
 * labels, never tokens, article bodies, user IDs, or other personal data.
 */
export function recordMetric(
  name: MetricName,
  labels: Record<string, MetricValue> = {},
  at = Date.now(),
): void {
  const event = { name, at, labels };
  events.push(event);
  if (events.length > MAX_EVENTS) events.shift();

  const isTest = typeof process !== "undefined" && process.env["NODE_ENV"] === "test";
  if (!isTest && typeof console !== "undefined" && typeof console.info === "function") {
    console.info("[xaueur-observability]", JSON.stringify(event));
  }
}

export function getMetricSnapshot(): ObservabilityEvent[] {
  return events.map((event) => ({ ...event, labels: { ...event.labels } }));
}

export function clearMetricSnapshot(): void {
  events.length = 0;
}
