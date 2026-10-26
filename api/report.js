export const config = {
  runtime: 'edge',
};

const allowedReasons = new Set(['misleading', 'inappropriate', 'scam', 'contact', 'other']);
const allowedHostname = 'blue-matching-pi.vercel.app';

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin) {
    return jsonResponse({ error: '送信元を確認できませんでした。ページを再読み込みしてください。' }, 403);
  }

  const contentLength = Number(req.headers.get('content-length') || 0);
  if (contentLength > 4096) {
    return jsonResponse({ error: '入力内容が大きすぎます。' }, 413);
  }

  let report;
  try {
    report = await req.json();
  } catch {
    return jsonResponse({ error: '送信内容を読み取れませんでした。' }, 400);
  }

  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    return jsonResponse({ error: '送信内容を確認してください。' }, 400);
  }

  const { jobId, reason, details: rawDetails, captchaToken } = report;
  const details = typeof rawDetails === 'string' ? rawDetails.trim() : '';
  if (typeof jobId !== 'string' ||
      typeof reason !== 'string' ||
      typeof captchaToken !== 'string' ||
      (rawDetails !== undefined && typeof rawDetails !== 'string') ||
      !/^[A-Za-z0-9_-]{1,80}$/.test(jobId) ||
      !allowedReasons.has(reason) ||
      details.length > 500 ||
      !captchaToken ||
      captchaToken.length > 2048) {
    return jsonResponse({ error: '入力内容を確認してください。' }, 400);
  }

  const turnstileSecret = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!turnstileSecret || !supabaseUrl || !serviceRoleKey) {
    console.error('Job report API configuration is incomplete.');
    return jsonResponse({ error: '通報機能のサーバー設定が完了していません。' }, 503);
  }

  try {
    const verifyBody = new URLSearchParams({
      secret: turnstileSecret,
      response: captchaToken,
    });
    const verificationResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: verifyBody,
    });
    if (!verificationResponse.ok) {
      console.error('Turnstile Siteverify returned HTTP', verificationResponse.status);
      return jsonResponse({ error: 'CAPTCHAを検証できませんでした。もう一度お試しください。' }, 502);
    }
    const verification = await verificationResponse.json();
    if (!verification.success ||
        verification.hostname !== allowedHostname ||
        verification.action !== 'job_report') {
      return jsonResponse({ error: 'CAPTCHAの確認が無効または期限切れです。もう一度お試しください。' }, 400);
    }

    const baseUrl = supabaseUrl.replace(/\/+$/, '');
    const headers = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    };
    const jobQuery = new URLSearchParams({ select: 'id,title', id: `eq.${jobId}` });
    const jobResponse = await fetch(`${baseUrl}/rest/v1/published_jobs?${jobQuery}`, { headers });
    if (!jobResponse.ok) {
      console.error('Could not load job for report:', jobResponse.status);
      return jsonResponse({ error: '求人情報を確認できませんでした。時間をおいて再度お試しください。' }, 502);
    }
    const jobs = await jobResponse.json();
    if (!Array.isArray(jobs) || jobs.length !== 1) {
      return jsonResponse({ error: '対象の求人が見つかりません。ページを更新してください。' }, 404);
    }

    const insertResponse = await fetch(`${baseUrl}/rest/v1/job_reports`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        job_id: jobId,
        job_title: jobs[0].title,
        reason,
        details: details || null,
      }),
    });
    if (!insertResponse.ok) {
      const errorText = await insertResponse.text();
      console.error('Could not save job report:', insertResponse.status, errorText);
      return jsonResponse({ error: '通報を保存できませんでした。時間をおいて再度お試しください。' }, 502);
    }

    return jsonResponse({ success: true }, 200);
  } catch (error) {
    console.error('Job report request failed:', error);
    return jsonResponse({ error: '通報を送信できませんでした。通信状態を確認して再度お試しください。' }, 502);
  }
}
