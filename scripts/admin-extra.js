const MESSAGE_REPORT_REASON_LABELS = {
  harassment: "嫌がらせ・迷惑行為",
  scam: "詐欺・不審な勧誘",
  contact: "連絡先の不要な要求",
  inappropriate: "不適切な内容",
  other: "その他"
};
const ACCOUNT_TYPE_LABELS = { seeker: "お仕事を探す方", employer: "お仕事をお願いする方" };

const adminMessageReports = document.getElementById("adminMessageReports");
const adminMessageReportFilter = document.getElementById("adminMessageReportFilter");
const adminUsers = document.getElementById("adminUsers");
let adminMessageReportRows = [];
let adminSuspensionLogs = new Map();

function showAdminTab(name) {
  document.querySelectorAll("[data-admin-panel]").forEach(panel => {
    panel.classList.toggle("hidden", panel.dataset.adminPanel !== name);
  });
  document.querySelectorAll("[data-admin-tab]").forEach(tab => {
    const active = tab.dataset.adminTab === name;
    tab.setAttribute("aria-selected", String(active));
    tab.classList.toggle("bg-gray-900", active);
    tab.classList.toggle("text-white", active);
    tab.classList.toggle("bg-white", !active);
    tab.classList.toggle("text-gray-800", !active);
    tab.classList.toggle("border", !active);
    tab.classList.toggle("border-gray-300", !active);
  });
}

async function editAdminNote(table, id, currentNote, reload) {
  const note = window.prompt("運営用のメモ（500文字以内・利用者には表示されません）", currentNote || "");
  if (note === null) return;
  if (note.length > 500) {
    setAdminStatus("メモは500文字以内で入力してください。", true);
    return;
  }
  const { error } = await supabaseClient.from(table).update({ admin_note: note.trim() || null }).eq("id", id);
  if (error) {
    setAdminStatus(`メモを保存できませんでした: ${error.message}`, true);
    return;
  }
  await reload();
}

async function loadAdminExtras() {
  await Promise.all([loadMessageReports(), loadAdminUsers()]);
}

async function loadMessageReports() {
  const { data, error } = await supabaseClient
    .from("message_reports")
    .select("id, application_id, reported_user_id, reason, details, message_body, status, admin_note, created_at")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) {
    adminMessageReports.replaceChildren(createElement("p", "rounded-lg bg-red-50 p-4 text-sm text-red-800", `メッセージの通報を読み込めませんでした。移行SQL（20261108）を実行済みか確認してください: ${error.message}`));
    return;
  }
  adminMessageReportRows = data || [];
  renderMessageReports();
}

async function setMessageReportStatus(id, status) {
  const { error } = await supabaseClient.from("message_reports").update({ status }).eq("id", id);
  if (error) {
    setAdminStatus(`通報の状態を更新できませんでした: ${error.message}`, true);
    return;
  }
  await loadMessageReports();
}

function renderMessageReports() {
  const filter = adminMessageReportFilter.value;
  const rows = adminMessageReportRows.filter(row => filter === "all" || row.status === filter);
  adminMessageReports.replaceChildren();
  if (!rows.length) {
    adminMessageReports.append(createElement("p", "rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500", "該当する通報はありません。"));
    return;
  }
  const counts = new Map();
  adminMessageReportRows.forEach(row => {
    if (row.reported_user_id) counts.set(row.reported_user_id, (counts.get(row.reported_user_id) || 0) + 1);
  });

  rows.forEach(row => {
    const card = createElement("article", "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm");
    const heading = createElement("div", "flex flex-wrap items-center gap-2");
    heading.append(
      createElement("span", "rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-700", MESSAGE_REPORT_REASON_LABELS[row.reason] || row.reason),
      createElement("span", "rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-700", REPORT_STATUS_LABELS[row.status] || row.status),
      createElement("span", "text-xs text-gray-500", new Date(row.created_at).toLocaleString("ja-JP"))
    );
    if (row.reported_user_id && counts.get(row.reported_user_id) > 1) {
      heading.append(createElement("span", "rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800", `この送信者への通報: ${counts.get(row.reported_user_id)}件`));
    }
    card.append(heading);
    card.append(createElement("p", "mt-3 text-xs font-bold text-gray-600", "通報されたメッセージ"));
    card.append(createElement("p", "mt-1 whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-3 text-sm", row.message_body));
    if (row.details) card.append(createElement("p", "mt-2 whitespace-pre-wrap break-words text-xs text-gray-700", `通報者の補足: ${row.details}`));
    if (row.admin_note) card.append(createElement("p", "mt-2 whitespace-pre-wrap break-words rounded-lg bg-amber-50 p-3 text-xs text-amber-900", `運営メモ: ${row.admin_note}`));

    const actions = createElement("div", "mt-4 flex flex-wrap gap-2");
    actions.append(createActionButton("運営メモ", "bg-white border border-gray-300 text-gray-800 hover:bg-gray-50", () => editAdminNote("message_reports", row.id, row.admin_note, loadMessageReports)));
    if (row.reported_user_id) {
      const suspended = adminSuspendedIds.has(row.reported_user_id);
      actions.append(suspended
        ? createActionButton("送信者の停止を解除", "bg-blue-600 text-white hover:bg-blue-700", async () => { await suspendOwner(row.reported_user_id, false); await loadAdminExtras(); })
        : createActionButton("送信者のアカウントを停止", "bg-red-800 text-white hover:bg-red-900", async () => { await suspendOwner(row.reported_user_id, true); await loadAdminExtras(); }));
    }
    if (row.status !== "reviewed") actions.append(createActionButton("確認済みにする", "bg-emerald-600 text-white hover:bg-emerald-700", () => setMessageReportStatus(row.id, "reviewed")));
    if (row.status !== "dismissed") actions.append(createActionButton("対応不要にする", "bg-gray-200 text-gray-800 hover:bg-gray-300", () => setMessageReportStatus(row.id, "dismissed")));
    if (row.status !== "pending") actions.append(createActionButton("未対応に戻す", "bg-gray-100 text-gray-700 hover:bg-gray-200", () => setMessageReportStatus(row.id, "pending")));
    card.append(actions);
    adminMessageReports.append(card);
  });
}

async function loadAdminUsers() {
  const query = document.getElementById("adminUserQuery").value.trim();
  const [usersResult, logsResult, suspendedResult] = await Promise.all([
    supabaseClient.rpc("admin_list_users", { p_query: query || null, p_limit: 50 }),
    supabaseClient.from("suspension_log").select("user_id, action, reason, created_at").order("created_at", { ascending: false }).limit(500),
    supabaseClient.from("suspended_users").select("user_id")
  ]);
  if (usersResult.error) {
    adminUsers.replaceChildren(createElement("p", "rounded-lg bg-red-50 p-4 text-sm text-red-800", `ユーザーを読み込めませんでした。移行SQL（20261108）を実行済みか確認してください: ${usersResult.error.message}`));
    return;
  }
  if (!suspendedResult.error) adminSuspendedIds = new Set((suspendedResult.data || []).map(row => row.user_id));
  adminSuspensionLogs = new Map();
  (logsResult.data || []).forEach(log => {
    if (!adminSuspensionLogs.has(log.user_id)) adminSuspensionLogs.set(log.user_id, []);
    adminSuspensionLogs.get(log.user_id).push(log);
  });
  renderAdminUsers(usersResult.data || []);
}

function renderAdminUsers(users) {
  adminUsers.replaceChildren();
  if (!users.length) {
    adminUsers.append(createElement("p", "rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500", "該当するユーザーはいません。"));
    return;
  }
  users.forEach(user => {
    const card = createElement("article", "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm");
    const heading = createElement("div", "flex flex-wrap items-center gap-2");
    heading.append(
      createElement("span", "break-all text-sm font-bold text-gray-900", user.email || "（メールなし）"),
      createElement("span", "rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-700", ACCOUNT_TYPE_LABELS[user.account_type] || "種類未設定")
    );
    if (user.is_suspended) heading.append(createElement("span", "rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-700", "停止中"));
    card.append(heading);
    card.append(createElement("p", "mt-2 text-xs text-gray-600",
      `登録: ${new Date(user.created_at).toLocaleDateString("ja-JP")} ／ 最終ログイン: ${user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString("ja-JP") : "なし"} ／ お仕事: ${user.job_count}件 ／ メッセージ通報された回数: ${user.report_count}件`));
    if (user.is_suspended && user.suspended_reason) {
      card.append(createElement("p", "mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-800", `停止の理由: ${user.suspended_reason}`));
    }
    const logs = adminSuspensionLogs.get(user.user_id) || [];
    if (logs.length) {
      const list = createElement("ul", "mt-2 space-y-1 text-xs text-gray-600");
      logs.slice(0, 5).forEach(log => {
        list.append(createElement("li", "", `${new Date(log.created_at).toLocaleString("ja-JP")} ${log.action === "suspended" ? "停止" : "停止解除"}${log.reason ? `（${log.reason}）` : ""}`));
      });
      card.append(createElement("p", "mt-3 text-xs font-bold text-gray-700", "停止の履歴"), list);
    }
    const actions = createElement("div", "mt-4 flex flex-wrap gap-2");
    actions.append(user.is_suspended
      ? createActionButton("停止を解除", "bg-blue-600 text-white hover:bg-blue-700", async () => { await suspendOwner(user.user_id, false); await loadAdminUsers(); })
      : createActionButton("アカウントを停止", "bg-red-800 text-white hover:bg-red-900", async () => { await suspendOwner(user.user_id, true); await loadAdminUsers(); }));
    card.append(actions);
    adminUsers.append(card);
  });
}

document.querySelectorAll("[data-admin-tab]").forEach(tab => {
  tab.addEventListener("click", () => showAdminTab(tab.dataset.adminTab));
});
adminMessageReportFilter.addEventListener("change", renderMessageReports);
document.getElementById("adminUserSearchForm").addEventListener("submit", event => {
  event.preventDefault();
  loadAdminUsers();
});
