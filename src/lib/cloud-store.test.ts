import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetAnonymousUserId = vi.fn();

vi.mock("./auth", () => ({
  getAnonymousUserId: () => mockGetAnonymousUserId(),
}));

const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import {
  attachOutcome,
  clearPredictions,
  deletePrediction,
  listPredictions,
  loadSettings,
  savePrediction,
  saveSettings,
} from "./cloud-store";
import type { AppSettings, Prediction } from "./types";

describe("Cloud Store (Ownership & Security via user_id)", () => {
  const TEST_USER_ID = "11111111-1111-1111-1111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAnonymousUserId.mockResolvedValue(TEST_USER_ID);
  });

  it("listPredictions filters both predictions and results by user_id", async () => {
    const mockSelectPreds = vi.fn().mockReturnThis();
    const mockEqPreds = vi.fn().mockReturnThis();
    const mockOrderPreds = vi.fn().mockReturnThis();
    const mockLimitPreds = vi.fn().mockResolvedValue({
      data: [
        {
          id: "pred-1",
          snapshot: { id: "pred-1", mode: "live" },
          ai_explanation: null,
        },
      ],
      error: null,
    });

    const mockSelectResults = vi.fn().mockReturnThis();
    const mockEqResults = vi.fn().mockResolvedValue({
      data: [{ prediction_id: "pred-1", actual: [], score: { outcome: "hit" } }],
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "predictions") {
        return {
          select: mockSelectPreds,
          eq: mockEqPreds,
          order: mockOrderPreds,
          limit: mockLimitPreds,
        };
      }
      if (table === "prediction_results") {
        return {
          select: mockSelectResults,
          eq: mockEqResults,
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const list = await listPredictions();

    expect(mockGetAnonymousUserId).toHaveBeenCalled();
    expect(mockEqPreds).toHaveBeenCalledWith("user_id", TEST_USER_ID);
    expect(mockEqResults).toHaveBeenCalledWith("user_id", TEST_USER_ID);
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe("pred-1");
  });

  it("savePrediction inserts prediction with authenticated user_id", async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert: mockInsert });

    const samplePrediction: Prediction = {
      id: "pred-100",
      asOf: 1700000000000,
      createdAt: 1700000000000,
      mode: "live",
      demo: true,
      symbol: "XAUEUR",
      timeframe: "M15",
      horizon: 5,
      price: 2450.5,
      locked: true,
      models: [],
      ensemble: {} as never,
      consensus: {} as never,
      scenarios: [],
      forecast: [],
      plan: {} as never,
      narrative: {} as never,
      newsRisk: "low",
      goldBias: "neutral",
      eurBias: "neutral",
      actual: null,
      score: null,
      ai: null,
    };

    await savePrediction(samplePrediction);

    expect(mockFrom).toHaveBeenCalledWith("predictions");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "pred-100",
        user_id: TEST_USER_ID,
        as_of: 1700000000000,
      })
    );
  });

  it("attachOutcome inserts result with authenticated user_id", async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert: mockInsert });

    await attachOutcome("pred-100", [] as never, { outcome: "hit" } as never);

    expect(mockFrom).toHaveBeenCalledWith("prediction_results");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        prediction_id: "pred-100",
        user_id: TEST_USER_ID,
      })
    );
  });

  it("deletePrediction and clearPredictions filter deletes by user_id", async () => {
    const mockChain: {
      eq: ReturnType<typeof vi.fn>;
      then: (resolve?: (val: { error: null }) => unknown) => Promise<unknown>;
    } = {
      eq: vi.fn(),
      then(onfulfilled) {
        return Promise.resolve(onfulfilled ? onfulfilled({ error: null }) : { error: null });
      },
    };
    mockChain.eq.mockReturnValue(mockChain);

    const mockDelete = vi.fn().mockReturnValue(mockChain);
    mockFrom.mockReturnValue({ delete: mockDelete });

    // delete single
    await deletePrediction("pred-100");
    expect(mockChain.eq).toHaveBeenCalledWith("id", "pred-100");
    expect(mockChain.eq).toHaveBeenCalledWith("user_id", TEST_USER_ID);

    // clear all
    await clearPredictions();
    expect(mockChain.eq).toHaveBeenCalledWith("user_id", TEST_USER_ID);
  });

  it("loadSettings filters by user_id and saveSettings upserts on user_id conflict", async () => {
    // loadSettings
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { settings: { confidenceThreshold: 80 } },
      error: null,
    });
    mockFrom.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
    });

    const settings = await loadSettings();
    expect(mockFrom).toHaveBeenCalledWith("app_settings");
    expect(mockEq).toHaveBeenCalledWith("user_id", TEST_USER_ID);
    expect(settings.confidenceThreshold).toBe(80);

    // saveSettings
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ upsert: mockUpsert });

    const newSettings: AppSettings = { ...settings, confidenceThreshold: 85 };
    await saveSettings(newSettings);

    expect(mockFrom).toHaveBeenCalledWith("app_settings");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: TEST_USER_ID,
        settings: newSettings,
      }),
      { onConflict: "user_id" }
    );
  });
});
