export const REMEMBERED_SESSION_DAYS = 30;
export const SESSION_POLICY_COOKIE = "moonclean-session-policy";
const MARKER_RETENTION_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

export function createSessionPolicyValue(rememberFor30Days: boolean, now = Date.now()): string {
  return rememberFor30Days ? `remember.${now + REMEMBERED_SESSION_DAYS * DAY_MS}` : "session";
}

export function getSessionPolicyExpiry(value: string | null | undefined): number | null {
  if (!value?.startsWith("remember.")) return null;
  const expiresAt = Number(value.slice("remember.".length));
  return Number.isSafeInteger(expiresAt) ? expiresAt : null;
}

export function isRememberedSessionExpired(value: string | null | undefined, now = Date.now()): boolean {
  const expiresAt = getSessionPolicyExpiry(value);
  return expiresAt !== null && expiresAt <= now;
}

export function getSupabaseAuthCookieOptions(policyValue: string | null | undefined, secure: boolean, now = Date.now()) {
  const expiresAt = getSessionPolicyExpiry(policyValue);
  const remainingSeconds = expiresAt === null ? undefined : Math.min(REMEMBERED_SESSION_DAYS * 24 * 60 * 60, Math.max(0, Math.ceil((expiresAt - now) / 1000)));
  return {
    path: "/",
    sameSite: "lax" as const,
    secure,
    ...(remainingSeconds !== undefined ? { maxAge: remainingSeconds } : {}),
  };
}

export function getSessionPolicyCookieHeader(value: string, secure: boolean, now = Date.now()): string {
  const expiresAt = getSessionPolicyExpiry(value);
  const maxAge = expiresAt === null ? "" : `; Max-Age=${Math.min(MARKER_RETENTION_DAYS * 24 * 60 * 60, Math.max(0, Math.ceil((expiresAt + (MARKER_RETENTION_DAYS - REMEMBERED_SESSION_DAYS) * DAY_MS - now) / 1000)))}`;
  return `${SESSION_POLICY_COOKIE}=${value}; Path=/${maxAge}; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function clearSessionPolicyCookieHeader(secure: boolean): string {
  return `${SESSION_POLICY_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure ? "; Secure" : ""}`;
}
