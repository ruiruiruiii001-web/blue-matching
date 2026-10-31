const REPORT_REASON_LABELS = {
  misleading: "虚偽・誤解を招く内容",
  inappropriate: "不適切な内容",
  scam: "詐欺・不審な求人",
  contact: "連絡先が不正確",
  other: "その他"
};
const REPORT_STATUS_LABELS = { pending: "未対応", reviewed: "確認済み", dismissed: "対応不要" };

const adminStatus = document.getElementById("adminStatus");
const adminPanel = document.getElementById("adminPanel");
const adminReports = document.getElementById("adminReports");
const adminReportFilter = document.getElementById("adminReportFilter");
let adminJobsById = new Map();
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
  const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
  if (sessionError || !session) {
    setAdminStatus("運営者アカウントでログインしてから、このページを開き直してください。", true);
    return;
  }
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
}

async function loadReports() {
  setAdminStatus("通報を読み込んでいます…");
  const { data: reports, error } = await supabaseClient
    .from("job_reports")
    .select("id, job_id, job_title, reason, details, status, created_at")
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
      setAdminStatus(`求人の状態を読み込めませんでした: ${jobsError.message}`, true);
      return;
    }
    (jobs || []).forEach(job => adminJobsById.set(String(job.id), job));
  }
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
      heading.append(createElement("span", "rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800", `この求人への通報: ${reportCounts.get(report.job_id)}件`));
    }
    card.append(heading);

    card.append(createElement("h2", "mt-3 break-words text-base font-bold text-gray-900", report.job_title));
    const jobState = !job
      ? "求人は削除されたか、見つかりません。"
      : job.is_hidden
        ? `非表示中${job.hidden_reason ? `（理由: ${job.hidden_reason}）` : ""}`
        : "公開中";
    card.append(createElement("p", "mt-1 text-xs text-gray-600", `求人ID: ${report.job_id} ／ 状態: ${jobState}`));
    card.append(createElement("p", "mt-3 whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-3 text-sm", report.details || "（詳細の記入なし）"));

    const actions = createElement("div", "mt-4 flex flex-wrap gap-2");
    if (job && !job.is_hidden) {
      actions.append(createActionButton("求人を非表示にする", "bg-red-600 text-white hover:bg-red-700", () => hideJob(report, job)));
    }
    if (job?.is_hidden) {
      actions.append(createActionButton("非表示を解除", "bg-blue-600 text-white hover:bg-blue-700", () => setJobHidden(job.id, false, "")));
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
    setAdminStatus(`求人の表示状態を変更できませんでした: ${error.message}`, true);
    return false;
  }
  await loadReports();
  return true;
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

adminReportFilter.addEventListener("change", renderReports);
document.getElementById("adminReloadButton").addEventListener("click", loadReports);
initializeAdmin();
