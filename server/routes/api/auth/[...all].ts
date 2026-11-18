import { defineHandler } from "nitro";
import { createError, getRequestHeaders, getRequestURL, readRawBody } from "nitro/h3";
import { normalizeAuthCookieHeader } from "../../../utils/session";

const authBase = process.env.NEON_AUTH_BASE_URL!;
const allowed = new Set(["accept", "accept-language", "authorization", "content-type", "cookie", "origin", "referer", "user-agent", "x-forwarded-for"]);

export default defineHandler(async (event) => {
  if (!authBase) throw createError({ statusCode: 503, statusMessage: "Neon Auth is not configured. Set NEON_AUTH_BASE_URL in the server environment." });
  const url = getRequestURL(event);
  const path = url.pathname.startsWith("/api/auth") ? url.pathname.slice("/api/auth".length) || "/" : url.pathname;
  const headers = new Headers();
  for (const [key, value] of Object.entries(getRequestHeaders(event))) {
    if (value && allowed.has(key.toLowerCase())) headers.set(key.toLowerCase(), value);
  }
  const cookie = headers.get("cookie");
  if (cookie) {
    const normalized = normalizeAuthCookieHeader(cookie, url.protocol === "http:");
    if (normalized) headers.set("cookie", normalized);
    else headers.delete("cookie");
  }
  const body = event.method === "GET" || event.method === "HEAD" ? undefined : await readRawBody(event, false);
  const upstream = await fetch(`${authBase}${path}${url.search}`, { method: event.method, headers, body: body as BodyInit | undefined, redirect: "manual" });
  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => { if (key.toLowerCase() !== "set-cookie") responseHeaders.append(key, value); });
  const cookies = upstream.headers.getSetCookie?.() ?? [];
  for (let cookieValue of cookies) {
    if (url.protocol === "http:") {
      cookieValue = cookieValue.replaceAll("__Secure-", "__Secure_").replaceAll("__Host-", "__Host_");
      cookieValue = cookieValue.replaceAll("; Secure", "").replaceAll(";Secure", "").replaceAll("; Partitioned", "").replaceAll(";Partitioned", "");
      cookieValue = cookieValue.replace(/;[ ]*Domain=[^;]*/gi, "");
      cookieValue = cookieValue.replaceAll("; SameSite=None", "; SameSite=Lax").replaceAll(";SameSite=None", ";SameSite=Lax");
    }
    responseHeaders.append("set-cookie", cookieValue);
  }
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
});
