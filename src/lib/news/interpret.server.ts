import type { EconomicEvent, NewsInterpretation, NewsItem } from "../types";

const SYSTEM = `คุณคือผู้ช่วยอ่านข่าวมหภาคสำหรับคู่ XAUEUR (ทองคำตีราคาด้วยยูโร)

กติกาที่ห้ามฝ่าฝืน:
- ใช้ได้เฉพาะพาดหัวข่าวและตัวเลขมหภาคที่ให้มาเท่านั้น ห้ามแต่งข่าว ห้ามแต่งตัวเลข ห้ามอ้างเหตุการณ์ที่ไม่มีในรายการ
- supportingNewsIds / supportingEventIds ต้องเป็น id ที่มีอยู่จริงในข้อมูลที่ให้มาเท่านั้น
- คุณไม่ใช่ผู้ตัดสินสัญญาณสุดท้าย คุณให้แค่มุมมองข่าว ระบบจะเอาไปเป็น 1 ใน 5 เสียงโหวต
- ทองแข็ง + ยูโรอ่อน = XAUEUR ขึ้น (BUY) / ทองอ่อน + ยูโรแข็ง = XAUEUR ลง (SELL) / ไม่ชัด = WAIT
- keyDrivers และ risks เขียนเป็นภาษาไทยง่าย ๆ อย่างละ 2-4 ข้อ สั้น ๆ
- ถ้าข่าวน้อยหรือขัดแย้งกัน ให้ตอบ WAIT และตั้ง confidence ต่ำ`;

interface InterpretInput {
  headlines: NewsItem[];
  events: EconomicEvent[];
  asOf: number;
}

/** Runs the Lovable AI reading. Throws on any failure — the caller falls back. */
export async function interpretNews(input: InterpretInput): Promise<NewsInterpretation> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI ยังไม่พร้อมใช้งาน");

  const { streamText, Output } = await import("ai");
  const { z } = await import("zod");
  const { createLovableAiGatewayProvider } = await import("../ai-gateway.server");

  const schema = z.object({
    goldBias: z.enum(["bullish", "neutral", "bearish"]),
    eurBias: z.enum(["strong", "neutral", "weak"]),
    xaueurBias: z.enum(["BUY", "SELL", "WAIT"]),
    confidence: z.number(),
    keyDrivers: z.array(z.string()),
    risks: z.array(z.string()),
    supportingNewsIds: z.array(z.string()),
    supportingEventIds: z.array(z.string()),
  });

  const payload = {
    asOf: new Date(input.asOf).toISOString(),
    headlines: input.headlines.map((h) => ({
      id: h.id,
      title: h.title,
      source: h.source,
      publishedAt: new Date(h.publishedAt).toISOString(),
      impact: h.impact,
    })),
    macroReleases: input.events
      .filter((e) => e.released)
      .slice(-12)
      .map((e) => ({
        id: e.id,
        name: e.name,
        currency: e.currency,
        actual: e.actual,
        previous: e.previous,
        time: new Date(e.time).toISOString(),
      })),
  };

  const gateway = createLovableAiGatewayProvider(apiKey);
  const result = streamText({
    model: gateway("google/gemini-3.7-flash"),
    system: SYSTEM,
    prompt: `ข้อมูลข่าวและตัวเลขมหภาคจริง (JSON):\n${JSON.stringify(payload)}`,
    output: Output.object({ schema }),
  });

  const out = await result.output;

  const newsIds = new Set(input.headlines.map((h) => h.id));
  const eventIds = new Set(input.events.map((e) => e.id));
  return {
    goldBias: out.goldBias,
    eurBias: out.eurBias,
    xaueurBias: out.xaueurBias,
    confidence: Math.max(0, Math.min(100, Math.round(out.confidence))),
    keyDrivers: out.keyDrivers.slice(0, 4),
    risks: out.risks.slice(0, 4),
    // Hard guard: the AI may only point at ids that really exist.
    supportingNewsIds: out.supportingNewsIds.filter((id) => newsIds.has(id)).slice(0, 6),
    supportingEventIds: out.supportingEventIds.filter((id) => eventIds.has(id)).slice(0, 6),
    source: "ai",
    generatedAt: Date.now(),
  };
}
