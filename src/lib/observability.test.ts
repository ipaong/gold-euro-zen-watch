import { describe, expect, it } from "vitest";

import { clearMetricSnapshot, getMetricSnapshot, recordMetric } from "./observability";

describe("structured observability", () => {
  it("stores operational labels without changing their shape", () => {
    clearMetricSnapshot();
    recordMetric("provider_failure", { provider: "GDELT", status: "timeout" }, 1234);
    expect(getMetricSnapshot()).toEqual([
      { name: "provider_failure", at: 1234, labels: { provider: "GDELT", status: "timeout" } },
    ]);
    clearMetricSnapshot();
  });

  it("keeps a bounded in-memory buffer", () => {
    clearMetricSnapshot();
    for (let i = 0; i < 205; i++) recordMetric("stale_news", { bucket: i }, i);
    const snapshot = getMetricSnapshot();
    expect(snapshot).toHaveLength(200);
    expect(snapshot[0]?.at).toBe(5);
    clearMetricSnapshot();
  });
});
