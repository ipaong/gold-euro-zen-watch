import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { constantTimeEqual, getSupabaseAdminKey } from "./runtime";

let environment: Record<string, string | undefined>;

beforeEach(() => {
  environment = {};
  vi.stubGlobal("Deno", {
    env: {
      get: (name: string) => environment[name],
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("constantTimeEqual", () => {
  it("accepts equal secrets and rejects different values", () => {
    expect(constantTimeEqual("same-secret", "same-secret")).toBe(true);
    expect(constantTimeEqual("same-secret", "other-secret")).toBe(false);
    expect(constantTimeEqual("short", "longer")).toBe(false);
  });
});

describe("getSupabaseAdminKey", () => {
  it("prefers the default named secret key", () => {
    environment.SUPABASE_SECRET_KEYS = JSON.stringify({ default: " sb_secret_new " });
    environment.SUPABASE_SERVICE_ROLE_KEY = "legacy-key";

    expect(getSupabaseAdminKey()).toBe("sb_secret_new");
  });

  it("falls back to the legacy service role key", () => {
    environment.SUPABASE_SECRET_KEYS = "not-json";
    environment.SUPABASE_SERVICE_ROLE_KEY = " legacy-key ";

    expect(getSupabaseAdminKey()).toBe("legacy-key");
  });

  it("returns null when no admin key is configured", () => {
    expect(getSupabaseAdminKey()).toBeNull();
  });
});
