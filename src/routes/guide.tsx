import { createFileRoute } from "@tanstack/react-router";

import { AppShell, Disclaimer } from "@/components/app/AppShell";

export const Route = createFileRoute("/guide")({
  head: () => ({
    meta: [
      { title: "คู่มือมือใหม่ — Market Prediction Playground ทำงานอย่างไร" },
      {
        name: "description",
        content:
          "อธิบายทีละขั้นว่า Direction Engine V3 Replay อดีตอย่างไร 5 โมเดลช่วยตรวจอะไร และทำไมเกณฑ์กันสวนเทรนด์จึงเป็นตัวตัดสินสัญญาณสุดท้าย",
      },
      {
        property: "og:title",
        content: "คู่มือมือใหม่ — Market Prediction Playground ทำงานอย่างไร",
      },
      {
        property: "og:description",
        content: "เข้าใจ Direction Engine V3 โมเดลประกอบ ฉากทัศน์อนาคต และเกณฑ์กันสวนเทรนด์",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GuidePage,
});

const steps = [
  {
    title: "1. เก็บสภาพตลาด",
    body: "ระบบอ่านแท่งเทียน Gold Futures GC=F กรอบ 15 นาทีจาก Yahoo แบบ delayed หรือ snapshot เดโมที่เป็นสินทรัพย์เดียวกัน แล้วคำนวณ EMA20/50/200, RSI, MACD, ATR, แนวรับ-แนวต้าน และความผันผวน โดยไม่ใช้ข้อมูลอนาคต",
  },
  {
    title: "2. Direction Engine V3 Replay แล้วจับทิศ 5 แท่ง",
    body: "อ่านแรงราคา 1/3/5/12 แท่งร่วมกับ EMA เร็ว Momentum และโครงสร้าง โดยตามเทรนด์เป็นค่าเริ่มต้น ส่วนการสวนเทรนด์ต้องมีทั้งโครงสร้างและ Momentum ยืนยันจริง",
  },
  {
    title: "3. 5 โมเดลช่วยตรวจคนละมุม",
    body: "เทรนด์ · โมเมนตัม · โครงสร้างราคา · ข่าว & มหภาค · ความผันผวน & สถิติ ยังแสดงและเก็บคะแนนแยกกัน แต่เป็นความเห็นประกอบ ไม่ถูกนับซ้ำเพื่อบังคับ Final Signal",
  },
  {
    title: "4. วาดฉากทัศน์อนาคต 5 แบบ",
    body: "เดินหน้าต่อ · เบรกเอาต์ · ย่อก่อนไป · กลับตัว · ออกข้าง แต่ละแบบมีเส้นทางราคา 5 แท่งและน้ำหนักความเป็นไปได้ ตรงนี้เป็นภาพจำลอง ไม่ใช่เสียงตัดสิน Final Signal",
  },
  {
    title: "5. เกณฑ์คุณภาพตัดสิน",
    body: "ตรวจความชัดของ edge ความมั่นใจ ข่าว ความผันผวน และ Anti-opposite guard ถ้าคำทายสวนทั้งแรงราคาเร็วและทิศ 5–12 แท่ง ระบบจะบังคับ WAIT เว้นแต่มี reversal confirmation จริง",
  },
];

const faqs = [
  {
    q: "ทำไมระบบบอก “รอ” บ่อย",
    a: "V3 จะรอเมื่อแรงราคาแต่ละช่วงหักล้างกันหรือ Replay ที่เรียนจากอดีตเห็นทิศตรงข้าม ไม่ใช้ WAIT เพียงเพราะโมเดลประกอบเห็นต่างกัน",
  },
  {
    q: "โหมดย้อนเวลาแอบดูอนาคตได้ไหม",
    a: "ไม่ได้ ระบบดึงเฉพาะแท่งที่ปิดก่อนเวลานั้น และผลข่าวจริงจะถูกซ่อนไว้จนถึงเวลาประกาศ จึงไม่มีการรู้อนาคตล่วงหน้า",
  },
  {
    q: "ราคาเป็นของจริงหรือไม่",
    a: "เมื่อ Yahoo ผ่าน validation และมีแท่งปิดสะสมครบ ระบบจะแสดงข้อมูล delayed ของ Gold Futures GC=F; หากข้อมูลค้าง ไม่ครบ ถูกจำกัดอัตรา หรือไม่ผ่าน validation ระบบจะใช้ snapshot เดโม GC=F ที่ติดป้ายชัดเจนแทน",
  },
  {
    q: "บันทึกแล้วแก้ได้ไหม",
    a: "แก้ไม่ได้ในแอป เมื่อบันทึกแล้วคำพยากรณ์จะถูกล็อกในเครื่อง เขียนเพิ่มได้เฉพาะผลจริงที่เปิดเผยภายหลัง",
  },
];

function GuidePage() {
  return (
    <AppShell>
      <div className="space-y-4">
        <section className="rounded-xl border border-border bg-card p-4">
          <h1 className="text-lg font-semibold">แอปนี้ทำงานอย่างไร</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            อ่าน 5 ขั้นนี้จบ คุณจะเข้าใจทุกตัวเลขบนหน้าวิเคราะห์
          </p>
          <ol className="mt-3 space-y-3">
            {steps.map((s) => (
              <li key={s.title} className="rounded-lg bg-muted p-3">
                <h2 className="text-sm font-semibold">{s.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold">คำถามที่พบบ่อย</h2>
          <dl className="mt-2 divide-y divide-border">
            {faqs.map((f) => (
              <div key={f.q} className="py-3">
                <dt className="text-sm font-medium">{f.q}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold">GC=F vs GOLD vs XAUEUR — ราคาเดียวกันไหม?</h2>
          <div className="mt-2 space-y-2 text-sm text-muted-foreground">
            <p>
              ระบบนี้ใช้ <strong>GC=F</strong> (COMEX Gold Futures) จาก Yahoo Finance
              เป็นแหล่งข้อมูลหลัก ซึ่ง<strong>ใช้เป็น directional proxy ดูทิศทางทองคำได้</strong>{" "}
              แต่ไม่ใช่ราคาเดียวกับที่เห็นบนแพลตฟอร์มโบรกเกอร์
            </p>
            <dl className="mt-2 space-y-1.5 text-xs">
              <div className="rounded-lg bg-muted p-2.5">
                <dt className="font-semibold text-foreground">GC=F (COMEX Gold Futures)</dt>
                <dd>
                  สัญญาซื้อขายล่วงหน้าทองคำ สกุล USD ซื้อขายบน CME Globex มี session hours ตาม COMEX
                  ราคาที่ Yahoo แสดงเป็น delayed quote
                </dd>
              </div>
              <div className="rounded-lg bg-muted p-2.5">
                <dt className="font-semibold text-foreground">GOLD (XM CFD)</dt>
                <dd>
                  สัญญา CFD ของทองคำใน MT5/XM สกุล USD ราคาอิงจาก interbank spot gold + spread
                  ของโบรกเกอร์ session/timezone ต่างจาก COMEX
                </dd>
              </div>
              <div className="rounded-lg bg-muted p-2.5">
                <dt className="font-semibold text-foreground">XAUEUR (XAU/EUR)</dt>
                <dd>
                  ราคาทองคำต่อยูโร — ต่างจาก GOLD/GC=F ทั้ง FX conversion basis (EUR แทน USD) และ
                  spread/session ของโบรกเกอร์
                </dd>
              </div>
            </dl>
            <p className="text-xs">
              สรุป: ทิศทาง M15 อาจคล้ายกัน แต่ราคา, wick, basis, FX rate, timezone และ session hours
              <strong> ไม่เท่ากัน</strong> — ห้ามเอาระดับราคาจาก GC=F ไปเปรียบเทียบกับ GOLD/XAUEUR
              ตรง ๆ
            </p>
          </div>
        </section>

        <Disclaimer />
      </div>
    </AppShell>
  );
}
