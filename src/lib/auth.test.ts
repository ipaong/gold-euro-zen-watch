import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();
const mockSignInAnonymously = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockUpdateUser = vi.fn();
const mockSignOut = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      signInAnonymously: (...args: unknown[]) => mockSignInAnonymously(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  },
}));

import {
  getAnonymousUserId,
  getAuthSession,
  signInWithPassword,
  signOut,
  updatePassword,
  _hasInFlightSessionPromise,
} from "./auth";

describe("Anonymous Auth Helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reuses existing session and does not call signInAnonymously", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: {
        session: {
          user: { id: "usr_existing_123" },
        },
      },
      error: null,
    });

    const userId = await getAnonymousUserId();

    expect(userId).toBe("usr_existing_123");
    expect(mockGetSession).toHaveBeenCalledTimes(1);
    expect(mockSignInAnonymously).not.toHaveBeenCalled();
    expect(_hasInFlightSessionPromise()).toBe(false);
  });

  it("creates a new anonymous session when no active session exists", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });
    mockSignInAnonymously.mockResolvedValueOnce({
      data: {
        user: { id: "usr_anon_456" },
      },
      error: null,
    });

    const userId = await getAnonymousUserId();

    expect(userId).toBe("usr_anon_456");
    expect(mockGetSession).toHaveBeenCalledTimes(1);
    expect(mockSignInAnonymously).toHaveBeenCalledTimes(1);
    expect(_hasInFlightSessionPromise()).toBe(false);
  });

  it("deduplicates concurrent calls using a single in-flight promise", async () => {
    let resolveSignIn!: (value: unknown) => void;
    const pendingPromise = new Promise((res) => {
      resolveSignIn = res;
    });

    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mockSignInAnonymously.mockReturnValue(pendingPromise);

    // Trigger multiple concurrent calls simultaneously
    const p1 = getAnonymousUserId();
    const p2 = getAnonymousUserId();
    const p3 = getAnonymousUserId();

    expect(_hasInFlightSessionPromise()).toBe(true);

    // Resolve the deferred sign-in
    resolveSignIn({
      data: { user: { id: "usr_concurrent_789" } },
      error: null,
    });

    const [u1, u2, u3] = await Promise.all([p1, p2, p3]);

    expect(u1).toBe("usr_concurrent_789");
    expect(u2).toBe("usr_concurrent_789");
    expect(u3).toBe("usr_concurrent_789");

    // Only one auth roundtrip should have occurred
    expect(mockGetSession).toHaveBeenCalledTimes(1);
    expect(mockSignInAnonymously).toHaveBeenCalledTimes(1);
    expect(_hasInFlightSessionPromise()).toBe(false);
  });

  it("fails clearly when signInAnonymously returns an error", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });
    mockSignInAnonymously.mockResolvedValueOnce({
      data: null,
      error: { message: "Anonymous sign-ins are disabled in project settings" },
    });

    await expect(getAnonymousUserId()).rejects.toThrow(
      "Anonymous sign-in failed: Anonymous sign-ins are disabled in project settings",
    );
    expect(_hasInFlightSessionPromise()).toBe(false);
  });

  it("does not create a new identity when reading the current session fails", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: null },
      error: { message: "Session storage is unavailable" },
    });

    await expect(getAnonymousUserId()).rejects.toThrow(
      "Failed to read the current auth session: Session storage is unavailable",
    );
    expect(mockSignInAnonymously).not.toHaveBeenCalled();
    expect(_hasInFlightSessionPromise()).toBe(false);
  });

  it("fails clearly when signInAnonymously returns no user id", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });
    mockSignInAnonymously.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    await expect(getAnonymousUserId()).rejects.toThrow(
      "Anonymous sign-in succeeded but returned no user ID",
    );
    expect(_hasInFlightSessionPromise()).toBe(false);
  });

  it("reads an existing authenticated session without creating an anonymous identity", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: { user: { id: "usr_email_123", email: "user@example.com" } } },
      error: null,
    });

    const session = await getAuthSession();

    expect(session?.user.id).toBe("usr_email_123");
    expect(mockGetSession).toHaveBeenCalledTimes(1);
    expect(mockSignInAnonymously).not.toHaveBeenCalled();
  });

  it("signs in with email and password", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { user: { id: "usr_login_123", email: "user@example.com" } },
      error: null,
    });

    const user = await signInWithPassword("user@example.com", "correct horse battery staple");

    expect(user.id).toBe("usr_login_123");
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "correct horse battery staple",
    });
  });

  it("updates the password and surfaces auth errors clearly", async () => {
    mockUpdateUser.mockResolvedValueOnce({ error: null });
    await expect(updatePassword("new-password-123")).resolves.toBeUndefined();
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: "new-password-123" });

    mockUpdateUser.mockResolvedValueOnce({ error: { message: "Password is too weak" } });
    await expect(updatePassword("123456")).rejects.toThrow("Password is too weak");
  });

  it("signs out and surfaces auth errors clearly", async () => {
    mockSignOut.mockResolvedValueOnce({ error: null });
    await expect(signOut()).resolves.toBeUndefined();
    expect(mockSignOut).toHaveBeenCalledTimes(1);

    mockSignOut.mockResolvedValueOnce({ error: { message: "Network unavailable" } });
    await expect(signOut()).rejects.toThrow("ออกจากระบบไม่สำเร็จ: Network unavailable");
  });

  it("allows retrying after a previous failure clears the in-flight promise", async () => {
    // First attempt fails
    mockGetSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });
    mockSignInAnonymously.mockResolvedValueOnce({
      data: null,
      error: { message: "Network connection lost" },
    });

    await expect(getAnonymousUserId()).rejects.toThrow("Network connection lost");
    expect(_hasInFlightSessionPromise()).toBe(false);

    // Second attempt succeeds
    mockGetSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });
    mockSignInAnonymously.mockResolvedValueOnce({
      data: { user: { id: "usr_recovered_999" } },
      error: null,
    });

    const userId = await getAnonymousUserId();
    expect(userId).toBe("usr_recovered_999");
    expect(_hasInFlightSessionPromise()).toBe(false);
  });
});
