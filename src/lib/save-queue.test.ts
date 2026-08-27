import { describe, expect, it, vi } from "vitest";

import { createLatestSaveQueue } from "./save-queue";

describe("latest save queue", () => {
  it("serializes writes and keeps the newest pending value", async () => {
    let releaseFirst: (() => void) | undefined;
    const save = vi.fn((value: string) =>
      value === "first"
        ? new Promise<void>((resolve) => {
            releaseFirst = resolve;
          })
        : Promise.resolve(),
    );
    const statuses: string[] = [];
    const queue = createLatestSaveQueue(save, (status) => statuses.push(status));

    queue.enqueue("first");
    queue.enqueue("second");
    queue.enqueue("latest");
    releaseFirst?.();
    await queue.flush();

    expect(save.mock.calls).toEqual([["first"], ["latest"]]);
    expect(statuses.at(-1)).toBe("synced");
  });

  it("does not surface an old failure after a newer save succeeds", async () => {
    let rejectFirst: ((error: Error) => void) | undefined;
    const save = vi.fn((value: string) =>
      value === "first"
        ? new Promise<void>((_resolve, reject) => {
            rejectFirst = reject;
          })
        : Promise.resolve(),
    );
    const statuses: string[] = [];
    const queue = createLatestSaveQueue(save, (status) => statuses.push(status));

    queue.enqueue("first");
    queue.enqueue("latest");
    rejectFirst?.(new Error("offline"));
    await queue.flush();

    expect(save.mock.calls).toEqual([["first"], ["latest"]]);
    expect(statuses.at(-1)).toBe("synced");
    expect(statuses).not.toContain("error");
  });
});
