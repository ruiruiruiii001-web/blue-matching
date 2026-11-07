import { verifyLineSignature } from "./line.ts";

Deno.test("LINE webhook signature is checked against the exact body and secret", async () => {
  const secret = "test-secret";
  const body = '{"events":[]}';
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const signature = btoa(String.fromCharCode(...new Uint8Array(signed)));
  if (!await verifyLineSignature(body, signature, secret)) throw new Error("Valid signature rejected");
  if (await verifyLineSignature(`${body} `, signature, secret)) throw new Error("Changed body accepted");
  if (await verifyLineSignature(body, signature, "wrong")) throw new Error("Wrong secret accepted");
  if (await verifyLineSignature(body, "!", secret)) throw new Error("Invalid signature accepted");
});
