import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Feedback = {
  prediction_id: string;
  user_id?: string | null;
  symbol: string;
  timeframe: string;
  predicted_direction: "BUY" | "SELL" | "WAIT";
  actual_direction: "BUY" | "SELL" | "WAIT";
  direction_correct: boolean | null;
  confidence: number;
  model_scores: unknown[];
  score: Record<string, unknown>;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "POST only" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Supabase service configuration missing" }, 500);

  let feedback: Feedback;
  try {
    feedback = (await request.json()) as Feedback;
    if (!feedback.prediction_id || !feedback.symbol || !feedback.timeframe) {
      return json({ error: "prediction_id, symbol and timeframe are required" }, 400);
    }
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { error: insertError } = await admin
    .from("prediction_learning_feedback")
    .upsert(feedback, { onConflict: "prediction_id", ignoreDuplicates: true });
  if (insertError) return json({ error: insertError.message }, 500);

  const { data, error: readError } = await admin
    .from("prediction_learning_feedback")
    .select("predicted_direction, actual_direction, direction_correct, confidence, model_scores")
    .eq("symbol", feedback.symbol)
    .eq("timeframe", feedback.timeframe)
    .order("settled_at", { ascending: false })
    .limit(500);
  if (readError) return json({ error: readError.message }, 500);

  const settled = (data ?? []).filter((row) => row.direction_correct !== null);
  const correct = settled.filter((row) => row.direction_correct === true).length;
  const byDirection = ["BUY", "SELL", "WAIT"].map((direction) => {
    const rows = settled.filter((row) => row.predicted_direction === direction);
    const hits = rows.filter((row) => row.direction_correct === true).length;
    return { direction, samples: rows.length, hits, accuracy: rows.length ? hits / rows.length : null };
  });
  const modelStats = new Map<string, { samples: number; hits: number }>();
  for (const row of settled) {
    for (const model of Array.isArray(row.model_scores) ? row.model_scores : []) {
      if (!model || typeof model !== "object") continue;
      const item = model as { id?: string; directionCorrect?: boolean | null };
      if (!item.id || item.directionCorrect === null || item.directionCorrect === undefined) continue;
      const stat = modelStats.get(item.id) ?? { samples: 0, hits: 0 };
      stat.samples += 1;
      if (item.directionCorrect) stat.hits += 1;
      modelStats.set(item.id, stat);
    }
  }

  return json({
    profile: {
      symbol: feedback.symbol,
      timeframe: feedback.timeframe,
      sampleCount: settled.length,
      accuracy: settled.length ? correct / settled.length : null,
      byDirection,
      modelAccuracy: Object.fromEntries(
        [...modelStats.entries()].map(([id, stat]) => [id, { ...stat, accuracy: stat.hits / stat.samples }]),
      ),
      generatedAt: new Date().toISOString(),
    },
  });
});
