export const APP_URL = "https://blue-matching-pi.vercel.app";

export function json(status: number, body: Record<string, unknown>, cors = false): Response {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cors) {
    headers["Access-Control-Allow-Origin"] = APP_URL;
    headers["Access-Control-Allow-Headers"] = "authorization, x-client-info, apikey, content-type";
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Vary"] = "Origin";
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export async function verifyLineSignature(body: string, signature: string, secret: string): Promise<boolean> {
  let actual: Uint8Array<ArrayBuffer>;
  try {
    actual = Uint8Array.from(atob(signature), char => char.charCodeAt(0));
  } catch {
    return false;
  }
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
  );
  return crypto.subtle.verify("HMAC", key, actual, new TextEncoder().encode(body));
}

export async function lineRequest(path: string, token: string, payload: unknown, retryKey?: string): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
  if (retryKey) headers["X-Line-Retry-Key"] = retryKey;
  return fetch(`https://api.line.me${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
}
