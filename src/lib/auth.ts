import { supabase } from "@/integrations/supabase/client";

import { recordMetric } from "./observability";

/**
 * Supabase Auth helpers shared by the demo ownership flow and the Login page.
 * These helpers never log email addresses, tokens, user IDs, or auth payloads.
 */

let inFlightSessionPromise: Promise<string> | null = null;

function authError(operation: string, message: string): Error {
  recordMetric("auth_session_failure", { operation });
  return new Error(message);
}

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
        throw authError(
          "get_session",
          `Failed to read the current auth session: ${sessionError.message}`,
        );
      }

      if (session?.user?.id) {
        return session.user.id;
      }

      const { data, error } = await supabase.auth.signInAnonymously();

      if (error) {
        throw authError("anonymous_sign_in", `Anonymous sign-in failed: ${error.message}`);
      }

      if (!data?.user?.id) {
        throw authError(
          "anonymous_sign_in_missing_user",
          "Anonymous sign-in succeeded but returned no user ID",
        );
      }

      return data.user.id;
    } finally {
      inFlightSessionPromise = null;
    }
  })();

  return inFlightSessionPromise;
}

export async function getAuthSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw authError("get_session", `อ่านสถานะการเข้าสู่ระบบไม่สำเร็จ: ${error.message}`);
  }

  return session;
}

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    throw authError("password_sign_in", error.message);
  }

  if (!data.user) {
    throw authError("password_sign_in_missing_user", "เข้าสู่ระบบสำเร็จแต่ไม่พบข้อมูลบัญชี");
  }

  return data.user;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw authError("sign_out", `ออกจากระบบไม่สำเร็จ: ${error.message}`);
  }
}

export function _hasInFlightSessionPromise(): boolean {
  return inFlightSessionPromise !== null;
}
