/**
 * Phase 2A: the app has no login, so each browser gets a stable device id.
 * Cloud rows are scoped by this id so a device only sees and manages its own
 * saved predictions.
 */
const KEY = "xaueur-lab:device-id:v1";

export function getDeviceId(): string {
  if (typeof window === "undefined" || !window.localStorage) return "server";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = `d_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    window.localStorage.setItem(KEY, id);
  }
  return id;
}
