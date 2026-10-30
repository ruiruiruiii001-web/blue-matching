function renderAccountDashboard() {
  if (!currentUser || accountDataUserId !== currentUser.id) return;

  const favoriteJobs = cachedJobs.filter(job => isFavorite(job.id));
  const favoriteContainer = document.getElementById("dashboardFavorites");
  favoriteContainer.innerHTML = favoriteJobs.length
    ? favoriteJobs.map(job => `
      <div class="flex items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-2 hover:border-blue-200 transition-all group">
        <button type="button" onclick="openModal(${job.id})" aria-label="求人詳細を開く: ${escapeHtml(job.title)}" class="min-w-0 flex-1 text-left">
          <span class="font-bold text-gray-800 group-hover:text-blue-600 truncate block w-full transition-colors">${escapeHtml(job.title)}</span>
          <span class="text-[10px] text-gray-400 mt-1 uppercase tracking-wider font-medium flex items-center gap-1">
            <span class="text-xs">📍</span> ${escapeHtml(job.location || '場所未設定')}
          </span>
        </button>
        <button type="button" onclick="toggleFavorite('${String(job.id)}')" class="shrink-0 text-[10px] font-black text-amber-600 bg-amber-50 px-3 py-2 rounded-lg hover:bg-amber-100 transition-colors uppercase tracking-tighter">Remove</button>
      </div>
    `).join("")
    : '<div class="text-center py-10 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200"><p class="text-xs text-gray-400 font-bold uppercase tracking-widest">No Favorites Yet</p></div>';

  const submitted = accountApplications.filter(application => application.applicant_id === currentUser.id);
  const employerIdsByJobId = new Map(cachedJobs.map(job => [String(job.id), job.owner_id]));
  const applicationsContainer = document.getElementById("dashboardApplications");
  applicationsContainer.innerHTML = accountApplicationsError
    ? `<p class="text-sm text-red-700">${escapeHtml(accountApplicationsError)}</p>`
    : `
    ${submitted.length
      ? submitted.map(application => `
      <article class="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm mb-4 transition-all hover:shadow-md">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4 pb-4 border-b border-gray-50">
          <p class="font-black text-gray-900 text-lg leading-tight">${escapeHtml(application.job_title)}</p>
          <div class="flex items-center gap-2">
            ${application.status === 'reviewed' && employerIdsByJobId.get(String(application.job_id)) ? `
              <button type="button" onclick="openReviewModal('${application.id}', '${employerIdsByJobId.get(String(application.job_id))}', 'employer')" class="px-3 py-1 bg-amber-50 text-amber-600 text-[10px] font-black rounded-lg border border-amber-100 hover:bg-amber-100 transition-colors uppercase tracking-widest">
              ⭐ 評価する
              </button>
            ` : ''}
              <span class="inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${formatApplicationStatusClass(application.status)}">${formatApplicationStatus(application.status)}</span>
            </div>
          </div>
          <div class="flex items-center justify-between">
            <div class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Applied on: <span class="text-gray-600">${formatDashboardDate(application.created_at)}</span>
            </div>
            <p class="text-xs font-bold ${application.status === 'reviewed' ? 'text-emerald-600' : 'text-blue-500'} flex items-center gap-1">
              ${application.status === 'reviewed' ? '✅' : '⏳'} ${formatApplicationStatusDescription(application.status)}
            </p>
          </div>
        </article>
      `).join("")
      : '<div class="text-center py-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200"><p class="text-xs text-gray-400 font-bold uppercase tracking-widest">No Applications Yet</p></div>'}
  `;

  const unreadNotifications = appNotifications.filter(notification => !notification.read_at).length;
  document.getElementById("seekerNotificationsTab").innerText = unreadNotifications
    ? `通知 (${unreadNotifications})`
    : "連絡・通知";
        renderNotifications("seekerDashboardNotifications", "seekerNotificationsStatus");
  renderBlocks();
  renderLoginNotificationBanner();
}

    function renderBlocks() {
  const container = document.getElementById("dashboardBlocks");
  if (!container) return;

  container.innerHTML = blockedUserIds.length
    ? blockedUserIds.map(id => `
      <div class="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 shadow-sm mb-2">
        <div class="flex items-center gap-2">
          <span class="text-xl">🚫</span>
          <p class="text-xs font-bold text-gray-500 uppercase tracking-widest">ユーザー: ${id.slice(0,8)}...</p>
        </div>
        <button type="button" onclick="unblockUser('${id}')" class="px-3 py-2 text-[10px] font-black text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors uppercase tracking-widest">
          ブロック解除
        </button>
      </div>
    `).join("")
    : '<div class="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200"><p class="text-xs text-gray-400 font-bold uppercase tracking-widest">ブロック中のユーザーはいません</p></div>';
}

function showDashboardView(view) {
  const views = ["profile", "favorites", "applications", "notifications", "blocks"];
  if (!views.includes(view)) return;
  activeDashboardView = view;
  views.forEach(item => {
    document.getElementById(`dashboardView-${item}`).classList.toggle("hidden", item !== view);
  });
  document.querySelectorAll(".dashboard-menu-button").forEach(button => {
    const isActive = button.dataset.dashboardView === view;
    button.classList.toggle("bg-blue-600", isActive);
    button.classList.toggle("text-white", isActive);
    button.classList.toggle("bg-gray-200", !isActive);
    button.classList.toggle("text-gray-700", !isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
  renderAccountDashboard();
}
