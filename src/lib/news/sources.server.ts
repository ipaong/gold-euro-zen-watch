import type { EconomicEvent } from "../types";
import type { RawArticle } from "./normalize";
import { hashId } from "./normalize";

/**
 * Real, free/official data sources for the XAUEUR news layer.
 *
 * Headlines: GDELT (general/geopolitical), Federal Reserve press feed, ECB press feed.
 * Macro releases: BLS public API (US CPI / unemployment / payrolls),
 * Eurostat (euro-area HICP), ECB Data Portal (main refinancing rate).
 *
 * Every fetcher is best-effort: on failure it reports an error string and
 * returns nothing. We never fabricate a headline, a number, or a release.
 * (BEA and FRED are intentionally not used: both require an API key.)
 */

const UA = "XAUEUR-Signal-Lab/1.0 (educational demo)";

async function getText(url: string, ms = 8000, init?: RequestInit): Promise<string> {
  const res = await fetch(url, {
    ...init,
    headers: { "user-agent": UA, ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(ms),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.text();
}

export interface SourceResult {
  articles: RawArticle[];
  events: EconomicEvent[];
  errors: string[];
  providers: string[];
}

/* ------------------------------- headlines ------------------------------ */

function gdeltStamp(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

function parseGdeltDate(s: string): number {
  // 20260826T151500Z
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s);
  if (!m) return NaN;
  return Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!);
}

const GDELT_QUERY =
  '(gold OR bullion OR "Federal Reserve" OR FOMC OR ECB OR "euro zone" OR eurozone) sourcelang:eng';

/** GDELT DOC 2.0 article list, restricted to a window ending at `asOf`. */
export async function fetchGdelt(asOf: number): Promise<{ articles: RawArticle[]; error?: string }> {
  const params: Record<string, string> = {
    query: GDELT_QUERY,
    mode: "artlist",
    maxrecords: "75",
    format: "json",
    sort: "datedesc",
  };
  // The dated window query is very slow on GDELT; for a near-live request use the
  // fast `timespan` form. Older Time Machine timestamps still need the window,
  // and articles published after `asOf` are filtered out downstream either way.
  if (Date.now() - asOf < 2 * 60 * 60 * 1000) {
    params["timespan"] = "36h";
  } else {
    params["startdatetime"] = gdeltStamp(asOf - 36 * 60 * 60 * 1000);
    params["enddatetime"] = gdeltStamp(asOf);
  }
  const url = "https://api.gdeltproject.org/api/v2/doc/doc?" + new URLSearchParams(params).toString();

  try {
    // GDELT throttles to ~1 request / 5s per IP and answers 429 with plain text.
    // One delayed retry is enough; results are cached for 10 minutes anyway.
    let text = await getText(url, 15000);
    if (!text.trimStart().startsWith("{")) {
      await new Promise((r) => setTimeout(r, 6000));
      text = await getText(url, 15000);
    }
    if (!text.trimStart().startsWith("{")) throw new Error("ถูกจำกัดอัตราการเรียก (rate limit)");
    const json = JSON.parse(text) as {
      articles?: { title?: string; url?: string; domain?: string; seendate?: string }[];
    };
    const articles = (json.articles ?? [])
      .map((a) => ({
        title: a.title ?? "",
        url: a.url ?? "",
        source: a.domain ?? "GDELT",
        publishedAt: parseGdeltDate(a.seendate ?? ""),
      }))
      .filter((a) => a.title && a.url && Number.isFinite(a.publishedAt));
    return { articles };
  } catch (e) {
    return { articles: [], error: `GDELT: ${(e as Error).message}` };
  }
}

function parseRss(xml: string, source: string): RawArticle[] {
  const items = xml.split(/<item[\s>]/i).slice(1);
  const pick = (chunk: string, tag: string): string => {
    const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(chunk);
    if (!m) return "";
    return m[1]!
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();
  };
  return items
    .map((chunk) => ({
      title: pick(chunk, "title"),
      url: pick(chunk, "link"),
      source,
      publishedAt: Date.parse(pick(chunk, "pubDate") || pick(chunk, "dc:date")),
    }))
    .filter((a) => a.title && a.url && Number.isFinite(a.publishedAt));
}

export async function fetchOfficialFeeds(): Promise<{ articles: RawArticle[]; errors: string[] }> {
  const feeds: [string, string][] = [
    ["https://www.federalreserve.gov/feeds/press_monetary.xml", "Federal Reserve"],
    ["https://www.ecb.europa.eu/rss/press.html", "ECB"],
  ];
  const errors: string[] = [];
  const articles: RawArticle[] = [];
  await Promise.all(
    feeds.map(async ([url, source]) => {
      try {
        articles.push(...parseRss(await getText(url, 8000), source));
      } catch (e) {
        errors.push(`${source}: ${(e as Error).message}`);
      }
    }),
  );
  return { articles, errors };
}

/* ---------------------------- macro releases ---------------------------- */

function monthEnd(year: number, monthIndex0: number): number {
  return Date.UTC(year, monthIndex0 + 1, 0, 12, 0, 0);
}

const BLS_SERIES: Record<string, { name: string; impact: EconomicEvent["impact"]; unit: string }> = {
  CUUR0000SA0: { name: "สหรัฐฯ ดัชนีราคาผู้บริโภค (CPI, ดัชนี)", impact: "high", unit: "" },
  LNS14000000: { name: "สหรัฐฯ อัตราว่างงาน", impact: "high", unit: "%" },
  CES0000000001: { name: "สหรัฐฯ การจ้างงานนอกภาคเกษตร (พันตำแหน่ง)", impact: "high", unit: "" },
};

export async function fetchBls(asOf: number): Promise<{ events: EconomicEvent[]; error?: string }> {
  const year = new Date(asOf).getUTCFullYear();
  try {
    const text = await getText("https://api.bls.gov/publicAPI/v1/timeseries/data/", 10000, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        seriesid: Object.keys(BLS_SERIES),
        startyear: String(year - 1),
        endyear: String(year),
      }),
    });
    const json = JSON.parse(text) as {
      Results?: {
        series?: {
          seriesID: string;
          data?: { year: string; period: string; periodName: string; value: string }[];
        }[];
      };
    };
    const events: EconomicEvent[] = [];
    for (const s of json.Results?.series ?? []) {
      const meta = BLS_SERIES[s.seriesID];
      if (!meta) continue;
      const rows = (s.data ?? []).filter((d) => /^M\d\d$/.test(d.period)).slice(0, 4);
      rows.forEach((d, i) => {
        const monthIdx = Number(d.period.slice(1)) - 1;
        const prev = rows[i + 1];
        events.push({
          id: hashId("ev", `bls-${s.seriesID}-${d.year}-${d.period}`),
          time: monthEnd(Number(d.year), monthIdx),
          currency: "USD",
          impact: meta.impact,
          name: `${meta.name} — ${d.periodName} ${d.year}`,
          previous: prev ? `${prev.value}${meta.unit}` : "—",
          forecast: "—",
          actual: `${d.value}${meta.unit}`,
          released: true,
          source: "BLS",
          url: `https://data.bls.gov/timeseries/${s.seriesID}`,
        });
      });
    }
    return { events };
  } catch (e) {
    return { events: [], error: `BLS: ${(e as Error).message}` };
  }
}

export async function fetchEurostatHicp(): Promise<{ events: EconomicEvent[]; error?: string }> {
  try {
    const text = await getText(
      "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_manr?format=JSON&geo=EA20&coicop=CP00&lastTimePeriod=4",
      10000,
    );
    const json = JSON.parse(text) as {
      value?: Record<string, number>;
      dimension?: { time?: { category?: { index?: Record<string, number> } } };
    };
    const index = json.dimension?.time?.category?.index ?? {};
    const periods = Object.entries(index).sort((a, b) => a[1] - b[1]);
    const events: EconomicEvent[] = [];
    periods.forEach(([period, pos], i) => {
      const v = json.value?.[String(pos)];
      if (v === undefined) return;
      const prevPos = periods[i - 1]?.[1];
      const prev = prevPos === undefined ? undefined : json.value?.[String(prevPos)];
      const [y, m] = period.split("-");
      events.push({
        id: hashId("ev", `estat-hicp-${period}`),
        time: monthEnd(Number(y), Number(m ?? "1") - 1),
        currency: "EUR",
        impact: "high",
        name: `ยูโรโซน เงินเฟ้อ HICP (รายปี) — ${period}`,
        previous: prev === undefined ? "—" : `${prev}%`,
        forecast: "—",
        actual: `${v}%`,
        released: true,
        source: "Eurostat",
        url: "https://ec.europa.eu/eurostat/databrowser/view/prc_hicp_manr/default/table",
      });
    });
    return { events };
  } catch (e) {
    return { events: [], error: `Eurostat: ${(e as Error).message}` };
  }
}

export async function fetchEcbRate(): Promise<{ events: EconomicEvent[]; error?: string }> {
  try {
    const csv = await getText(
      "https://data-api.ecb.europa.eu/service/data/FM/B.U2.EUR.4F.KR.MRR_FR.LEV?lastNObservations=3&format=csvdata",
      10000,
    );
    const lines = csv.trim().split(/\r?\n/);
    const header = lines[0]!.split(",");
    const tIdx = header.indexOf("TIME_PERIOD");
    const vIdx = header.indexOf("OBS_VALUE");
    if (tIdx < 0 || vIdx < 0) throw new Error("รูปแบบข้อมูลไม่ตรง");
    const rows = lines.slice(1).map((l) => l.split(","));
    const events: EconomicEvent[] = [];
    rows.forEach((cols, i) => {
      const period = cols[tIdx]!;
      const value = cols[vIdx]!;
      const prev = rows[i - 1]?.[vIdx];
      const time = Date.parse(period.length === 7 ? `${period}-01T12:00:00Z` : `${period}T12:00:00Z`);
      if (!Number.isFinite(time)) return;
      events.push({
        id: hashId("ev", `ecb-mrr-${period}`),
        time,
        currency: "EUR",
        impact: "high",
        name: `ECB อัตราดอกเบี้ยนโยบายหลัก (MRO) — ${period}`,
        previous: prev ? `${prev}%` : "—",
        forecast: "—",
        actual: `${value}%`,
        released: true,
        source: "ECB Data Portal",
        url: "https://data.ecb.europa.eu/main-figures/ecb-interest-rates-and-exchange-rates/key-ecb-interest-rates",
      });
    });
    return { events };
  } catch (e) {
    return { events: [], error: `ECB: ${(e as Error).message}` };
  }
}

/** Fetch everything in parallel; partial failures are reported, never faked. */
export async function fetchAllSources(asOf: number): Promise<SourceResult> {
  const [gdelt, feeds, bls, hicp, ecb] = await Promise.all([
    fetchGdelt(asOf),
    fetchOfficialFeeds(),
    fetchBls(asOf),
    fetchEurostatHicp(),
    fetchEcbRate(),
  ]);

  const errors = [gdelt.error, ...feeds.errors, bls.error, hicp.error, ecb.error].filter(
    Boolean,
  ) as string[];

  const providers: string[] = [];
  if (gdelt.articles.length) providers.push("GDELT");
  if (feeds.articles.length) providers.push("Fed/ECB press");
  if (bls.events.length) providers.push("BLS");
  if (hicp.events.length) providers.push("Eurostat");
  if (ecb.events.length) providers.push("ECB Data Portal");

  return {
    articles: [...gdelt.articles, ...feeds.articles],
    events: [...bls.events, ...hicp.events, ...ecb.events],
    errors,
    providers,
  };
}
