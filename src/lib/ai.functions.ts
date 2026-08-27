import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const AnalystInput = z.object({
  direction: z.string(),
  rawDirection: z.string(),
  confidence: z.number(),
  agree: z.number(),
  total: z.number(),
  blocked: z.boolean(),
  reason: z.string(),
  price: z.number(),
  regime: z.string(),
  atr: z.number(),
  support: z.number(),
  resistance: z.number(),
  ensembleDirection: z.string(),
  ensembleConfidence: z.number(),
  ensembleSummary: z.string(),
  newsRisk: z.string(),
  goldBias: z.string(),
  eurBias: z.string(),
  minutesToHighImpact: z.number().nullable(),
  nextHighImpact: z.string().nullable(),
  models: z.array(
    z.object({
      name: z.string(),
      direction: z.string(),
      confidence: z.number(),
      summary: z.string(),
    }),
  ),
  failedChecks: z.array(z.object({ label: z.string(), detail: z.string() })),
  passedChecks: z.array(z.string()),
});

export type AnalystInput = z.infer<typeof AnalystInput>;

export interface AnalystOutput {
  signal: string;
  news: string;
  gate: string;
}

const SYSTEM = `คุณคือ "นักวิเคราะห์ผู้ช่วย" ของแอปทดลองพยากรณ์ XAUEUR (ทองคำ/ยูโร) กรอบเวลา 15 นาที

กติกาที่ห้ามฝ่าฝืน:
- คุณได้รับผลวิเคราะห์ที่ระบบคำนวณมาแล้วเท่านั้น ห้ามคำนวณหรือเดาราคา ตัวเลข หรือทิศทางใหม่เอง
- ห้ามเปลี่ยนหรือคัดค้านสัญญาณสุดท้าย (direction) ของระบบ หน้าที่คุณคือ "อธิบาย" ว่าทำไมระบบสรุปแบบนั้น
- ห้ามให้คำแนะนำการลงทุน ห้ามบอกขนาดสัญญา ห้ามสัญญาผลกำไร
- ตอบเป็นภาษาไทยง่าย ๆ ระดับมือใหม่ ไม่ใช้ศัพท์เทคนิคโดยไม่อธิบาย
- แต่ละหัวข้อยาว 2-3 ประโยค กระชับ

ตอบกลับเป็น JSON เท่านั้น รูปแบบ:
{"signal":"...","news":"...","gate":"..."}
- signal = อธิบายสัญญาณสุดท้ายและเสียงโหวตของโมเดล
- news = อธิบายสถานการณ์ข่าว/ปฏิทินเศรษฐกิจและความเสี่ยง
- gate = อธิบายเกณฑ์คุณภาพ ว่าติดข้อไหน หรือผ่านเพราะอะไร และอะไรจะทำให้เปลี่ยน`;

function extractJson(text: string): AnalystOutput | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as Partial<AnalystOutput>;
    if (!parsed.signal || !parsed.news || !parsed.gate) return null;
    return { signal: parsed.signal, news: parsed.news, gate: parsed.gate };
  } catch {
    return null;
  }
}

/**
 * Phase 2B: Lovable AI reads the structured snapshot and writes a Thai
 * explanation. It never overrides the engine — the caller falls back to the
 * deterministic template when this throws.
 */
export const explainAnalysis = createServerFn({ method: "POST" })
  .validator((input: unknown) => AnalystInput.parse(input))
  .handler(async ({ data }): Promise<AnalystOutput> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI ยังไม่พร้อมใช้งาน");

    const { streamText } = await import("ai");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(apiKey);

    const result = streamText({
      model: gateway("google/gemini-3.7-flash"),
      system: SYSTEM,
      prompt: `นี่คือผลวิเคราะห์ของระบบ (JSON):\n${JSON.stringify(data)}`,
    });

    const text = await result.text;
    const parsed = extractJson(text);
    if (!parsed) throw new Error("AI ตอบกลับในรูปแบบที่อ่านไม่ได้");
    return parsed;
  });
