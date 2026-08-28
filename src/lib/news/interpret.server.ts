import type {
  Direction,
  EconomicEvent,
  EurBias,
  GoldBias,
  NewsInterpretation,
  NewsItem,
} from "../types";

const SYSTEM = `คุณคือผู้เชี่ยวชาญการวิเคราะห์ข่าวมหภาคสำหรับราคาทองคำโลก (COMEX Gold Futures · GC=F เทรดเป็นสกุล USD)

หลักการวิเคราะห์ทิศทางทองคำ (Gold/USD Macro Focus):
1. นโยบายการเงินสหรัฐฯ & Fed: แนวโน้มลดดอกเบี้ย (Dovish / Rate Cut) หนุนทองคำ (Bullish) | แนวโน้มขึ้นดอกเบี้ย/คงดอกเบี้ยสูงนาน (Hawkish / Higher for Longer) กดดันทอด (Bearish)
2. ค่าเงินดอลลาร์ (USD/DXY) & ผลตอบแทนพันธบัตรสหรัฐฯ (Yields): ดอลลาร์อ่อน/Yields ลด หนุนทองคำ | ดอลลาร์แข็ง/Yields พุ่ง กดดันทองคำ
3. ปัจจัยภูมิรัฐศาสตร์ & Safe-Haven: ความตึงเครียด/สงคราม/ความไม่แน่นอน หนุนทองคำในฐานะสินทรัพย์ปลอดภัย
4. ฝั่งยูโร/ECB: เป็นเพียงปัจจัยประกอบรองสำหรับสินทรัพย์ GC=F ไม่นำมาหักล้างปัจจัยหลักของ USD

กติกาที่ห้ามฝ่าฝืน:
- ใช้ได้เฉพาะพาดหัวข่าวและตัวเลขมหภาคที่ให้มาเท่านั้น ห้ามแต่งข่าว ห้ามแต่งตัวเลข ห้ามอ้างเหตุการณ์ที่ไม่มีในรายการ
- supportingNewsIds / supportingEventIds ต้องเป็น id ที่มีอยู่จริงในข้อมูลที่ให้มาเท่านั้น
- คุณไม่ใช่ผู้ตัดสินสัญญาณสุดท้าย คุณให้แค่มุมมองข่าว ระบบจะนำไปรวมเป็น 1 ใน 5 เสียงโหวตของโมเดล
- ให้เน้น goldBias เป็นหลักสำหรับทองคำ; ฟิลด์ eurBias และ xaueurBias คงไว้เพื่อความเข้ากันได้ของระบบเดิม
- keyDrivers และ risks เขียนเป็นภาษาไทยที่กระชับ ตรงประเด็น เข้าใจง่าย อย่างละ 2-4 ข้อ
- ถ้าข่าวน้อยหรือทิศทางยังขัดแย้งกัน ให้ตอบ WAIT และตั้ง confidence ต่ำ

ตอบกลับเป็น JSON ล้วนเท่านั้น (ห้ามมีข้อความอื่นหรือ markdown) รูปแบบ:
{"goldBias":"bullish|neutral|bearish","eurBias":"strong|neutral|weak","xaueurBias":"BUY|SELL|WAIT","confidence":0-100,"keyDrivers":["..."],"risks":["..."],"supportingNewsIds":["..."],"supportingEventIds":["..."]}`;

export interface RawInterpretation {
  goldBias: GoldBias;
  eurBias: EurBias;
  xaueurBias: Direction;
  confidence: number;
  keyDrivers: string[];
  risks: string[];
  supportingNewsIds: string[];
  supportingEventIds: string[];
}

const GOLD = ["bullish", "neutral", "bearish"];
const EUR = ["strong", "neutral", "weak"];
const DIR = ["BUY", "SELL", "WAIT"];

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** Tolerant JSON extraction — a stray sentence or code fence must not break the app. */
export function parseInterpretation(text: string): RawInterpretation | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const p = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    if (!GOLD.includes(String(p["goldBias"]))) return null;
    if (!EUR.includes(String(p["eurBias"]))) return null;
    if (!DIR.includes(String(p["xaueurBias"]))) return null;
    return {
      goldBias: p["goldBias"] as GoldBias,
      eurBias: p["eurBias"] as EurBias,
      xaueurBias: p["xaueurBias"] as Direction,
      confidence: Number(p["confidence"]) || 0,
      keyDrivers: strArray(p["keyDrivers"]),
      risks: strArray(p["risks"]),
      supportingNewsIds: strArray(p["supportingNewsIds"]),
      supportingEventIds: strArray(p["supportingEventIds"]),
    };
  } catch {
    return null;
  }
}

export interface InterpretInput {
  headlines: NewsItem[];
  events: EconomicEvent[];
  asOf: number;
}

export function buildInterpretationPayload(input: InterpretInput) {
  return {
    asOf: new Date(input.asOf).toISOString(),
    headlines: input.headlines
      .filter((headline) => headline.publishedAt <= input.asOf)
      .map((h) => ({
        id: h.id,
        title: h.title,
        source: h.source,
        publishedAt: new Date(h.publishedAt).toISOString(),
        impact: h.impact,
      })),
    macroReleases: input.events
      .filter((e) => e.released && e.time <= input.asOf)
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
}

export function guardInterpretation(
  out: RawInterpretation,
  input: InterpretInput,
  generatedAt = Date.now(),
): NewsInterpretation {
  const newsIds = new Set(
    input.headlines.filter((headline) => headline.publishedAt <= input.asOf).map((h) => h.id),
  );
  const eventIds = new Set(
    input.events
      .filter((e) => e.released && e.time <= input.asOf)
      .map((e) => e.id),
  );
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
    generatedAt,
  };
}

/** Runs the Lovable AI reading. Throws on any failure — the caller falls back. */
export async function interpretNews(input: InterpretInput): Promise<NewsInterpretation> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI ยังไม่พร้อมใช้งาน");

  const { streamText } = await import("ai");
  const { createLovableAiGatewayProvider } = await import("../ai-gateway.server");

  const payload = buildInterpretationPayload(input);

  const gateway = createLovableAiGatewayProvider(apiKey);
  const result = streamText({
    model: gateway("google/gemini-3.7-flash"),
    system: SYSTEM,
    prompt: `ข้อมูลข่าวและตัวเลขมหภาคจริง (JSON):\n${JSON.stringify(payload)}`,
  });

  const out = parseInterpretation(await result.text);
  if (!out) throw new Error("AI ตอบกลับในรูปแบบที่อ่านไม่ได้");

  return guardInterpretation(out, input);
}
