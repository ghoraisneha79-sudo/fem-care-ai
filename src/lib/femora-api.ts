export type Cycle = { id?: string; start_date: string; end_date?: string | null; flow: string | null };
export type Consent = { purpose: string; granted: boolean; policy_version: string };

export async function api<T>(path: string, _token?: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...init, headers, credentials: "same-origin" });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { statusMessage?: string; message?: string } | null;
    throw new Error(body?.statusMessage ?? body?.message ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}
