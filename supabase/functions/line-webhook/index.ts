import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { APP_URL, json, lineRequest, verifyLineSignature } from "../_shared/line.ts";
import { notifyLineLinkCompletion } from "../_shared/line-link-completion.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const lineSecret = Deno.env.get("LINE_CHANNEL_SECRET") || "";
const lineToken = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") || "";

interface LineEvent {
  type: string;
  source?: { type?: string; userId?: string };
  replyToken?: string;
  message?: { type?: string; text?: string };
  link?: { result?: string; nonce?: string };
}

Deno.serve(async request => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  if (!supabaseUrl || !serviceKey || !lineSecret || !lineToken) {
    console.error("LINE webhook configuration is incomplete");
    return json(503, { error: "Service not configured" });
  }
  const signature = request.headers.get("x-line-signature") || "";
  const body = await request.text();
  if (!await verifyLineSignature(body, signature, lineSecret)) {
    return json(401, { error: "Invalid signature" });
  }
  let events: LineEvent[];
  try {
    const payload = JSON.parse(body);
    if (!Array.isArray(payload.events) ||
        payload.events.some((event: unknown) => !event || typeof event !== "object" || Array.isArray(event))) {
      return json(400, { error: "Invalid events" });
    }
    events = payload.events;
  } catch {
    return json(400, { error: "Invalid JSON" });
  }
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  for (const event of events) {
    const userId = event.source?.userId || "";
    if (event.source?.type !== "user" || !/^U[0-9a-f]{32}$/.test(userId)) continue;
    if (event.type === "accountLink" && event.link?.result === "ok" && event.link.nonce) {
      const { data: linked, error } = await admin.rpc("complete_line_link", {
        p_nonce: event.link.nonce,
        p_line_user_id: userId
      });
      if (error) {
        console.error("LINE account linking failed:", error.message);
        return json(500, { error: "Could not complete account linking" });
      }
      if (linked && !event.replyToken) {
        console.error("LINE account link event has no reply token");
        return json(500, { error: "Could not send link confirmation" });
      }
      try {
        const result = await notifyLineLinkCompletion(
          linked === true,
          message => lineRequest("/v2/bot/message/reply", lineToken, {
            replyToken: event.replyToken,
            messages: [{ type: "text", text: message }]
          }),
        );
        if (result === "reply_failed") {
          console.error("LINE account link confirmation reply failed");
          return json(502, { error: "Could not send link confirmation" });
        }
      } catch (replyError) {
        console.error("LINE account link confirmation request failed:", replyError);
        return json(502, { error: "Could not send link confirmation" });
      }
    } else if (event.type === "message" && event.message?.type === "text" &&
        event.message.text?.trim() === "連携" && event.replyToken) {
      const tokenResponse = await lineRequest(`/v2/bot/user/${userId}/linkToken`, lineToken, {});
      if (!tokenResponse.ok) {
        console.error("LINE link token request failed:", tokenResponse.status);
        return json(502, { error: "Could not create link token" });
      }
      const result = await tokenResponse.json();
      if (typeof result.linkToken !== "string" || !result.linkToken) {
        console.error("LINE link token response was invalid");
        return json(502, { error: "Invalid link token response" });
      }
      const url = new URL("/line-link.html", APP_URL);
      url.searchParams.set("linkToken", result.linkToken);
      const reply = await lineRequest("/v2/bot/message/reply", lineToken, {
        replyToken: event.replyToken,
        messages: [{ type: "text", text: `応募通知の連携はこちらから行ってください。いつでも解除できます。\n${url}` }]
      });
      if (!reply.ok) {
        console.error("LINE link reply failed:", reply.status);
        return json(502, { error: "Could not reply" });
      }
    }
  }
  return json(200, { ok: true });
});
