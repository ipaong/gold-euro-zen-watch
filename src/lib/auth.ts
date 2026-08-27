import { supabase } from "@/integrations/supabase/client";

/**
 * Phase 0: Anonymous Auth helper.
 * Provides stable, authenticated anonymous sessions backed by Supabase Auth (auth.uid()).
 * Deduplicates concurrent initialization using a single module-level in-flight promise.
 * Reuses existing sessions, fails clearly on error or missing user, and never signs out automatically.
 */

let inFlightSessionPromise: Promise<string> | null = null;

export async function getAnonymousUserId(): Promise<string> {
  if (inFlightSessionPromise) {
    return inFlightSessionPromise;
  }

  inFlightSessionPromise = (async () => {
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(`Failed to read the current auth session: ${sessionError.message}`);
      }

      if (session?.user?.id) {
        return session.user.id;
      }

      const { data, error } = await supabase.auth.signInAnonymously();

      if (error) {
        throw new Error(`Anonymous sign-in failed: ${error.message}`);
      }

      if (!data?.user?.id) {
        throw new Error("Anonymous sign-in succeeded but returned no user ID");
      }

      return data.user.id;
    } finally {
      inFlightSessionPromise = null;
    }
  })();

  return inFlightSessionPromise;
}

export function _hasInFlightSessionPromise(): boolean {
  return inFlightSessionPromise !== null;
}
