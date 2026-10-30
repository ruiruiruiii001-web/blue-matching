function renderEmployerDashboard(resetLimit = false) {
  if (resetLimit === true) displayLimitProfiles = 10;
  const container = document.getElementById("employerDashboardJobs");
  const profilesContainer = document.getElementById("employerSeekerProfiles");
  if (!container || !profilesContainer) return;
  if (!currentUser || accountType !== "employer") {
    container.innerHTML = "";
    profilesContainer.innerHTML = "";
    return;
  }

  const unreadNotifications = appNotifications.filter(notification => !notification.read_at).length;
  document.getElementById("employerNotificationCount").innerText = unreadNotifications
    ? `未読 ${unreadNotifications}件`
    : "";
  renderNotifications("employerDashboardNotifications", "employerNotificationsStatus");
  const ownedJobs = cachedJobs.filter(job => job.owner_id === currentUser.id);
  const ownedJobIds = new Set(ownedJobs.map(job => String(job.id)));
  const receivedApplications = accountApplications.filter(application =>
    ownedJobIds.has(String(application.job_id))
  );
  const seekerSearchKeyword = document.getElementById("employerSeekerKeyword")?.value.trim().toLocaleLowerCase("ja-JP") || "";
  const seekerExperienceFilter = document.getElementById("employerSeekerExperience")?.value || "";
        const filteredPublicProfiles = publicSeekerProfiles.filter(profile => {
        const searchableProfile = [
          profile.job_type,
          profile.location,
          profile.exp_years,
          profile.stamina,
          ...(Array.isArray(profile.licenses) ? profile.licenses : [])
        ].join(" ").toLocaleLowerCase("ja-JP");
        return (!seekerSearchKeyword || searchableProfile.includes(seekerSearchKeyword)) &&
          (!seekerExperienceFilter || profile.exp_years === seekerExperienceFilter) &&
          (!currentUser || !blockedUserIds.includes(profile.user_id));
  });


  const displayProfiles = filteredPublicProfiles.slice(0, displayLimitProfiles);

  document.getElementById("employerSeekerProfileCount").innerText = publicSeekerProfiles.length
    ? `${filteredPublicProfiles.length} / ${publicSeekerProfiles.length}件を表示中`
    : "";
              // 掲載中の自分の求人描画
  container.innerHTML = ownedJobs.length
    ? ownedJobs.map(job => `
      <article class="bg-white rounded-2xl border border-gray-100 shadow-sm mb-4 transition-all hover:border-blue-200 group overflow-hidden">
        <div class="flex">
          ${job.image_url ? `
            <div class="w-24 shrink-0 bg-gray-100 overflow-hidden hidden sm:block">
              <img src="${escapeHtml(job.image_url)}" alt="" class="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300">
            </div>
          ` : ''}
          <div class="flex-1 p-5 min-w-0">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0 flex-1">
                <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">${escapeHtml(formatJobFreshness(job))}</p>
                <h4 class="font-black text-gray-800 text-lg leading-tight truncate group-hover:text-blue-600 transition-colors">${escapeHtml(String(job.title || ""))}</h4>
                <div class="flex flex-wrap gap-2 mt-2">
                  <span class="px-2 py-0.5 rounded-full bg-gray-50 border border-gray-100 text-[10px] font-bold text-gray-500">📍 ${escapeHtml(String(job.location || "未設定"))}</span>
                  <span class="px-2 py-0.5 rounded-full ${job.is_closed ? 'bg-gray-100 text-gray-400' : 'bg-emerald-50 text-emerald-600'} text-[10px] font-bold border border-current/10 uppercase">${job.is_closed ? "募集終了" : "募集中"}</span>
                </div>
              </div>
              <div class="flex flex-wrap justify-end gap-2">
                <button type="button" onclick="editJob(${job.id})" class="min-h-10 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors">
                  編集
                </button>
                <button type="button" onclick="toggleJobClosed(${job.id})" class="min-h-10 rounded-lg bg-gray-50 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors">
                  ${job.is_closed ? "募集を再開" : "募集を終了"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </article>
    `).join("")
    : '<div class="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200"><p class="text-xs text-gray-400">掲載中の求人はまだありません。</p></div>';


  const applicationCount = document.getElementById("employerApplicationCount");
  const applicationsStatus = document.getElementById("employerApplicationsStatus");
  const applicationsContainer = document.getElementById("employerDashboardApplications");
  applicationCount.innerText = receivedApplications.length ? `${receivedApplications.length}件` : "";
  applicationsStatus.innerText = accountApplicationsError;
  applicationsStatus.classList.toggle("hidden", !accountApplicationsError);
              // 受け取った応募描画
  applicationsContainer.innerHTML = accountApplicationsError
    ? ""
    : receivedApplications.length
      ? receivedApplications.map(application => `
        <article class="bg-white rounded-2xl border border-gray-100 shadow-sm mb-4 transition-all hover:border-blue-200 overflow-hidden">
          <div class="p-5">
            <div class="flex flex-wrap items-start justify-between gap-3 mb-4 pb-4 border-b border-gray-50">
              <div class="min-w-0 flex-1">
                <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">求人: ${escapeHtml(String(application.job_title || "求人"))}</p>
                <h4 class="font-black text-gray-900 text-lg leading-tight">👷 ${escapeHtml(String(application.applicant_name || ""))}</h4>
                <p class="mt-1 text-[10px] text-gray-400 uppercase tracking-widest font-bold">応募日時: ${formatDashboardDate(application.created_at)}</p>
              </div>
              <div class="flex flex-col items-end gap-2 shrink-0">
                <span class="inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${application.status === "withdrawn" ? "bg-rose-100 text-rose-800" : formatApplicationStatusClass(application.status)}">${application.status === "withdrawn" ? "取り下げ" : formatApplicationStatus(application.status)}</span>
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs mb-4 bg-gray-50/80 p-4 rounded-xl border border-gray-100">
              <div class="flex items-center gap-2">
                <span class="text-base">💪</span>
                <div>
                  <p class="text-[9px] font-bold text-gray-400 uppercase leading-none mb-1">現場経験</p>
                  <p class="font-bold text-gray-700">${escapeHtml(String(application.experience || "未登録"))}</p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-base">🔧</span>
                <div>
                  <p class="text-[9px] font-bold text-gray-400 uppercase leading-none mb-1">保有資格</p>
                  <p class="font-bold text-gray-700 truncate">${Array.isArray(application.licenses) && application.licenses.length ? application.licenses.join("、") : "未登録"}</p>
                </div>
              </div>
            </div>
            ${application.message
              ? `<div class="relative bg-white p-4 rounded-xl border border-gray-100 italic text-sm text-gray-700 leading-relaxed">
                  <span class="absolute -top-2 left-4 px-2 bg-gray-50 text-[9px] font-bold text-gray-400 uppercase tracking-widest border border-gray-100 rounded">Message</span>
                  "${escapeHtml(String(application.message))}"
                 </div>`
              : '<p class="text-center py-2 text-[10px] text-gray-300 font-bold uppercase tracking-widest">No Message</p>'}

                            ${application.status === "pending" ? `
              <div class="mt-5 flex gap-3">
                <button type="button" onclick="updateApplicationStatus('${escapeHtml(String(application.id))}', 'reviewed')" class="flex-1 h-11 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100">確認済みにする</button>
                <button type="button" onclick="updateApplicationStatus('${escapeHtml(String(application.id))}', 'dismissed')" class="flex-1 h-11 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-black text-gray-500 hover:bg-gray-50 transition-all">対応不要</button>
              </div>
            ` : application.status === "withdrawn" ? `
              <p class="mt-5 rounded-lg bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800">応募者が応募を取り下げました。</p>
            ` : `
              <div class="mt-5 border-t border-gray-50 pt-4 flex justify-between items-center">
                <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Status: ${formatApplicationStatus(application.status)}</p>
                <button type="button" onclick="openReviewModal('${application.id}', '${application.applicant_id}', 'seeker')" class="px-4 py-2 bg-amber-50 text-amber-600 text-xs font-black rounded-xl border border-amber-100 hover:bg-amber-100 transition-all">
                  ⭐ 職人を評価する
                </button>
              </div>
            `}

          </div>
        </article>
      `).join("")
      : '<div class="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200"><p class="text-xs text-gray-400">受け取った応募はまだありません。</p></div>';


        // 公開プロフィール一覧描画
  if (publicSeekerProfilesUserId === currentUser.id) {
    profilesContainer.innerHTML = publicSeekerProfilesError
      ? `<p class="text-sm text-red-600">${escapeHtml(publicSeekerProfilesError)}</p>`
      : displayProfiles.length
      ? `${employerContactRequestsError ? `<p class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">${escapeHtml(employerContactRequestsError)}</p>` : ""}
      <div class="grid grid-cols-1 gap-4">
      ${displayProfiles.map(profile => {
        const payTypeLabels = { hourly: "時給", daily: "日給", monthly: "月給" };
        const pay = profile.pay_type
          ? `${payTypeLabels[profile.pay_type]}${profile.minimum_salary ? `・希望最低額 ${Number(profile.minimum_salary).toLocaleString("ja-JP")}円` : ""}`
          : "指定なし";
        const licenses = Array.isArray(profile.licenses) && profile.licenses.length
          ? profile.licenses.map(license => escapeHtml(String(license))).join("、")
          : "登録なし";
        const contactRequest = employerContactRequests.find(request => request.seeker_id === profile.user_id);
        return `
          <article class="bg-white rounded-2xl border border-emerald-100 shadow-sm transition-all hover:shadow-md overflow-hidden">
            <div class="p-5">
              <div class="flex items-center gap-4 mb-4 pb-4 border-b border-gray-50">
                <div class="h-14 w-14 shrink-0 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-2xl overflow-hidden">
                  ${profile.avatar_url ? `<img src="${escapeHtml(profile.avatar_url)}" alt="" class="h-full w-full object-cover">` : '👷'}
                </div>
                                                        <div class="min-w-0 flex-1">
                  <p class="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">希望職種</p>
                  <div class="flex items-center gap-2">
                    <h4 class="font-black text-gray-900 text-lg leading-tight truncate">${escapeHtml(String(profile.job_type || "未設定"))}</h4>
                    ${renderRatingBadge(profile.user_id)}
                  </div>
                </div>


              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <div class="flex items-start gap-3">
                  <span class="text-base shrink-0">📍</span>
                  <div>
                    <p class="text-[9px] font-bold text-gray-400 uppercase leading-none mb-1">希望勤務地</p>
                    <p class="font-bold text-gray-700">${escapeHtml(String(profile.location || "未設定"))}</p>
                  </div>
                </div>
                <div class="flex items-start gap-3">
                  <span class="text-base shrink-0">💰</span>
                  <div>
                    <p class="text-[9px] font-bold text-gray-400 uppercase leading-none mb-1">希望給与</p>
                    <p class="font-bold text-gray-700">${escapeHtml(pay)}</p>
                  </div>
                </div>
                <div class="flex items-start gap-3">
                  <span class="text-base shrink-0">🔧</span>
                  <div>
                    <p class="text-[9px] font-bold text-gray-400 uppercase leading-none mb-1">保有資格</p>
                    <p class="font-bold text-gray-700">${licenses}</p>
                  </div>
                </div>
                <div class="flex items-start gap-3">
                  <span class="text-base shrink-0">💪</span>
                  <div>
                    <p class="text-[9px] font-bold text-gray-400 uppercase leading-none mb-1">現場経験 / アピール</p>
                    <p class="font-bold text-gray-700">${escapeHtml(String(profile.exp_years || "未設定"))}・${escapeHtml(String(profile.stamina || "未設定"))}</p>
                  </div>
                </div>
              </div>
              <p class="mt-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">最終更新: ${escapeHtml(formatDashboardDate(profile.updated_at) || "日付不明")}</p>
              <div class="mt-5 border-t border-gray-50 pt-5">
                ${contactRequest
                  ? `<div class="rounded-xl ${contactRequest.status === "responded" ? "bg-emerald-50 border-emerald-100" : "bg-gray-50 border-gray-100"} border p-4">
                      <p class="text-xs font-black ${contactRequest.status === "responded" ? "text-emerald-800" : contactRequest.status === "declined" ? "text-gray-600" : "text-amber-800"} uppercase tracking-wider mb-2">
                        ${contactRequest.status === "responded" ? "✅ 求職者から返信が届いています" : contactRequest.status === "declined" ? "🚫 求職者は連絡を見送りました" : "⏳ 連絡リクエストを送信済み"}
                      </p>
                      ${contactRequest.seeker_reply ? `<p class="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed italic border-l-4 border-emerald-200 pl-3">"${escapeHtml(contactRequest.seeker_reply)}"</p>` : ""}
                      <p class="mt-2 text-[9px] text-gray-400 font-bold uppercase">${formatDashboardDate(contactRequest.created_at)}</p>
                     </div>`
                  : employerContactRequestsError
                    ? ""
                    : `<div>
                        <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">この職人に連絡リクエストを送る</label>
                        <textarea id="contactMessage-${escapeHtml(profile.user_id)}" maxlength="1000" rows="3" class="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all" placeholder="プロフィールを見て連絡した理由や求人の案内を入力"></textarea>
                        <p class="mt-2 text-[10px] text-gray-400 font-medium leading-relaxed">※ 連絡先は共有されません。メッセージは求職者のマイページに届きます。名前を伏せて連絡できます。</p>
                        <button type="button" onclick="sendSeekerContactRequest('${escapeHtml(profile.user_id)}', this)" class="mt-3 w-full h-11 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100">🚀 メッセージを送信する</button>
                        <p id="contactRequestStatus-${escapeHtml(profile.user_id)}" class="mt-3 hidden text-xs font-bold" role="status" aria-live="polite"></p>
                      </div>`
                }
              </div>
            </div>
          </article>
        `;
      }).join("")}
      </div>
      ${filteredPublicProfiles.length > displayLimitProfiles ? `
        <button type="button" onclick="loadMoreProfiles()" class="w-full h-14 mt-6 bg-white border border-emerald-100 text-emerald-700 font-black rounded-2xl hover:bg-emerald-50 transition-all shadow-sm">
          もっとプロフィールを見る (${filteredPublicProfiles.length - displayLimitProfiles}件)
        </button>
      ` : ""}
      `
      : publicSeekerProfiles.length
        ? '<div class="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200"><p class="text-sm text-gray-500 font-bold uppercase tracking-widest">No matching profiles found</p></div>'
        : '<div class="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200"><p class="text-sm text-gray-500 font-bold uppercase tracking-widest">No public profiles available</p></div>';
  } else if (loadingPublicSeekerProfilesUserId !== currentUser.id) {
    profilesContainer.innerHTML = '<div class="flex items-center justify-center py-10"><span class="animate-pulse text-xs font-bold text-gray-400 uppercase tracking-widest">Loading Profiles...</span></div>';
    loadPublicSeekerProfiles(currentUser);
  }

}

    async function loadPublicSeekerProfiles(user) {
  if (!user || currentUser?.id !== user.id || accountType !== "employer" ||
      loadingPublicSeekerProfilesUserId === user.id || publicSeekerProfilesUserId === user.id) return;
  loadingPublicSeekerProfilesUserId = user.id;
  const [profilesResult, requestsResult] = await Promise.all([
    supabaseClient
      .from("seeker_public_profiles")
      .select("user_id, avatar_url, job_type, location, pay_type, minimum_salary, licenses, exp_years, stamina, updated_at"),
    supabaseClient
      .from("seeker_contact_requests")
      .select("*")
      .eq("employer_id", user.id)
      .order("created_at", { ascending: false })
  ]);

  if (currentUser?.id !== user.id || accountType !== "employer") {
    loadingPublicSeekerProfilesUserId = null;
    return;
  }
  loadingPublicSeekerProfilesUserId = null;
  if (profilesResult.error) {
    publicSeekerProfilesError = `公開プロフィールを読み込めませんでした。SQL移行が実行済みか確認してください: ${profilesResult.error.message}`;
    publicSeekerProfilesUserId = user.id;
    renderEmployerDashboard();
    console.error("公開プロフィール読み込みエラー:", profilesResult.error);
    return;
  }
  publicSeekerProfiles = profilesResult.data || [];
  publicSeekerProfilesError = "";
  publicSeekerProfilesUserId = user.id;
  employerContactRequests = requestsResult.data || [];
  employerContactRequestsError = requestsResult.error
    ? `連絡リクエストを確認できません。新しいSQL移行を実行してください: ${requestsResult.error.message}`
    : "";
  if (requestsResult.error) console.error("連絡リクエスト読み込みエラー:", requestsResult.error);
  renderEmployerDashboard();
}

function showEmployerDashboardView(view) {
  const views = ["jobs", "applications", "profiles", "notifications"];
  if (!views.includes(view)) return;

  views.forEach(item => {
    document.getElementById(`employerDashboardView-${item}`).classList.toggle("hidden", item !== view);
  });
  document.querySelectorAll(".employer-dashboard-menu-button").forEach(button => {
    const isActive = button.dataset.employerDashboardView === view;
    button.classList.toggle("bg-blue-600", isActive);
    button.classList.toggle("text-white", isActive);
    button.classList.toggle("bg-gray-200", !isActive);
    button.classList.toggle("text-gray-700", !isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
}

async function sendSeekerContactRequest(seekerId, button) {
  if (!currentUser || accountType !== "employer" ||
      !publicSeekerProfiles.some(profile => profile.user_id === seekerId)) return;
  const employerId = currentUser.id;
  const messageInput = document.getElementById(`contactMessage-${seekerId}`);
  const status = document.getElementById(`contactRequestStatus-${seekerId}`);
  const message = messageInput.value.trim();
  if (!message) {
    status.innerText = "連絡メッセージを入力してください。";
    status.className = "mt-2 text-sm text-red-700";
    messageInput.focus();
    return;
  }

  button.disabled = true;
  const originalText = button.innerText;
  button.innerText = "送信中...";
  const { data, error } = await supabaseClient
    .from("seeker_contact_requests")
    .insert({
      seeker_id: seekerId,
      employer_id: employerId,
      employer_message: message
    })
    .select()
    .single();
  button.disabled = false;
  button.innerText = originalText;
  if (currentUser?.id !== employerId || accountType !== "employer") return;
  if (error) {
    status.innerText = error.code === "23505"
      ? "この求職者にはすでに連絡リクエストを送信しています。画面を再読み込みして状態を確認してください。"
      : `送信できませんでした: ${error.message}`;
    status.className = "mt-2 text-sm text-red-700";
    console.error("連絡リクエスト送信エラー:", error);
    return;
  }
  const emailWarning = await sendNotificationEmail("contact_request", data.id);
  if (currentUser?.id !== employerId || accountType !== "employer") return;
  employerContactRequests.unshift(data);
  renderEmployerDashboard();
  if (emailWarning) alert(emailWarning);
}

function resetEmployerSeekerFilters() {
  displayLimitProfiles = 10;
  document.getElementById("employerSeekerKeyword").value = "";
  document.getElementById("employerSeekerExperience").value = "";
  renderEmployerDashboard();
}
