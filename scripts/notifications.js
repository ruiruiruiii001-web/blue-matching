function renderLoginNotificationBanner() {

  const banner = document.getElementById("loginNotificationBanner");
  if (!banner || loginNotificationBannerDismissed || !currentUser || !accountType || appNotificationsError) {
    banner?.classList.add("hidden");
    return;
  }
  const pendingContactCount = accountType === "seeker"
    ? seekerContactRequests.filter(request => request.status === "pending").length
    : 0;
  const unreadCount = appNotifications.filter(notification => !notification.read_at).length;
  if (!pendingContactCount && !unreadCount) {
    banner.classList.add("hidden");
    return;
  }
  document.getElementById("loginNotificationMessage").innerText = pendingContactCount
    ? `企業からの連絡が${pendingContactCount}件届いています。マイページから確認できます。`
    : `新しいお知らせが${unreadCount}件あります。マイページから確認できます。`;
  banner.classList.remove("hidden");
}

function dismissLoginNotificationBanner() {
  loginNotificationBannerDismissed = true;
  document.getElementById("loginNotificationBanner").classList.add("hidden");
}

    function renderNotifications(containerId, statusId) {
  const container = document.getElementById(containerId);
  const status = document.getElementById(statusId);
  if (!container || !status) return;
  const notificationError = appNotificationsError ||
    (accountType === "seeker" ? seekerContactRequestsError : "");
  const notificationStatusText = [
    appNotificationsError,
    accountType === "seeker" ? seekerContactRequestsError : "",
    accountType === "employer" ? employerContactRequestsError : ""
  ].filter(Boolean).join(" ");
  status.innerText = notificationStatusText;
  status.classList.toggle("hidden", !notificationStatusText);
  container.innerHTML = notificationError
    ? ""
    : appNotifications.length
      ? appNotifications.map(notification => `
        <article class="p-5 rounded-2xl border border-gray-100 shadow-sm mb-3 transition-all ${notification.read_at ? "bg-white" : "bg-blue-50/40 border-blue-100"}">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="flex h-2 w-2 rounded-full ${notification.read_at ? "bg-gray-300" : "bg-blue-600 animate-pulse"}"></span>
                <p class="font-black text-gray-900">${escapeHtml(String(notification.title || "通知"))}</p>
              </div>
              ${["job_application", "application_message"].includes(notification.event_type)
                ? renderApplicationNotificationDetails(notification)
                : `<p class="mt-1 text-sm text-gray-600 leading-relaxed">${escapeHtml(notification.event_type === "contact_reply" ? "求職者から届いた連絡への返信です。" : String(notification.body || ""))}</p>`}
              <p class="mt-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">${formatDashboardDate(notification.created_at)}</p>
              ${notification.event_type === "contact_request" ? renderContactRequestNotification(notification.related_id) : ""}
              ${notification.event_type === "contact_reply" ? renderContactReplyNotification(notification.related_id) : ""}
              ${["job_application", "application_message"].includes(notification.event_type)
                ? `<button type="button" onclick="openApplicationNotification('${escapeHtml(String(notification.event_type === "application_message" ? notification.context_id || "" : notification.related_id || ""))}', '${escapeHtml(String(notification.id))}')" class="mt-3 min-h-10 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700">応募内容とメッセージを見る</button>`
                : ""}
            </div>
            ${["job_application", "application_message"].includes(notification.event_type)
              ? ""
              : notification.read_at
              ? '<span class="shrink-0 text-[10px] font-bold text-gray-300 uppercase tracking-tighter">Read</span>'
              : `<button type="button" onclick="markNotificationRead('${escapeHtml(String(notification.id))}')" class="shrink-0 rounded-xl bg-blue-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-blue-700 transition-all shadow-md shadow-blue-100">${notification.legacy ? "確認" : "既読にする"}</button>`}
          </div>
        </article>
      `).join("")
      : '<div class="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200"><p class="text-xs text-gray-400">新しい通知はありません。</p></div>';
}

function renderApplicationNotificationDetails(notification) {
  const applicationId = notification.event_type === "application_message"
    ? notification.context_id
    : notification.related_id;
  const application = accountApplications.find(item =>
    String(item.id) === String(applicationId)
  );
  if (!application) {
    return `<p class="mt-1 text-sm text-gray-600 leading-relaxed">${escapeHtml(String(notification.body || ""))}</p>`;
  }
  const applicantDetail = accountType === "employer"
    ? `<div><dt class="inline font-medium text-gray-500">応募者：</dt><dd class="inline font-bold text-gray-800">${escapeHtml(String(application.applicant_name || "名前未登録"))}</dd></div>`
    : "";
  return `
    <dl class="mt-2 grid grid-cols-1 gap-1 rounded-lg bg-white/80 p-3 text-sm sm:grid-cols-2">
      ${applicantDetail}
      <div><dt class="inline font-medium text-gray-500">求人：</dt><dd class="inline font-bold text-gray-800">${escapeHtml(String(application.job_title || "求人"))}</dd></div>
    </dl>
  `;
}

function renderContactReplyNotification(requestId) {
  const request = employerContactRequests.find(item => item.id === requestId);
  if (!request) return '<p class="mt-2 text-xs text-amber-800">返信内容を読み込めませんでした。画面を再読み込みしてください。</p>';
  return request.status === "responded"
    ? `<p class="mt-3 whitespace-pre-wrap break-words rounded-lg bg-white p-3 text-sm text-gray-800">${escapeHtml(String(request.seeker_reply || ""))}</p>`
    : '<p class="mt-3 rounded-lg bg-white p-3 text-sm text-gray-600">求職者は連絡を見送りました。</p>';
}

function openApplicationNotification(applicationId, notificationId) {
  const application = accountApplications.find(item =>
    String(item.id) === String(applicationId)
  );
  if (!currentUser || !application) {
    const status = document.getElementById(accountType === "employer" ? "employerApplicationsStatus" : "dashboardApplicationsStatus");
    if (status) {
      status.innerText = "応募内容を確認できませんでした。画面を再読み込みしてください。";
      status.classList.remove("hidden");
    }
    return;
  }
  if (accountType === "employer") {
    selectedEmployerApplicationId = String(application.id);
    showEmployerDashboardView("messages");
    renderEmployerDashboard();
  } else {
    showDashboardView("applications");
  }
  if (notificationId) markNotificationRead(notificationId);
  setTimeout(() => {
    const targetId = accountType === "employer"
      ? `application-card-${applicationId}`
      : `application-thread-${applicationId}`;
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 0);
}

function renderContactRequestNotification(requestId) {
  const request = seekerContactRequests.find(item => item.id === requestId);
  if (!request) return '<p class="mt-2 text-xs text-amber-800">連絡内容を読み込めませんでした。画面を再読み込みしてください。</p>';
  return `
    <div class="mt-3 rounded-lg bg-white p-3">
      <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p class="font-bold">企業からの連絡</p>
        <span class="rounded-full px-2.5 py-1 text-xs font-bold ${request.status === "pending" ? "bg-amber-100 text-amber-900" : request.status === "responded" ? "bg-emerald-100 text-emerald-900" : "bg-gray-100 text-gray-700"}">${request.status === "pending" ? "未返信" : request.status === "responded" ? "返信済み" : "見送り済み"}</span>
      </div>
      <p class="whitespace-pre-wrap break-words text-sm">${escapeHtml(String(request.employer_message || ""))}</p>
      ${request.status === "pending" ? `
        <label class="mt-3 block text-sm font-medium">返信メッセージ
          <textarea id="contactReply-${escapeHtml(String(request.id))}" maxlength="1000" rows="3" class="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="企業への返信を入力"></textarea>
        </label>
        <div class="mt-2 flex flex-wrap gap-2">
          <button type="button" onclick="respondToContactRequest('${escapeHtml(String(request.id))}', 'responded')" class="min-h-10 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800">返信する</button>
          <button type="button" onclick="respondToContactRequest('${escapeHtml(String(request.id))}', 'declined')" class="min-h-10 rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50">見送る</button>
        </div>
      ` : request.seeker_reply
        ? `<p class="mt-3 whitespace-pre-wrap break-words rounded bg-emerald-50 p-2 text-sm"><span class="font-bold">あなたの返信:</span><br>${escapeHtml(String(request.seeker_reply))}</p>`
        : ""}
    </div>`;
}

async function markNotificationRead(notificationId) {
  if (!currentUser) return;
  const userId = currentUser.id;
  const notification = appNotifications.find(item =>
    item.id === notificationId && item.recipient_id === userId && !item.read_at
  );
  if (!notification) return;
  if (notification.legacy) {
    appNotifications = appNotifications.map(item =>
      item.id === notificationId ? { ...item, read_at: new Date().toISOString() } : item
    );
    renderAccountDashboard();
    return;
  }
  const { data, error } = await supabaseClient
    .from("app_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("recipient_id", userId)
    .is("read_at", null)
    .select()
    .maybeSingle();
  if (currentUser?.id !== userId) return;
  if (error) {
    const statusId = accountType === "employer" ? "employerNotificationsStatus" : "seekerNotificationsStatus";
    const status = document.getElementById(statusId);
    status.innerText = `通知を既読にできませんでした: ${error.message}`;
    status.classList.remove("hidden");
    console.error("通知既読更新エラー:", error);
    return;
  }
  if (!data) return;
  appNotifications = appNotifications.map(item => item.id === data.id ? data : item);
  if (accountType === "employer") renderEmployerDashboard();
  else renderAccountDashboard();
}

async function sendNotificationEmail(eventType, recordId) {
  try {
    const { error } = await supabaseClient.functions.invoke("send-notification", {
      body: { event_type: eventType, record_id: recordId }
    });
    if (!error) return "";
    console.error("メール通知の送信エラー:", error);
    let errorDetail = error.message;
    const context = error.context;
    if (typeof context?.status === "number") {
      errorDetail = `HTTP ${context.status}: ${error.message}`;
      if (typeof context.clone === "function") {
        const responseText = await context.clone().text().catch(() => "");
        try {
          const responseBody = JSON.parse(responseText);
          if (typeof responseBody.error === "string") {
            errorDetail = `HTTP ${context.status}: ${responseBody.error}`;
          }
        } catch {
          if (responseText) {
            errorDetail = `HTTP ${context.status}: ${responseText.slice(0, 300)}`;
          }
        }
      }
    }
    return `操作は保存されましたが、通知メールを送信できませんでした。通知用SQL移行とメール設定を確認してください (${errorDetail})`;
  } catch (error) {
    console.error("メール通知への接続エラー:", error);
    return "操作は保存されましたが、通知メールサービスに接続できませんでした。通知用SQL移行とメール設定を確認してください。";
  }
}

async function respondToContactRequest(requestId, status) {
  if (!currentUser || accountType !== "seeker" || !["responded", "declined"].includes(status)) return;
  const seekerId = currentUser.id;
  const request = seekerContactRequests.find(item => item.id === requestId && item.seeker_id === seekerId);
  if (!request || request.status !== "pending") return;
  const reply = status === "responded"
    ? document.getElementById(`contactReply-${requestId}`).value.trim()
    : "";
  if (status === "responded" && !reply) {
    const dashboardStatus = document.getElementById("accountDashboardStatus");
    dashboardStatus.innerText = "返信メッセージを入力してください。";
    dashboardStatus.classList.remove("hidden");
    document.getElementById(`contactReply-${requestId}`).focus();
    return;
  }
  document.getElementById("accountDashboardStatus").classList.add("hidden");
  const { data, error } = await supabaseClient
    .from("seeker_contact_requests")
    .update({
      status,
      seeker_reply: reply || null,
      responded_at: new Date().toISOString()
    })
    .eq("id", requestId)
    .eq("seeker_id", seekerId)
    .eq("status", "pending")
    .select()
    .maybeSingle();
  if (currentUser?.id !== seekerId || accountType !== "seeker") return;
  if (error) {
    document.getElementById("accountDashboardStatus").innerText = `連絡リクエストに返信できませんでした: ${error.message}`;
    document.getElementById("accountDashboardStatus").classList.remove("hidden");
    console.error("企業への返信エラー:", error);
    return;
  }
  if (!data) {
    document.getElementById("accountDashboardStatus").innerText = "この連絡リクエストはすでに処理されています。表示を更新してください。";
    document.getElementById("accountDashboardStatus").classList.remove("hidden");
    return;
  }
  appNotifications = appNotifications.map(notification =>
    notification.event_type === "contact_request" && notification.related_id === data.id
      ? { ...notification, read_at: notification.read_at || new Date().toISOString() }
      : notification
  );
  const emailWarning = await sendNotificationEmail("contact_reply", requestId);
  if (currentUser?.id !== seekerId || accountType !== "seeker") return;
  seekerContactRequests = seekerContactRequests.map(item => item.id === data.id ? data : item);
  renderAccountDashboard();
  if (emailWarning) {
    const dashboardStatus = document.getElementById("accountDashboardStatus");
    dashboardStatus.innerText = emailWarning;
    dashboardStatus.classList.remove("hidden");
  }
}
