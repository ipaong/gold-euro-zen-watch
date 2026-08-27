export type SaveQueueStatus = "saving" | "synced" | "error";

export interface LatestSaveQueue<T> {
  enqueue(value: T): void;
  flush(): Promise<void>;
}

/**
 * Serializes writes while retaining only the newest pending value. A result is
 * reported only when it belongs to the latest attempt, so an older failure
 * cannot overwrite a newer successful settings save in the UI.
 */
export function createLatestSaveQueue<T>(
  save: (value: T) => Promise<void>,
  onStatus: (status: SaveQueueStatus) => void,
): LatestSaveQueue<T> {
  let pending: T | null = null;
  let active: Promise<void> | null = null;
  let attempt = 0;
  let latestAttempt = 0;

  function enqueue(value: T): void {
    pending = value;
    latestAttempt = ++attempt;
    onStatus("saving");
    void flush();
  }

  async function flush(): Promise<void> {
    if (active) return active;

    const loop = (async () => {
      while (pending !== null) {
        const value = pending;
        const currentAttempt = latestAttempt;
        pending = null;
        try {
          await save(value);
          if (currentAttempt === latestAttempt) onStatus("synced");
        } catch {
          if (currentAttempt === latestAttempt) onStatus("error");
        }
      }
    })();

    active = loop;
    try {
      await loop;
    } finally {
      if (active === loop) active = null;
      if (pending !== null) void flush();
    }
  }

  return { enqueue, flush };
}
