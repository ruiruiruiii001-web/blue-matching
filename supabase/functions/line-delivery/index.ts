import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { APP_URL, json, lineRequest } from "../_shared/line.ts";

const url = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const lineToken = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") || "";

Deno.serve(async request => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  if (!url || !serviceKey || !lineToken) {
    console.error("LINE delivery configuration is incomplete");
    return json(503, { error: "Service not configured" });
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const secret = request.headers.get("x-worker-secret") || "";
  if (!secret) return json(401, { error: "Unauthorized" });
  const { data: authorized, error: authorizationError } = await admin.rpc("authorize_line_delivery_worker", {
    p_secret: secret
  });
  if (authorizationError) {
    console.error("LINE delivery authorization failed:", authorizationError.message);
    return json(500, { error: "Could not verify authorization" });
  }
  if (!authorized) return json(401, { error: "Unauthorized" });
  const { data: deliveries, error } = await admin.rpc("claim_line_application_deliveries");
  if (error) {
    console.error("LINE delivery claim failed:", error.message);
    return json(500, { error: "Could not claim deliveries" });
  }
  let failures = 0;
  for (const delivery of deliveries || []) {
    const { data: active, error: activeError } = await admin.from("line_application_deliveries")
      .select("notification_id").eq("notification_id", delivery.notification_id)
      .eq("status", "sending").eq("attempts", delivery.attempts).maybeSingle();
    if (activeError) {
      console.error("LINE delivery state lookup failed:", activeError.message);
      failures++;
      continue;
    }
    if (!active) continue;
    let status = "pending";
    let errorMessage: string | null = null;
    try {
      const response = await lineRequest("/v2/bot/message/push", lineToken, {
        to: delivery.line_user_id,
        messages: [{ type: "text", text: `新しい応募があります。サイトのマイページで確認してください。\n${APP_URL}` }]
      }, delivery.notification_id);
      if (response.ok || response.status === 409) {
        status = "sent";
      } else {
        errorMessage = `LINE API HTTP ${response.status}`;
        if (response.status < 500 && response.status !== 429) status = "failed";
      }
    } catch (requestError) {
      console.error("LINE delivery request failed:", requestError);
      errorMessage = "LINEへの接続に失敗しました";
    }
    if (errorMessage) {
      failures++;
      console.error("LINE application notification failed:", errorMessage);
    }
    const { error: updateError } = await admin.from("line_application_deliveries")
      .update({ status, last_error: errorMessage })
      .eq("notification_id", delivery.notification_id)
      .eq("status", "sending")
      .eq("attempts", delivery.attempts);
    if (updateError) {
      console.error("LINE delivery status update failed:", updateError.message);
      failures++;
    }
  }
  return json(failures ? 502 : 200, { processed: deliveries?.length || 0, failures });
});
