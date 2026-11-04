function renderEmployerDashboard() {
  const container = document.getElementById("employerDashboardJobs");
  if (!container) return;
  if (!currentUser || accountType !== "employer") {
    container.innerHTML = "";
    return;
  }

  const unreadNotifications = getVisibleNotifications().filter(notification => !notification.read_at).length;
  renderNotifications("employerDashboardNotifications", "employerNotificationsStatus");
  renderLoginNotificationBanner();

  const ownedJobs = cachedJobs.filter(job => job.owner_id === currentUser.id);
  const ownedJobIds = new Set(ownedJobs.map(job => String(job.id)));
  const receivedApplications = accountApplications.filter(application =>
    ownedJobIds.has(String(application.job_id)) &&
    application.status !== "withdrawn"
  );

  const expiringJobs = ownedJobs.filter(job => !job.is_closed && getJobExpiryStatus(job)?.warning);
  const expiryBanner = expiringJobs.length
    ? `<p role="alert" class="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">⚠️ 掲載期限が近い、または切れたお仕事が${expiringJobs.length}件あります。必要なら掲載を延長できます。</p>`
    : "";

  container.innerHTML = expiryBanner + (ownedJobs.length
    ? ownedJobs.map(job => `
      <article class="bg-white rounded-2xl border border-gray-100 shadow-sm mb-4 transition-all hover:border-blue-200 group overflow-hidden">
        <div class="flex">
          ${getJobImages(job)[0] ? `
            <div class="w-24 shrink-0 bg-gray-100 overflow-hidden hidden sm:block">
              <img src="${escapeHtml(getJobImages(job)[0])}" alt="" class="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300">
            </div>
          ` : ""}
          <div class="flex-1 p-5 min-w-0">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div class="min-w-0 flex-1">
                <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">${escapeHtml(formatJobFreshness(job))}</p>
                <h4 class="break-words font-black text-gray-800 text-lg leading-tight group-hover:text-blue-600 transition-colors">${escapeHtml(String(job.title || ""))}</h4>
                <div class="flex flex-wrap gap-2 mt-2">
                  <span class="px-2 py-0.5 rounded-full bg-gray-50 border border-gray-100 text-[10px] font-bold text-gray-500">📍 ${escapeHtml(String(job.location || "未設定"))}</span>
                  <span class="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 text-[10px] font-bold">${escapeHtml(getWorkCategoryLabel(job.category))}</span>
                  ${job.work_date ? `<span class="px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 text-[10px] font-bold">📅 ${escapeHtml(formatWorkDate(job.work_date))}</span>` : ""}
                  <span class="px-2 py-0.5 rounded-full bg-violet-50 text-violet-800 text-[10px] font-bold">支払い: ${escapeHtml(getPaymentMethodLabel(job.payment_method))}</span>
                  <span class="px-2 py-0.5 rounded-full ${isJobClosed(job) ? "bg-gray-100 text-gray-400" : "bg-emerald-50 text-emerald-600"} text-[10px] font-bold border border-current/10 uppercase">${isJobClosed(job) ? "募集終了" : "募集中"}</span>
                  ${job.moderation_status === "pending" ? '<span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">運営の審査待ち</span>' : ""}
                  ${job.moderation_status === "rejected" ? '<span class="px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-bold">審査で非公開</span>' : ""}
                  ${job.is_hidden ? '<span class="px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-[10px] font-bold">運営により非表示中</span>' : ""}
                  <span class="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold">👁 閲覧 ${(jobViewCounts.get(String(job.id)) || 0).toLocaleString()}回</span>
                  <span class="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold">📨 応募 ${receivedApplications.filter(application => String(application.job_id) === String(job.id)).length}件</span>
                </div>
                ${job.is_hidden ? `<p class="mt-2 rounded-lg bg-red-50 p-2 text-xs font-bold text-red-800">このお仕事は運営の確認により非公開になっています${job.hidden_reason ? `（理由: ${escapeHtml(String(job.hidden_reason))}）` : ""}。内容を見直したい場合はお問い合わせください。</p>` : ""}
                ${job.moderation_status === "pending" ? '<p class="mt-2 rounded-lg bg-amber-50 p-2 text-xs font-bold text-amber-900">審査が完了するまで、ほかの利用者には表示されません。</p>' : ""}
                ${job.moderation_status === "rejected" ? `<p class="mt-2 rounded-lg bg-red-50 p-2 text-xs font-bold text-red-800">審査結果: ${escapeHtml(job.moderation_note || "内容を修正して再投稿してください。")}。編集して保存すると再審査に出せます。</p>` : ""}
                ${(() => {
                  const expiry = getJobExpiryStatus(job);
                  return expiry ? `<p class="mt-2 break-words rounded-lg ${expiry.warning ? "bg-red-50 text-red-800" : "bg-gray-50 text-gray-600"} p-2 text-xs font-bold">${expiry.warning ? "⚠️ " : ""}${escapeHtml(expiry.text)}</p>` : "";
                })()}
              </div>
              <div class="flex flex-wrap gap-2 sm:shrink-0 sm:justify-end">
                <button type="button" onclick="editJob(${job.id})" class="min-h-10 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors">編集</button>
                <button type="button" onclick="duplicateJob(${job.id})" class="min-h-10 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors">複製</button>
                <div class="flex items-center gap-1">
                  <select id="extendDays-${job.id}" aria-label="延長する日数" class="min-h-10 rounded-lg border border-gray-200 bg-white px-2 text-xs font-bold text-gray-700">
                    ${[7, 14, 30].map(days => `<option value="${days}"${days === 14 ? " selected" : ""}>+${days}日</option>`).join("")}
                  </select>
                  <button type="button" onclick="extendJob(${job.id})" class="min-h-10 rounded-lg ${getJobExpiryStatus(job)?.warning ? "bg-red-600 text-white hover:bg-red-700" : "bg-blue-50 text-blue-700 hover:bg-blue-100"} px-3 py-2 text-xs font-bold transition-colors">掲載を延長</button>
                </div>
                <button type="button" onclick="toggleJobClosed(${job.id})" class="min-h-10 rounded-lg bg-gray-50 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors">${job.is_closed ? "募集を再開" : "募集を終了"}</button>
              </div>
            </div>
          </div>
        </div>
      </article>
    `).join("")
    : '<div class="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200"><p class="text-xs text-gray-400">掲載中のお仕事はまだありません。</p></div>');

  const applicationCount = document.getElementById("employerApplicationCount");
  const applicationsStatus = document.getElementById("employerApplicationsStatus");
  const messagesStatus = document.getElementById("applicationMessagesStatus");
  const applicationsContainer = document.getElementById("employerDashboardApplications");
  applicationCount.innerText = unreadNotifications
    ? `未読 ${unreadNotifications}件`
    : receivedApplications.length
      ? `${receivedApplications.length}件`
      : "";
  applicationsStatus.innerText = accountApplicationsError;
  applicationsStatus.classList.toggle("hidden", !accountApplicationsError);
  messagesStatus.innerText = applicationMessagesError;
  messagesStatus.classList.toggle("hidden", !applicationMessagesError);

  applicationsContainer.innerHTML = accountApplicationsError
    ? ""
    : '<p class="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">応募通知を選ぶと、応募内容とメッセージが開きます。</p>';
}

function renderEmployerApplicationDetails(application) {
  const applicationId = escapeHtml(String(application.id));
  const statusActions = application.status === "pending"
    ? `
      <div class="mt-5 flex gap-3">
        <button type="button" onclick="updateApplicationStatus('${applicationId}', 'reviewed')" class="flex-1 h-11 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100">お仕事を確定する</button>
        <button type="button" onclick="openApplicationDismissalForm('${applicationId}')" class="flex-1 h-11 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-black text-gray-500 hover:bg-gray-50 transition-all">対応不要</button>
      </div>
    `
    : application.status === "withdrawn"
      ? '<p class="mt-5 rounded-lg bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800">応募した方が応募を取り下げました。</p>'
      : `
        <div class="mt-5 border-t border-gray-50 pt-4 flex justify-between items-center">
          <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Status: ${escapeHtml(formatApplicationStatus(application.status))}</p>
          <button type="button" onclick="openReviewModal('${applicationId}', '${escapeHtml(String(application.applicant_id))}', 'seeker')" class="px-4 py-2 bg-amber-50 text-amber-600 text-xs font-black rounded-xl border border-amber-100 hover:bg-amber-100 transition-all">⭐ お仕事を探す方を評価する</button>
        </div>
      `;
  return `
    <article class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div class="p-5">
        <div class="flex flex-wrap items-start justify-between gap-3 mb-4 pb-4 border-b border-gray-50">
          <div class="min-w-0 flex-1">
            <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">お仕事: ${escapeHtml(String(application.job_title || "お仕事"))}</p>
            <h4 class="font-black text-gray-900 text-lg leading-tight">👷 ${escapeHtml(String(application.applicant_name || ""))}</h4>
            <button type="button" onclick="openApplicantPublicProfile('${applicationId}')" class="mt-2 min-h-10 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">応募した方のプロフィールを見る</button>
            <p class="mt-1 text-[10px] text-gray-400 uppercase tracking-widest font-bold">応募日時: ${formatDashboardDate(application.created_at)}</p>
          </div>
          <span class="inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${application.status === "withdrawn" ? "bg-rose-100 text-rose-800" : formatApplicationStatusClass(application.status)}">${application.status === "withdrawn" ? "取り下げ" : escapeHtml(formatApplicationStatus(application.status))}</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs mb-4 bg-gray-50/80 p-4 rounded-xl border border-gray-100">
          <div class="flex items-center gap-2">
            <span class="text-base">💪</span>
            <div>
              <p class="text-[9px] font-bold text-gray-400 uppercase leading-none mb-1">仕事の経験</p>
              <p class="font-bold text-gray-700">${escapeHtml(getSeekerExperienceLabel(application.experience))}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-base">🔧</span>
            <div>
              <p class="text-[9px] font-bold text-gray-400 uppercase leading-none mb-1">保有資格</p>
              <p class="font-bold text-gray-700 truncate">${Array.isArray(application.licenses) && application.licenses.length ? application.licenses.map(license => escapeHtml(String(license))).join("、") : "未登録"}</p>
            </div>
          </div>
        </div>
        ${application.message
          ? `<div class="relative bg-white p-4 rounded-xl border border-gray-100 italic text-sm text-gray-700 leading-relaxed">
              <span class="absolute -top-2 left-4 px-2 bg-gray-50 text-[9px] font-bold text-gray-400 uppercase tracking-widest border border-gray-100 rounded">Message</span>
              "${escapeHtml(String(application.message))}"
             </div>`
          : '<p class="text-center py-2 text-[10px] text-gray-300 font-bold uppercase tracking-widest">No Message</p>'}
        ${application.dismissal_reason
          ? `<p class="mt-4 whitespace-pre-wrap rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700"><span class="mb-1 block text-xs font-bold text-gray-500">対応不要の理由</span>${escapeHtml(String(application.dismissal_reason))}</p>`
          : ""}
        ${renderApplicationConversation(application)}
        ${application.status === "withdrawn" ? "" : `<div data-tracking-box data-application-id="${applicationId}"></div>`}
        ${statusActions}
      </div>
    </article>
  `;
}

function showEmployerDashboardView(view) {
  const views = ["jobs", "messages", "profile", "job-editor"];
  if (!views.includes(view)) return;

  views.forEach(item => {
    document.getElementById(`employerDashboardView-${item}`).classList.toggle("hidden", item !== view);
  });
  document.getElementById("employerDashboardNavigation").classList.toggle("hidden", view === "job-editor");
  document.querySelectorAll(".employer-dashboard-menu-button").forEach(button => {
    const isActive = button.dataset.employerDashboardView === view;
    button.classList.toggle("bg-blue-600", isActive);
    button.classList.toggle("text-white", isActive);
    button.classList.toggle("bg-gray-200", !isActive);
    button.classList.toggle("text-gray-700", !isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
  if (view === "profile") loadEmployerProfileForm();
}
