const authBase = process.env.NEON_AUTH_BASE_URL!;

export type Session = { user: { id: string; name: string; email: string; emailVerified: boolean } } | null;

function restoreName(name: string) {
  if (name.startsWith("__Secure_")) return `__Secure-${name.slice("__Secure_".length)}`;
  if (name.startsWith("__Host_")) return `__Host-${name.slice("__Host_".length)}`;
  return name;
}

export function normalizeAuthCookieHeader(cookieHeader: string, isHttp: boolean) {
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const part of cookieHeader.split(";").map((item) => item.trim()).filter(Boolean)) {
    const separator = part.indexOf("=");
    const name = (separator === -1 ? part : part.slice(0, separator)).trim();
    const value = separator === -1 ? "" : part.slice(separator + 1);
    const preview = name.startsWith("__Secure_") || name.startsWith("__Host_");
    const secure = name.startsWith("__Secure-") || name.startsWith("__Host-");
    if (isHttp && secure) continue;
    if (!isHttp && preview) continue;
    if (isHttp && preview) {
      const restored = restoreName(name);
      if (seen.has(restored)) continue;
      seen.add(restored);
      normalized.push(`${restored}=${value}`);
    } else normalized.push(`${name}=${value}`);
  }
  return normalized.join("; ");
}

export async function getSessionFromCookie(cookieHeader: string | null, isHttp: boolean): Promise<Session> {
  if (!cookieHeader) return null;
  const cookie = normalizeAuthCookieHeader(cookieHeader, isHttp);
  if (!cookie) return null;
  const response = await fetch(`${authBase}/get-session`, { headers: { cookie } });
  if (!response.ok) return null;
  const session = await response.json() as Session;
  return session?.user ? session : null;
}
