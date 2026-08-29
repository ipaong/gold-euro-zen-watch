import { Slider } from "@/components/ui/slider";
import type { AppSettings } from "@/lib/types";

/** Shared quality-gate controls used by the dashboard sheet and the settings page. */
export function SettingsFields({
  settings,
  onChange,
}: {
  settings: AppSettings;
  onChange: (s: AppSettings) => void;
}) {
  return (
    <div className="space-y-6">
      <Field
        label={`ความมั่นใจขั้นต่ำ: ${settings.confidenceThreshold}%`}
        hint="ต่ำกว่านี้ ระบบจะบอกให้รอ"
        value={settings.confidenceThreshold}
        min={40}
        max={90}
        step={5}
        onChange={(v) => onChange({ ...settings, confidenceThreshold: v })}
      />
      <Field
        label={`หลักฐานทิศทางขั้นต่ำ: ${Math.max(2, Math.min(4, settings.minAgreement - 1))} ชุด`}
        hint="แรงราคาเร็ว · ทิศ 5–12 แท่ง · EMA · Momentum · โครงสร้าง"
        value={settings.minAgreement}
        min={2}
        max={5}
        step={1}
        onChange={(v) => onChange({ ...settings, minAgreement: v })}
      />
      <Field
        label={`เลี่ยงข่าวแรงก่อน-หลัง: ${settings.newsAvoidMinutes} นาที`}
        hint="ข่าวใกล้เกินไปจะลดความมั่นใจและแสดงคำเตือน"
        value={settings.newsAvoidMinutes}
        min={0}
        max={120}
        step={15}
        onChange={(v) => onChange({ ...settings, newsAvoidMinutes: v })}
      />
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium">{label}</p>
      <p className="mb-3 text-xs text-muted-foreground">{hint}</p>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0] ?? value)}
        thumbProps={{ "aria-label": label }}
      />
    </div>
  );
}
