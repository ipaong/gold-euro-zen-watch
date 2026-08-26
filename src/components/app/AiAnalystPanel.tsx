import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useEffect } from "react";

import { buildAnalystInput, templateExplanation } from "@/lib/ai-input";
import { explainAnalysis } from "@/lib/ai.functions";
import type { AiExplanation, AnalysisResult } from "@/lib/types";

/**
 * Phase 2B: Lovable AI explains the engine's own output in plain Thai.
 * It never changes the signal — on any failure we show the template text.
 */
export function AiAnalystPanel({
  result,
  cacheKey,
  onReady,
}: {
  result: AnalysisResult;
  cacheKey: string | number;
  onReady?: (e: AiExplanation) => void;
}) {
  const run = useServerFn(explainAnalysis);

  const query = useQuery({
    queryKey: ["ai-analyst", cacheKey],
    queryFn: async (): Promise<AiExplanation> => {
      const out = await run({ data: buildAnalystInput(result) });
      return { ...out, source: "ai", generatedAt: Date.now() };
    },
    retry: false,
    staleTime: Infinity,
  });

  const explanation: AiExplanation =
    query.data ?? (query.isError ? templateExplanation(result) : templateExplanation(result));

  useEffect(() => {
    if (query.isLoading) return;
    onReady?.(explanation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, query.isError, query.isLoading]);

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <header className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-gold" aria-hidden />
        <h2 className="font-semibold">นักวิเคราะห์ AI อธิบายให้ฟัง</h2>
        <span className="ml-auto shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
          {query.isLoading
            ? "กำลังเขียน…"
            : explanation.source === "ai"
              ? "โดย AI"
              : "โหมดสำรอง"}
        </span>
      </header>

      {query.isLoading ? (
        <div className="mt-3 space-y-2" aria-live="polite">
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
        </div>
      ) : (
        <div className="mt-3 space-y-3 text-sm">
          <Block title="สัญญาณตอนนี้" text={explanation.signal} />
          <Block title="ข่าวและความเสี่ยง" text={explanation.news} />
          <Block title="เกณฑ์คุณภาพ" text={explanation.gate} />
        </div>
      )}

      <p className="mt-3 text-[11px] text-muted-foreground">
        AI อ่านผลที่ระบบคำนวณมาแล้วเท่านั้น ไม่ได้เดาราคาเอง และไม่มีสิทธิ์เปลี่ยนสัญญาณสุดท้าย
      </p>
    </section>
  );
}

/** Read-only view for a locked prediction's stored explanation. */
export function AiExplanationView({ ai }: { ai: AiExplanation }) {
  return (
    <div className="space-y-3 text-sm">
      <Block title="สัญญาณตอนนั้น" text={ai.signal} />
      <Block title="ข่าวและความเสี่ยง" text={ai.news} />
      <Block title="เกณฑ์คุณภาพ" text={ai.gate} />
      <p className="text-[11px] text-muted-foreground">
        {ai.source === "ai" ? "เขียนโดย AI" : "ข้อความสำรองของระบบ"} · บันทึกไว้พร้อมคำพยากรณ์
      </p>
    </div>
  );
}

function Block({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground">{title}</h3>
      <p className="mt-0.5">{text}</p>
    </div>
  );
}
