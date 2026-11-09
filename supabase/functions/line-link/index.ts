import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json } from "../_shared/line.ts";

const url = Deno.env.get("SUPABASE_URL") || "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

Deno.serve(async request => {
  const respond = (status: number, body: Record<string, unknown>) =>
    json(status, body, true, request.headers.get("Origin") || "");
  if (request.method === "OPTIONS") return respond(200, { ok: true });
  if (request.method !== "POST") return respond(405, { error: "Method not allowed" });
  if (!url || !anonKey || !serviceKey) return respond(503, { error: "Service not configured" });
  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return respond(401, { error: "Authentication required" });
  const userClient = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error: authError } = await userClient.auth.getUser(token);
  if (authError || !data.user) return respond(401, { error: "Invalid session" });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: account, error: accountError } = await admin.from("account_types")
    .select("account_type").eq("user_id", data.user.id).maybeSingle();
  if (accountError) {
    console.error("LINE account type lookup failed:", accountError.message);
    return respond(500, { error: "Could not verify account" });
  }
  if (account?.account_type !== "employer") return respond(403, { error: "Employer account required" });
  let payload: { action?: string; linkToken?: string };
  try {
    payload = await request.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return respond(400, { error: "Invalid request" });
    }
  } catch {
    return respond(400, { error: "Invalid JSON" });
  }
  if (payload.action === "status") {
    const { data: link, error } = await admin.from("line_notification_links")
      .select("created_at").eq("user_id", data.user.id).maybeSingle();
    if (error) {
      console.error("LINE link status failed:", error.message);
      return respond(500, { error: "Could not load status" });
    }
    let deliveryFailed = false;
    if (link) {
      const { data: failedDeliveries, error: deliveryError } = await admin.from("line_application_deliveries")
        .select("notification_id").eq("user_id", data.user.id)
        .gte("created_at", link.created_at).in("status", ["pending", "sending", "failed"])
        .not("last_error", "is", null).limit(1);
      if (deliveryError) {
        console.error("LINE delivery status failed:", deliveryError.message);
        return respond(500, { error: "Could not load delivery status" });
      }
      deliveryFailed = Boolean(failedDeliveries?.length);
    }
    return respond(200, { linked: Boolean(link), deliveryFailed });
  }
  if (payload.action === "unlink") {
    const { error } = await admin.rpc("remove_line_link", { p_user_id: data.user.id });
    if (error) {
      console.error("LINE unlink failed:", error.message);
      return respond(500, { error: "Could not unlink" });
    }
    return respond(200, { unlinked: true });
  }
  if (payload.action !== "start" || typeof payload.linkToken !== "string" ||
      !/^[A-Za-z0-9_-]{1,255}$/.test(payload.linkToken)) {
    return respond(400, { error: "Invalid request" });
  }
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const nonce = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  const { error } = await admin.from("line_link_requests").insert({ nonce, user_id: data.user.id });
  if (error) {
    console.error("LINE link request save failed:", error.message);
    return respond(500, { error: "Could not start linking" });
  }
  const redirect = new URL("https://access.line.me/dialog/bot/accountLink");
  redirect.searchParams.set("linkToken", payload.linkToken);
  redirect.searchParams.set("nonce", nonce);
  return respond(200, { redirectUrl: redirect.toString() });
});
