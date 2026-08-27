import { describe, expect, it } from "vitest";

import {
  hasEmailAccountSession,
  resolveHomeAccess,
  shouldKeepDemoOnAuthFailure,
} from "./home-access";

describe("Home access policy", () => {
  it("requires Login when there is no session and Demo was not requested", () => {
    expect(resolveHomeAccess({ session: null, demoRequested: false, demoStored: false })).toBe(
      "login",
    );
  });

  it("requires Login for an existing anonymous session unless Demo was explicit", () => {
    const session = { user: { id: "anon-user", is_anonymous: true } };

    expect(resolveHomeAccess({ session, demoRequested: false, demoStored: false })).toBe("login");
    expect(resolveHomeAccess({ session, demoRequested: true, demoStored: false })).toBe("demo");
  });

  it("keeps an explicitly selected Demo mode available across reloads", () => {
    const session = { user: { id: "anon-user", is_anonymous: true } };

    expect(resolveHomeAccess({ session, demoRequested: false, demoStored: true })).toBe("demo");
  });

  it("keeps explicit or stored Demo during an auth failure, but not without a Demo flag", () => {
    expect(shouldKeepDemoOnAuthFailure({ demoRequested: true, demoStored: false })).toBe(true);
    expect(shouldKeepDemoOnAuthFailure({ demoRequested: false, demoStored: true })).toBe(true);
    expect(shouldKeepDemoOnAuthFailure({ demoRequested: false, demoStored: false })).toBe(false);
  });

  it("allows an email account session to access Home even when Demo is requested", () => {
    const session = { user: { id: "account-user", email: "user@example.com" } };

    expect(hasEmailAccountSession(session)).toBe(true);
    expect(resolveHomeAccess({ session, demoRequested: true, demoStored: true })).toBe("account");
  });

  it("does not treat an anonymous or email-less session as an email account", () => {
    expect(hasEmailAccountSession({ user: { id: "anon-user", is_anonymous: true } })).toBe(false);
    expect(hasEmailAccountSession({ user: { id: "unknown-user" } })).toBe(false);
    expect(hasEmailAccountSession({ user: { id: "empty-email", email: "" } })).toBe(false);
  });
});
