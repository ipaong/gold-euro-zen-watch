import { createFileRoute } from "@tanstack/react-router";

import { AppShell, Disclaimer } from "@/components/app/AppShell";

export const Route = createFileRoute("/guide")({
  head: () => ({
    meta: [
      { title: "คู่มือมือใหม่ — Market Prediction Playground ทำงานอย่างไร" },
      {
        name: "description",
        content:
          "อธิบายทีละขั้นว่า 5 โมเดลโหวตคืออะไร ต่างจาก 5 ฉากทัศน์อนาคตอย่างไร หัวหน้าทีมทำหน้าที่อะไร และทำไมเกณฑ์คุณภาพจึงเป็นตัวตัดสินสัญญาณสุดท้าย",
      },
      { property: "og:title", content: "คู่มือมือใหม่ — Market Prediction Playground ทำงานอย่างไร" },
      {
        property: "og:description",
        content: "เข้าใจ 5 โมเดลโหวต ฉากทัศน์อนาคต และเกณฑ์คุณภาพ ในภาษาที่มือใหม่อ่านรู้เรื่อง",
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
    title: "2. 5 โมเดลโหวตแยกกัน",
    body: "เทรนด์ · โมเมนตัม · โครงสร้างราคา · ข่าว & มหภาค · ความผันผวน & สถิติ แต่ละตัวมองคนละมุมและออกเสียงของตัวเองว่า ซื้อ / ขาย / รอ พร้อมบอกเหตุผลและความเสี่ยง",
  },
  {
    title: "3. หัวหน้าทีมสรุปภาพรวม",
    body: "Ensemble คือผู้ช่วยเรียบเรียง ถ่วงน้ำหนักความเห็นตามสภาพตลาด แต่ไม่มีสิทธิ์โหวต และห้ามเปลี่ยนสัญญาณสุดท้าย",
  },
  {
    title: "4. วาดฉากทัศน์อนาคต 5 แบบ",
    body: "เดินหน้าต่อ · เบรกเอาต์ · ย่อก่อนไป · กลับตัว · ออกข้าง แต่ละแบบมีเส้นทางราคา 5 แท่งและน้ำหนักความเป็นไปได้ ตรงนี้คนละเรื่องกับ 5 โมเดลโหวต",
  },
  {
    title: "5. เกณฑ์คุณภาพตัดสิน",
    body: "นับเสียงจาก 5 โมเดล แล้วตรวจ 5 ข้อ: เสียงตรงกันพอไหม ความมั่นใจถึงเกณฑ์ไหม ขัดแย้งกันไหม ใกล้ข่าวแรงไหม ผันผวนผิดปกติไหม ถ้าข้อใดไม่ผ่าน สัญญาณสุดท้ายจะเป็น “รอ”",
  },
];

const faqs = [
  {
    q: "ทำไมระบบบอก “รอ” บ่อย",
    a: "เพราะเกณฑ์คุณภาพออกแบบให้เข้มงวด การไม่เข้าตลาดเมื่อสัญญาณไม่ชัดคือผลลัพธ์ที่ถูกต้อง ไม่ใช่ความล้มเหลว",
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

        <Disclaimer />
      </div>
    </AppShell>
  );
}
