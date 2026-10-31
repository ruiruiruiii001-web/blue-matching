async function loadAccountData(user) {
      if (!user || currentUser?.id !== user.id || loadingAccountUserId === user.id) return;
      loadingAccountUserId = user.id;
      const userId = user.id;

      const [profileResult, appsResult, favsResult, notifsResult, seekerReqsResult, employerReqsResult, reviewsResult, blocksResult] = await Promise.all([
        supabaseClient.from("seeker_profiles").select("*").eq("user_id", userId).maybeSingle(),
        supabaseClient.from("job_applications").select("*").order("created_at", { ascending: false }),
        supabaseClient.from("job_favorites").select("job_id").eq("user_id", userId),
        supabaseClient.from("app_notifications").select("*").eq("recipient_id", userId).order("created_at", { ascending: false }),
        accountType === "seeker"
          ? supabaseClient.from("seeker_contact_requests").select("*").eq("seeker_id", userId).order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        accountType === "employer"
          ? supabaseClient.from("seeker_contact_requests").select("*").eq("employer_id", userId).order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        supabaseClient.from("job_reviews").select("*").eq("reviewer_id", userId),
        supabaseClient.from("user_blocks").select("blocked_id").eq("blocker_id", userId)
      ]);

      if (currentUser?.id !== userId) {
        loadingAccountUserId = null;
        return;
      }
      loadingAccountUserId = null;

      if (profileResult.data) {
        seekerProfileData = {
          name: profileResult.data.name,
          phone: profileResult.data.phone,
          avatarUrl: profileResult.data.avatar_url,
          jobType: profileResult.data.job_type,
          location: profileResult.data.location,
          payType: profileResult.data.pay_type,
          minimumSalary: profileResult.data.minimum_salary,
          licenses: profileResult.data.licenses,
          expYears: profileResult.data.exp_years,
          experienceDetails: profileResult.data.experience_details || "",
          stamina: profileResult.data.stamina,
          workPreferences: profileResult.data.work_preferences || [],
          isPublic: profileResult.data.is_public
        };
        if (!dashboardOpen) loadSeekerProfile(seekerProfileData);
      }
      accountApplications = appsResult.data || [];
      const messagesResult = accountApplications.length
        ? await supabaseClient
          .from("application_messages")
          .select("*")
          .in("application_id", accountApplications.map(application => application.id))
          .order("created_at", { ascending: true })
        : { data: [], error: null };
      if (currentUser?.id !== userId) {
        loadingAccountUserId = null;
        return;
      }
      applicationMessages = messagesResult.data || [];
      applicationMessagesError = messagesResult.error
        ? `メッセージを読み込めませんでした: ${messagesResult.error.message}`
        : appsResult.error
          ? `応募一覧を読み込めないため、メッセージを表示できません: ${appsResult.error.message}`
          : "";
      accountReviews = reviewsResult.data || [];
      blockedUserIds = (blocksResult.data || []).map(b => b.blocked_id);
      accountApplicationsError = appsResult.error ? `応募履歴を読み込めませんでした: ${appsResult.error.message}` : "";

      favoriteJobIds = (favsResult.data || []).map(f => String(f.job_id));
      appNotifications = (notifsResult.data || []).map(n => ({ ...n, legacy: false }));
      appNotificationsError = notifsResult.error ? `通知を読み込めませんでした: ${notifsResult.error.message}` : "";
      seekerContactRequests = seekerReqsResult.data || [];
      seekerContactRequestsError = seekerReqsResult.error ? `連絡リクエストを読み込めませんでした: ${seekerReqsResult.error.message}` : "";
      employerContactRequests = employerReqsResult.data || [];
      employerContactRequestsError = employerReqsResult.error ? `連絡リクエストの返信を読み込めませんでした: ${employerReqsResult.error.message}` : "";

      accountDataUserId = userId;
      await fetchAvgRatings();
      renderAccountDashboard();
      renderEmployerDashboard();
      renderJobList();
      if (savedSearchesUserId !== userId) loadSavedSearches();
    }

function renderApplicationConversation(application) {
  const canSend = application.status === "reviewed";
  const messages = applicationMessages.filter(message =>
    String(message.application_id) === String(application.id)
  );
  const otherParticipant = accountType === "employer" ? "求職者" : "企業";
  return `
    <section data-application-thread="${escapeHtml(String(application.id))}" class="mt-5 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
      <h5 class="mb-3 text-sm font-bold text-gray-800">メッセージ</h5>
      <div class="space-y-2">
        ${messages.length
          ? messages.map(message => `
            <article class="rounded-lg ${message.sender_id === currentUser?.id ? "bg-blue-100" : "bg-white"} p-3">
              <div class="mb-1 flex items-center justify-between gap-3">
                <span class="text-xs font-bold text-gray-700">${message.sender_id === currentUser?.id ? "あなた" : otherParticipant}</span>
                <time class="text-[10px] text-gray-500">${formatDashboardDate(message.created_at)}</time>
              </div>
              <p class="whitespace-pre-wrap break-words text-sm text-gray-800">${escapeHtml(String(message.body || ""))}</p>
            </article>
          `).join("")
          : '<p class="rounded-lg bg-white p-3 text-xs text-gray-500">まだメッセージはありません。</p>'}
      </div>
      ${canSend
        ? `<label class="mt-3 block text-sm font-medium">メッセージを送る
            <textarea data-application-message-input maxlength="2000" rows="3" class="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" placeholder="応募に関する連絡を入力（2,000文字以内）"></textarea>
          </label>
          <p class="mt-1 text-xs text-gray-600">電話番号・メールアドレスなどの連絡先は入力しないでください。</p>
          <button type="button" onclick="sendApplicationMessage('${escapeHtml(String(application.id))}', this)" class="mt-3 min-h-11 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">メッセージを送信</button>
          <p data-application-message-status role="status" aria-live="polite" class="mt-2 hidden text-sm"></p>`
        : `<p class="mt-3 text-xs text-gray-600">${application.status === "pending"
          ? "企業が応募を確認済みにすると、メッセージを送信できます。"
          : "この応募は終了しているため、メッセージを送信できません。"}</p>`}
    </section>
  `;
}

async function sendApplicationMessage(applicationId, button) {
  if (!currentUser || !["seeker", "employer"].includes(accountType)) return;
  const userId = currentUser.id;
  const application = accountApplications.find(item =>
    String(item.id) === String(applicationId) &&
    (accountType === "seeker"
      ? item.applicant_id === userId
      : cachedJobs.some(job => job.owner_id === userId && String(job.id) === String(item.job_id)))
  );
  if (!application || application.status !== "reviewed") return;

  const thread = button.closest("[data-application-thread]");
  const input = thread?.querySelector("[data-application-message-input]");
  const status = thread?.querySelector("[data-application-message-status]");
  if (!input || !status) return;
  const body = input.value.trim();
  if (!body) {
    status.innerText = "メッセージを入力してください。";
    status.className = "mt-2 text-sm text-red-700";
    input.focus();
    return;
  }
  if (body.length > 2000) {
    status.innerText = "メッセージは2,000文字以内で入力してください。";
    status.className = "mt-2 text-sm text-red-700";
    input.focus();
    return;
  }

  button.disabled = true;
  button.innerText = "送信中...";
  const { data, error } = await supabaseClient
    .from("application_messages")
    .insert({
      application_id: application.id,
      sender_id: userId,
      body
    })
    .select("*")
    .single();
  if (currentUser?.id !== userId || accountType !== (application.applicant_id === userId ? "seeker" : "employer")) return;
  button.disabled = false;
  button.innerText = "メッセージを送信";
  if (error) {
    console.error("応募メッセージ送信エラー:", error);
    status.innerText = `メッセージを送信できませんでした: ${error.message}`;
    status.className = "mt-2 text-sm text-red-700";
    return;
  }

  applicationMessages.push(data);
  input.value = "";
  status.innerText = "メッセージを送信しました。";
  status.className = "mt-2 text-sm text-emerald-700";
  renderAccountDashboard();
  renderEmployerDashboard();
  refreshApplicationNotificationView(application.id, "メッセージを送信しました。");
}

async function updateApplicationStatus(applicationId, status, dismissalReason = "") {
  if (!currentUser || accountType !== "employer" || !["pending", "reviewed", "dismissed"].includes(status)) return;
  const reason = typeof dismissalReason === "string" ? dismissalReason.trim() : "";
  if (status === "dismissed" && (!reason || reason.length > 500)) {
    alert("対応不要の理由を1〜500文字で入力してください。");
    return;
  }
  if (status !== "dismissed" && dismissalReason) return;
  const employerId = currentUser.id;
  const update = { status };
  if (status === "dismissed") update.dismissal_reason = reason;
  const { data, error } = await supabaseClient
    .from("job_applications")
    .update(update)
    .eq("id", applicationId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (currentUser?.id !== employerId || accountType !== "employer") return;
  if (error) {
    alert(`応募状況を更新できませんでした: ${error.message}`);
    return;
  }
  if (!data) {
    alert("応募状況がすでに更新されているため、変更できませんでした。画面を再読み込みしてください。");
    await loadAccountData(currentUser);
    return;
  }

  const notificationWarning = status === "reviewed"
    ? await sendNotificationEmail("application_reviewed", applicationId)
    : "";
  if (currentUser?.id !== employerId || accountType !== "employer") return;
  await loadAccountData(currentUser);
  refreshApplicationNotificationView(applicationId);
  if (notificationWarning) {
    alert(notificationWarning);
  }
}

async function withdrawApplication(applicationId) {
  if (!currentUser || accountType !== "seeker") return;
  const application = accountApplications.find(item =>
    String(item.id) === String(applicationId) &&
    item.applicant_id === currentUser.id &&
    item.status === "pending"
  );
  if (!application) return;
  if (!confirm(`「${application.job_title}」への応募を取り消しますか？応募履歴とメッセージも削除され、元に戻せません。`)) return;

  const applicantId = currentUser.id;
  const statusElement = document.getElementById("dashboardApplicationsStatus");
  const { data, error } = await supabaseClient
    .from("job_applications")
    .delete()
    .eq("id", application.id)
    .eq("applicant_id", applicantId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (currentUser?.id !== applicantId || accountType !== "seeker") return;
  if (error) {
    console.error("応募取り下げエラー:", error);
    statusElement.innerText = `応募を削除できませんでした: ${error.message}`;
    statusElement.className = "mb-3 text-sm text-red-700";
    return;
  }
  if (!data) {
    statusElement.innerText = "応募状況が更新されているため、削除できませんでした。画面を再読み込みしてください。";
    statusElement.className = "mb-3 text-sm text-red-700";
    return;
  }

  accountApplications = accountApplications.filter(item => item.id !== data.id);
  applicationMessages = applicationMessages.filter(message =>
    String(message.application_id) !== String(data.id)
  );
  appNotifications = appNotifications.filter(notification =>
    String(notification.related_id) !== String(data.id) &&
    String(notification.context_id) !== String(data.id)
  );
  statusElement.innerText = "応募を取り消し、応募履歴と会話から削除しました。";
  statusElement.className = "mb-3 text-sm text-emerald-700";
  closeApplicationNotification();
  renderAccountDashboard();
  renderEmployerDashboard();
}
