import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendApiKey = Deno.env.get("RESEND_API_KEY");
const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
const appUrl = Deno.env.get("APP_URL") || "https://blue-matching-pi.vercel.app";
const allowedOrigins = new Set([
  "https://blue-matching-pi.vercel.app",
  ...(Deno.env.get("APP_ORIGIN") ? [Deno.env.get("APP_ORIGIN")!] : [])
]);

const jsonHeaders = { "Content-Type": "application/json" };

function response(status: number, body: Record<string, unknown>, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, ...jsonHeaders }
  });
}

Deno.serve(async request => {
  const origin = request.headers.get("Origin") || "";
  const corsHeaders = {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://blue-matching-pi.vercel.app",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  };

  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return response(405, { error: "Method not allowed" }, corsHeaders);
  }

  const authorization = request.headers.get("Authorization");
  const token = authorization?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return response(401, { error: "Authentication required" }, corsHeaders);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data: userData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !userData.user) {
    return response(401, { error: "Invalid session" }, corsHeaders);
  }

  let payload: { event_type?: string; record_id?: string };
  try {
    payload = await request.json();
  } catch {
    return response(400, { error: "Invalid JSON body" }, corsHeaders);
  }
    if (
    !["job_application", "contact_request", "contact_reply", "application_reviewed"].includes(payload.event_type || "") ||
    (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.record_id || "") && !/^\d+$/.test(payload.record_id || ""))
  ) {
    return response(400, { error: "Invalid notification event" }, corsHeaders);
  }


  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data: notification, error: notificationError } = await admin
    .from("app_notifications")
    .select("id, recipient_id, event_type, related_id, email_sent_at")
    .eq("event_type", payload.event_type)
    .eq("related_id", payload.record_id)
    .maybeSingle();
  if (notificationError) {
    console.error("Notification lookup failed:", notificationError.message);
    return response(500, { error: "Could not verify notification" }, corsHeaders);
  }
  if (!notification) return response(404, { error: "Notification not found" }, corsHeaders);
  if (notification.email_sent_at) {
    return response(200, { sent: true, already_sent: true }, corsHeaders);
  }

    let actorId: string | null = null;
  if (notification.event_type === "job_application" || notification.event_type === "application_reviewed") {
    const { data: application, error } = await admin
      .from("job_applications")
      .select("applicant_id, job_id")
      .eq("id", notification.related_id)
      .maybeSingle();
    if (error) {
      console.error("Application lookup failed:", error.message);
      return response(500, { error: "Could not verify application" }, corsHeaders);
    }
    if (!application) return response(404, { error: "Target application not found" }, corsHeaders);

    if (notification.event_type === "job_application") {
      actorId = application.applicant_id;
    } else {
      // application_reviewed: 求人の所有者がステータスを更新した
      const { data: job, error: jobError } = await admin
        .from("published_jobs")
        .select("owner_id")
        .eq("id", application.job_id)
        .maybeSingle();
      if (jobError) {
        console.error("Job lookup failed:", jobError.message);
        return response(500, { error: "Could not verify job owner" }, corsHeaders);
      }
      actorId = job?.owner_id || null;
    }
  } else {

    const { data: contactRequest, error } = await admin
      .from("seeker_contact_requests")
      .select("seeker_id, employer_id, status")
      .eq("id", notification.related_id)
      .maybeSingle();
    if (error) {
      console.error("Contact request lookup failed:", error.message);
      return response(500, { error: "Could not verify contact request" }, corsHeaders);
    }
    if (!contactRequest) return response(404, { error: "Contact request not found" }, corsHeaders);
    if (notification.event_type === "contact_request") {
      actorId = contactRequest.employer_id;
      if (contactRequest.status !== "pending") {
        return response(409, { error: "Contact request is no longer pending" }, corsHeaders);
      }
    } else {
      actorId = contactRequest.seeker_id;
      if (!["responded", "declined"].includes(contactRequest.status)) {
        return response(409, { error: "Contact request has no response" }, corsHeaders);
      }
    }
  }

  if (!actorId || actorId !== userData.user.id) {
    return response(403, { error: "Not allowed to send this notification" }, corsHeaders);
  }
  if (!resendApiKey || !fromEmail) {
    console.error("Missing RESEND_API_KEY or RESEND_FROM_EMAIL configuration");
    return response(503, { error: "Email delivery is not configured" }, corsHeaders);
  }

  const { data: recipientData, error: recipientError } = await admin.auth.admin.getUserById(notification.recipient_id);
  if (recipientError || !recipientData.user?.email) {
    console.error("Recipient email lookup failed:", recipientError?.message || "No email address");
    return response(500, { error: "Could not find recipient email" }, corsHeaders);
  }

    const subjectByEvent = {
    job_application: "求人に新しい応募が届きました",
    contact_request: "企業から連絡リクエストが届きました",
    contact_reply: "連絡リクエストの状況が更新されました",
    application_reviewed: "応募状況が「確認済み」になりました"
  };
  const messageByEvent = {
    job_application: "企業マイページを開き、新しい応募内容をご確認ください。",
    contact_request: "求職者マイページを開き、企業からの連絡をご確認ください。",
    contact_reply: "企業向け画面を開き、連絡リクエストの状況をご確認ください。",
    application_reviewed: "マイページの応募履歴を確認してください。企業があなたの応募内容を確認しました。"
  };

  const subject = subjectByEvent[notification.event_type as keyof typeof subjectByEvent];
  const message = messageByEvent[notification.event_type as keyof typeof messageByEvent];
  const html = `<p>${message}</p><p><a href="${appUrl}">blue-matchingを開く</a></p><p>このメールには応募内容・メッセージ・連絡先は含まれていません。</p>`;

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `blue-matching-${notification.id}`
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [recipientData.user.email],
      subject,
      html
    })
  });
  if (!resendResponse.ok) {
    console.error("Resend rejected notification with status:", resendResponse.status);
    return response(502, { error: "Email provider rejected the notification" }, corsHeaders);
  }

  const { error: updateError } = await admin
    .from("app_notifications")
    .update({ email_sent_at: new Date().toISOString() })
    .eq("id", notification.id)
    .is("email_sent_at", null);
  if (updateError) {
    console.error("Could not record notification email delivery:", updateError.message);
    return response(502, { error: "Email sent but delivery status could not be recorded" }, corsHeaders);
  }

  return response(200, { sent: true }, corsHeaders);
});
