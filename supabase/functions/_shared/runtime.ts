export function constantTimeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

export function getSupabaseAdminKey(): string | null {
  const namedKeysJson = Deno.env.get("SUPABASE_SECRET_KEYS")?.trim();
  if (namedKeysJson) {
    try {
      const namedKeys = JSON.parse(namedKeysJson) as Record<string, unknown>;
      const defaultKey = namedKeys.default;
      if (typeof defaultKey === "string" && defaultKey.trim()) return defaultKey.trim();
    } catch {
      // Fall through to the legacy key while projects migrate to named keys.
    }
  }

  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() || null;
}
