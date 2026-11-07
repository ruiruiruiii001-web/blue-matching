import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json } from "../_shared/line.ts";

const url = Deno.env.get("SUPABASE_URL") || "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

Deno.serve(async request => {
  if (request.method === "OPTIONS") return json(200, { ok: true }, true);
  if (request.method !== "POST") return json(405, { error: "Method not allowed" }, true);
  if (!url || !anonKey || !serviceKey) return json(503, { error: "Service not configured" }, true);
  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return json(401, { error: "Authentication required" }, true);
  const userClient = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error: authError } = await userClient.auth.getUser(token);
  if (authError || !data.user) return json(401, { error: "Invalid session" }, true);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: account, error: accountError } = await admin.from("account_types")
    .select("account_type").eq("user_id", data.user.id).maybeSingle();
  if (accountError) {
    console.error("LINE account type lookup failed:", accountError.message);
    return json(500, { error: "Could not verify account" }, true);
  }
  if (account?.account_type !== "employer") return json(403, { error: "Employer account required" }, true);
  let payload: { action?: string; linkToken?: string };
  try {
    payload = await request.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return json(400, { error: "Invalid request" }, true);
    }
  } catch {
    return json(400, { error: "Invalid JSON" }, true);
  }
  if (payload.action === "status") {
    const { data: link, error } = await admin.from("line_notification_links")
      .select("created_at").eq("user_id", data.user.id).maybeSingle();
    if (error) {
      console.error("LINE link status failed:", error.message);
      return json(500, { error: "Could not load status" }, true);
    }
    let deliveryFailed = false;
    if (link) {
      const { data: failedDeliveries, error: deliveryError } = await admin.from("line_application_deliveries")
        .select("notification_id").eq("user_id", data.user.id)
        .gte("created_at", link.created_at).in("status", ["pending", "sending", "failed"])
        .not("last_error", "is", null).limit(1);
      if (deliveryError) {
        console.error("LINE delivery status failed:", deliveryError.message);
        return json(500, { error: "Could not load delivery status" }, true);
      }
      deliveryFailed = Boolean(failedDeliveries?.length);
    }
    return json(200, { linked: Boolean(link), deliveryFailed }, true);
  }
  if (payload.action === "unlink") {
    const { error } = await admin.rpc("remove_line_link", { p_user_id: data.user.id });
    if (error) {
      console.error("LINE unlink failed:", error.message);
      return json(500, { error: "Could not unlink" }, true);
    }
    return json(200, { unlinked: true }, true);
  }
  if (payload.action !== "start" || typeof payload.linkToken !== "string" ||
      !/^[A-Za-z0-9_-]{1,255}$/.test(payload.linkToken)) {
    return json(400, { error: "Invalid request" }, true);
  }
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const nonce = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  const { error } = await admin.from("line_link_requests").insert({ nonce, user_id: data.user.id });
  if (error) {
    console.error("LINE link request save failed:", error.message);
    return json(500, { error: "Could not start linking" }, true);
  }
  const redirect = new URL("https://access.line.me/dialog/bot/accountLink");
  redirect.searchParams.set("linkToken", payload.linkToken);
  redirect.searchParams.set("nonce", nonce);
  return json(200, { redirectUrl: redirect.toString() }, true);
});
