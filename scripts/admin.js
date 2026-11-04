const REPORT_REASON_LABELS = {
  misleading: "虚偽・誤解を招く内容",
  inappropriate: "不適切な内容",
  scam: "詐欺・不審なお仕事",
  contact: "連絡先が不正確",
  other: "その他"
};
const REPORT_STATUS_LABELS = { pending: "未対応", reviewed: "確認済み", dismissed: "対応不要" };

const adminStatus = document.getElementById("adminStatus");
const adminPanel = document.getElementById("adminPanel");
const adminReports = document.getElementById("adminReports");
const adminPendingJobs = document.getElementById("adminPendingJobs");
const adminReportFilter = document.getElementById("adminReportFilter");
let adminJobsById = new Map();
let adminSuspendedIds = new Set();
let adminReportRows = [];

function setAdminStatus(message, isError = false) {
  adminStatus.textContent = message;
  adminStatus.classList.toggle("text-red-700", isError);
  adminStatus.classList.toggle("text-gray-700", !isError);
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function createActionButton(label, className, onClick) {
  const button = createElement("button", `min-h-10 rounded-lg px-3 py-2 text-xs font-bold ${className}`, label);
  button.type = "button";
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await onClick();
    } finally {
      button.disabled = false;
    }
  });
  return button;
}

async function initializeAdmin() {
  const loginForm = document.getElementById("adminLoginForm");
  const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
  if (sessionError || !session) {
    loginForm.classList.remove("hidden");
    setAdminStatus("運営者アカウントでログインしてください。", true);
    return;
  }
  loginForm.classList.add("hidden");
  const { data: isAdmin, error } = await supabaseClient.rpc("is_admin");
  if (error) {
    setAdminStatus(`権限を確認できませんでした。移行SQLを実行済みか確認してください: ${error.message}`, true);
    return;
  }
  if (!isAdmin) {
    setAdminStatus("このアカウントには運営の権限がありません。", true);
    return;
  }
  adminPanel.classList.remove("hidden");
  setAdminStatus("");
  await loadReports();
  await loadPendingJobs();
  if (typeof loadAdminExtras === "function") loadAdminExtras();
}

async function loadPendingJobs() {
  adminPendingJobs.replaceChildren(createElement("p", "text-sm text-gray-600", "審査待ちを読み込んでいます…"));
  const { data: jobs, error } = await supabaseClient
    .from("published_jobs")
    .select("id, title, category, work_date, start_time, end_time, location, salary, duties, payment_method, pay_condition_details, break_minutes, overtime_details, allowance_details, work_preferences, required_licenses, preferred_licenses, experience_requirement_details, tags, image_url, image_urls, created_at")
    .eq("moderation_status", "pending")
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) {
    adminPendingJobs.replaceChildren(createElement("p", "rounded-lg bg-red-50 p-4 text-sm text-red-800", `審査待ちを読み込めませんでした。移行SQL（20261114）を実行済みか確認してください: ${error.message}`));
    return;
  }
  adminPendingJobs.replaceChildren();
  if (!jobs?.length) {
    adminPendingJobs.append(createElement("p", "rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500", "審査待ちのお仕事はありません。"));
    return;
  }

  jobs.forEach(job => {
    const card = createElement("article", "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm");
    card.append(createElement("h2", "break-words text-base font-bold text-gray-900", job.title));
    const dateTime = [
      job.work_date ? formatWorkDate(job.work_date) : "作業日未設定（既存募集）",
      job.start_time || job.end_time
        ? `${String(job.start_time || "未設定").slice(0, 5)}〜${String(job.end_time || "未設定").slice(0, 5)}`
        : ""
    ].filter(Boolean).join(" ");
    const details = [
      `カテゴリ: ${getWorkCategoryLabel(job.category)}`,
      `作業日時: ${dateTime}`,
      `場所: ${job.location || "未設定"}`,
      `報酬: ${job.salary || "未設定"}`,
      `支払い: ${getPaymentMethodLabel(job.payment_method)}`,
      `受付: ${job.created_at ? new Date(job.created_at).toLocaleString("ja-JP") : "日時不明"}`
    ];
    card.append(createElement("p", "mt-2 text-sm text-gray-700", details.join(" ／ ")));
    card.append(createElement("p", "mt-3 whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-3 text-sm text-gray-800", job.duties || "仕事内容の記載なし"));
    const additionalDetails = [
      job.pay_condition_details && `給与条件: ${job.pay_condition_details}`,
      job.break_minutes !== null && job.break_minutes !== undefined && `休憩: ${job.break_minutes}分`,
      job.overtime_details && `残業: ${job.overtime_details}`,
      job.allowance_details && `手当・待遇: ${job.allowance_details}`,
      job.work_preferences?.length && `勤務形態: ${getWorkPreferenceLabels(job.work_preferences).join("、")}`,
      job.required_licenses?.length && `必須資格: ${job.required_licenses.join("、")}`,
      job.preferred_licenses?.length && `歓迎資格: ${job.preferred_licenses.join("、")}`,
      job.experience_requirement_details && `経験: ${job.experience_requirement_details}`,
      getNormalizedJobTags(job.tags).length && `タグ: ${getNormalizedJobTags(job.tags).join("、")}`
    ].filter(Boolean);
    if (additionalDetails.length) {
      card.append(createElement("p", "mt-3 whitespace-pre-wrap break-words text-sm text-gray-700", additionalDetails.join("\n")));
    }

    const imageUrls = Array.isArray(job.image_urls) ? job.image_urls : job.image_url ? [job.image_url] : [];
    if (imageUrls.length) {
      const gallery = createElement("div", "mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3");
      imageUrls.forEach(source => {
        try {
          const imageUrl = new URL(source);
          if (imageUrl.origin !== new URL(SUPABASE_URL).origin) return;
          const image = document.createElement("img");
          image.src = imageUrl.href;
          image.alt = "審査中のお仕事の写真";
          image.loading = "lazy";
          image.className = "aspect-video w-full rounded-lg bg-gray-100 object-cover";
          gallery.append(image);
        } catch (error) {
          console.warn("審査画面で読み込めない写真URLをスキップしました:", error);
        }
      });
      if (gallery.childElementCount) card.append(gallery);
    }
    const actions = createElement("div", "mt-4 flex flex-wrap gap-2");
    actions.append(
      createActionButton("承認して公開", "bg-emerald-600 text-white hover:bg-emerald-700", () => reviewJob(job.id, "approved")),
      createActionButton("却下", "bg-red-700 text-white hover:bg-red-800", () => reviewJob(job.id, "rejected"))
    );
    card.append(actions);
    adminPendingJobs.append(card);
  });
}

async function reviewJob(jobId, decision) {
  let note = null;
  if (decision === "approved") {
    if (!window.confirm("このお仕事を承認して公開しますか？")) return;
  } else {
    note = window.prompt("却下理由（投稿者に表示・200文字以内）を入力してください。", "");
    if (note === null) return;
    if (!note.trim() || note.length > 200) {
      setAdminStatus("却下理由を1〜200文字で入力してください。", true);
      return;
    }
  }

  const { error } = await supabaseClient.rpc("admin_review_job", {
    p_job_id: jobId,
    p_decision: decision,
    p_note: note
  });
  if (error) {
    setAdminStatus(`審査結果を保存できませんでした: ${error.message}`, true);
    return;
  }
  setAdminStatus(decision === "approved" ? "お仕事を承認して公開しました。" : "お仕事を却下しました。");
  await loadPendingJobs();
  await loadReports();
}

async function loadReports() {
  setAdminStatus("通報を読み込んでいます…");
  const { data: reports, error } = await supabaseClient
    .from("job_reports")
    .select("id, job_id, job_title, reason, details, status, admin_note, created_at")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) {
    setAdminStatus(`通報を読み込めませんでした: ${error.message}`, true);
    return;
  }
  adminReportRows = reports || [];

  const jobIds = [...new Set(adminReportRows.map(report => Number(report.job_id)).filter(Number.isInteger))];
  adminJobsById = new Map();
  if (jobIds.length) {
    const { data: jobs, error: jobsError } = await supabaseClient
      .from("published_jobs")
      .select("id, title, is_hidden, hidden_reason, is_closed, expires_at, owner_id")
      .in("id", jobIds);
    if (jobsError) {
      setAdminStatus(`お仕事の状態を読み込めませんでした: ${jobsError.message}`, true);
      return;
    }
    (jobs || []).forEach(job => adminJobsById.set(String(job.id), job));
  }
  const { data: suspended, error: suspendedError } = await supabaseClient
    .from("suspended_users")
    .select("user_id");
  if (suspendedError) {
    setAdminStatus(`停止中のアカウントを読み込めませんでした。移行SQLを実行済みか確認してください: ${suspendedError.message}`, true);
    return;
  }
  adminSuspendedIds = new Set((suspended || []).map(row => row.user_id));
  setAdminStatus("");
  renderReports();
}

function renderReports() {
  const filter = adminReportFilter.value;
  const reports = adminReportRows.filter(report => filter === "all" || report.status === filter);
  adminReports.replaceChildren();
  if (!reports.length) {
    adminReports.append(createElement("p", "rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500", "該当する通報はありません。"));
    return;
  }

  const reportCounts = new Map();
  adminReportRows.forEach(report => reportCounts.set(report.job_id, (reportCounts.get(report.job_id) || 0) + 1));

  reports.forEach(report => {
    const job = adminJobsById.get(String(report.job_id));
    const card = createElement("article", "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm");
    const heading = createElement("div", "flex flex-wrap items-center gap-2");
    heading.append(
      createElement("span", "rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-700", REPORT_REASON_LABELS[report.reason] || report.reason),
      createElement("span", "rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-700", REPORT_STATUS_LABELS[report.status] || report.status),
      createElement("span", "text-xs text-gray-500", new Date(report.created_at).toLocaleString("ja-JP"))
    );
    if (reportCounts.get(report.job_id) > 1) {
      heading.append(createElement("span", "rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800", `このお仕事への通報: ${reportCounts.get(report.job_id)}件`));
    }
    card.append(heading);

    card.append(createElement("h2", "mt-3 break-words text-base font-bold text-gray-900", report.job_title));
    const jobState = !job
      ? "お仕事は削除されたか、見つかりません。"
      : job.is_hidden
        ? `非表示中${job.hidden_reason ? `（理由: ${job.hidden_reason}）` : ""}`
        : "公開中";
    card.append(createElement("p", "mt-1 text-xs text-gray-600", `お仕事ID: ${report.job_id} ／ 状態: ${jobState}${job?.owner_id && adminSuspendedIds.has(job.owner_id) ? " ／ 投稿者: 停止中" : ""}`));
    card.append(createElement("p", "mt-3 whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-3 text-sm", report.details || "（詳細の記入なし）"));
    if (report.admin_note) {
      card.append(createElement("p", "mt-2 whitespace-pre-wrap break-words rounded-lg bg-amber-50 p-3 text-xs text-amber-900", `運営メモ: ${report.admin_note}`));
    }

    const actions = createElement("div", "mt-4 flex flex-wrap gap-2");
    actions.append(createActionButton("運営メモ", "bg-white border border-gray-300 text-gray-800 hover:bg-gray-50", () => editAdminNote("job_reports", report.id, report.admin_note, loadReports)));
    if (job && !job.is_hidden) {
      actions.append(createActionButton("お仕事を非表示にする", "bg-red-600 text-white hover:bg-red-700", () => hideJob(report, job)));
    }
    if (job?.is_hidden) {
      actions.append(createActionButton("非表示を解除", "bg-blue-600 text-white hover:bg-blue-700", () => setJobHidden(job.id, false, "")));
    }
    if (job?.owner_id) {
      const suspended = adminSuspendedIds.has(job.owner_id);
      if (suspended) {
        actions.append(createActionButton("投稿者の停止を解除", "bg-blue-600 text-white hover:bg-blue-700", () => suspendOwner(job.owner_id, false)));
      } else {
        actions.append(createActionButton("投稿者のアカウントを停止", "bg-red-800 text-white hover:bg-red-900", () => suspendOwner(job.owner_id, true)));
      }
    }
    if (report.status !== "reviewed") {
      actions.append(createActionButton("確認済みにする", "bg-emerald-600 text-white hover:bg-emerald-700", () => setReportStatus(report.id, "reviewed")));
    }
    if (report.status !== "dismissed") {
      actions.append(createActionButton("対応不要にする", "bg-gray-200 text-gray-800 hover:bg-gray-300", () => setReportStatus(report.id, "dismissed")));
    }
    if (report.status !== "pending") {
      actions.append(createActionButton("未対応に戻す", "bg-gray-100 text-gray-700 hover:bg-gray-200", () => setReportStatus(report.id, "pending")));
    }
    card.append(actions);
    adminReports.append(card);
  });
}

async function setReportStatus(reportId, status) {
  const { error } = await supabaseClient.from("job_reports").update({ status }).eq("id", reportId);
  if (error) {
    setAdminStatus(`通報の状態を更新できませんでした: ${error.message}`, true);
    return false;
  }
  await loadReports();
  return true;
}

async function setJobHidden(jobId, hidden, reason) {
  const { error } = await supabaseClient.rpc("admin_set_job_hidden", {
    p_job_id: jobId,
    p_hidden: hidden,
    p_reason: reason
  });
  if (error) {
    setAdminStatus(`お仕事の表示状態を変更できませんでした: ${error.message}`, true);
    return false;
  }
  await loadReports();
  return true;
}

async function suspendOwner(ownerId, suspended) {
  let reason = "";
  if (suspended) {
    reason = window.prompt("この投稿者のアカウントを停止します。投稿者のお仕事はすべて非表示になり、投稿・応募・メッセージ送信ができなくなります。理由（200文字以内・運営用メモ）を入力してください。", "");
    if (reason === null) return;
    if (reason.length > 200) {
      setAdminStatus("理由は200文字以内で入力してください。", true);
      return;
    }
  }
  const { error } = await supabaseClient.rpc("admin_set_user_suspended", {
    p_user_id: ownerId,
    p_suspended: suspended,
    p_reason: reason
  });
  if (error) {
    setAdminStatus(`アカウントの状態を変更できませんでした: ${error.message}`, true);
    return;
  }
  await loadReports();
}

async function hideJob(report, job) {
  const reason = window.prompt(
    `「${job.title}」を非表示にします。投稿者に表示する理由（200文字以内）を入力してください。`,
    REPORT_REASON_LABELS[report.reason] || ""
  );
  if (reason === null) return;
  if (reason.length > 200) {
    setAdminStatus("理由は200文字以内で入力してください。", true);
    return;
  }
  if (await setJobHidden(job.id, true, reason)) {
    await setReportStatus(report.id, "reviewed");
  }
}

document.getElementById("adminLoginForm").addEventListener("submit", async event => {
  event.preventDefault();
  setAdminStatus("ログインしています…");
  const { error } = await supabaseClient.auth.signInWithPassword({
    email: document.getElementById("adminEmail").value.trim(),
    password: document.getElementById("adminPassword").value
  });
  if (error) {
    setAdminStatus("ログインできませんでした。メールアドレスとパスワードを確認してください。", true);
    return;
  }
  await initializeAdmin();
});
adminReportFilter.addEventListener("change", renderReports);
document.getElementById("adminReloadButton").addEventListener("click", loadReports);
document.getElementById("adminJobsReloadButton").addEventListener("click", loadPendingJobs);
initializeAdmin();
