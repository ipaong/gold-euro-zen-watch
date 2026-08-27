import { AlertTriangle, ChevronDown } from "lucide-react";
import { useState } from "react";

import { DirectionBadge } from "./DirectionBadge";
import type { ModelVote } from "@/lib/types";

/** Collapsed = name, vote, confidence, one line. Everything else is behind expand. */
export function ModelVoteCard({ model, index }: { model: ModelVote; index: number }) {
  const [open, setOpen] = useState(false);
  const detailsId = `model-vote-details-${index}-${model.id}`;
  return (
    <article className="rounded-xl border border-border bg-card p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-h-12 items-center gap-2 text-left"
        aria-expanded={open}
        aria-controls={detailsId}
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
          {index}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-semibold">{model.name}</span>
            <span className="ml-auto flex shrink-0 items-center gap-1.5">
              <DirectionBadge direction={model.direction} soft />
              <span className="tabular text-xs font-semibold text-muted-foreground">
                {model.confidence}%
              </span>
            </span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {model.summary}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      <div
        id={detailsId}
        hidden={!open}
        className="mt-3 space-y-3 border-t border-border pt-3 text-sm"
      >
        <p>{model.summary}</p>

        {model.unavailable ? (
          <p className="flex items-start gap-1.5 rounded-lg bg-wait-soft p-2 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            โมเดลนี้ข้อมูลไม่พอ จึงไม่ถูกนับเป็นเสียงโหวต
          </p>
        ) : null}

        <div>
          <h4 className="text-xs font-semibold text-muted-foreground">เหตุผลที่ใช้</h4>
          <ul className="mt-1 space-y-1">
            {model.factors.map((f) => (
              <li key={f} className="flex gap-2">
                <span aria-hidden className="text-gold">
                  •
                </span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {model.risks.length ? (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground">ความเสี่ยง</h4>
            <ul className="mt-1 space-y-1">
              {model.risks.map((r) => (
                <li key={r} className="flex gap-2 text-muted-foreground">
                  <span aria-hidden className="text-bear">
                    !
                  </span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </article>
  );
}
