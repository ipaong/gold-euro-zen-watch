export const DEMO_MODE_STORAGE_KEY = "xaueur-lab:demo-mode:v1";

export type AuthSessionLike = {
  user?: {
    id?: string | null;
    email?: string | null;
    is_anonymous?: boolean;
  } | null;
} | null;

export type HomeAccess = "account" | "demo" | "login";

export function hasEmailAccountSession(session: AuthSessionLike): boolean {
  const user = session?.user;
  return Boolean(user?.id && user.email && !user.is_anonymous);
}

export function resolveHomeAccess({
  session,
  demoRequested,
  demoStored,
}: {
  session: AuthSessionLike;
  demoRequested: boolean;
  demoStored: boolean;
}): HomeAccess {
  if (hasEmailAccountSession(session)) {
    return "account";
  }

  if (demoRequested || demoStored) {
    return "demo";
  }

  return "login";
}

/** Preserve an already-selected Demo when auth infrastructure is temporarily unavailable. */
export function shouldKeepDemoOnAuthFailure({
  demoRequested,
  demoStored,
}: {
  demoRequested: boolean;
  demoStored: boolean;
}): boolean {
  return resolveHomeAccess({ session: null, demoRequested, demoStored }) === "demo";
}
