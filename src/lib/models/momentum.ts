import type { MarketSnapshot, ModelVote } from "../types";

/** MODEL 2 — Momentum: strength and acceleration of the current move. */
export function momentumModel(s: MarketSnapshot): ModelVote {
  const factors: string[] = [];
  const risks: string[] = [];

  factors.push(`RSI 14 = ${s.rsi14.toFixed(1)}`);
  factors.push(
    `MACD ฮิสโตแกรม ${s.macdHist >= 0 ? "+" : ""}${s.macdHist.toFixed(2)} (${
      s.macdHist > s.macdHistPrev ? "กำลังเร่งขึ้น" : "กำลังชะลอ"
    })`,
  );
  factors.push(`แรงของแท่งเทียน 5 แท่งล่าสุด ${Math.round(s.bodyStrength * 100)}%`);
  if (s.consecutiveBull >= 3) factors.push(`แท่งเขียวติดกัน ${s.consecutiveBull} แท่ง`);
  if (s.consecutiveBear >= 3) factors.push(`แท่งแดงติดกัน ${s.consecutiveBear} แท่ง`);
  factors.push(`ATR = ${s.atr14.toFixed(2)} (${s.atrPct.toFixed(2)}% ของราคา)`);

  let score = s.momentumScore;

  // Exhaustion: extreme RSI plus long candle streaks reduce conviction.
  const overbought = s.rsi14 > 70;
  const oversold = s.rsi14 < 30;
  if (overbought) {
    risks.push("RSI เข้าเขตซื้อมากเกินไป เสี่ยงพักตัวระยะสั้น");
    score *= 0.7;
  }
  if (oversold) {
    risks.push("RSI เข้าเขตขายมากเกินไป เสี่ยงเด้งกลับระยะสั้น");
    score *= 0.7;
  }
  if (s.consecutiveBull >= 5 || s.consecutiveBear >= 5) {
    risks.push("ราคาวิ่งทางเดียวต่อเนื่องหลายแท่ง โอกาสพักตัวเพิ่มขึ้น");
    score *= 0.85;
  }
  if (s.bodyStrength < 0.3) {
    risks.push("แท่งเทียนไส้ยาว/ตัวสั้น แสดงถึงความลังเลของตลาด");
    score *= 0.8;
  }

  let direction: ModelVote["direction"] = "WAIT";
  if (score > 0.25) direction = "BUY";
  else if (score < -0.25) direction = "SELL";

  let confidence = Math.round(44 + Math.abs(score) * 45);
  if (s.atrRatio > 1.6) {
    confidence -= 5;
    risks.push("ความผันผวนพุ่งสูง สัญญาณโมเมนตัมเชื่อถือได้น้อยลง");
  }
  if (direction === "WAIT") risks.push("โมเมนตัมยังไม่มีฝ่ายไหนได้เปรียบชัดเจน");
  confidence = Math.max(20, Math.min(86, confidence));

  const summary =
    direction === "BUY"
      ? overbought
        ? "แรงซื้อยังเป็นบวก แต่เริ่มเข้าเขตซื้อมากเกินไปในระยะสั้น"
        : "แรงซื้อยังเป็นบวกและมีการเร่งตัวต่อเนื่อง"
      : direction === "SELL"
        ? oversold
          ? "แรงขายยังกดราคาอยู่ แต่เริ่มขายมากเกินไปในระยะสั้น"
          : "แรงขายมีน้ำหนักมากกว่าฝั่งซื้อ"
        : "โมเมนตัมค่อนข้างเป็นกลาง ยังไม่มีแรงผลักที่ชัดเจน";

  return {
    id: "momentum",
    name: "โมเมนตัม",
    direction,
    confidence,
    summary,
    factors,
    risks,
    unavailable: false,
  };
}
