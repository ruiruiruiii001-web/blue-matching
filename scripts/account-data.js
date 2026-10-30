async function loadAccountData(user) {
      if (!user || currentUser?.id !== user.id || loadingAccountUserId === user.id) return;
      loadingAccountUserId = user.id;
      const userId = user.id;

      const [profileResult, appsResult, favsResult, notifsResult, seekerReqsResult, reviewsResult, blocksResult] = await Promise.all([
        supabaseClient.from("seeker_profiles").select("*").eq("user_id", userId).maybeSingle(),
        supabaseClient.from("job_applications").select("*").order("created_at", { ascending: false }),
        supabaseClient.from("job_favorites").select("job_id").eq("user_id", userId),
        supabaseClient.from("app_notifications").select("*").eq("recipient_id", userId).order("created_at", { ascending: false }),
        accountType === "seeker"
          ? supabaseClient.from("seeker_contact_requests").select("*").eq("seeker_id", userId).order("created_at", { ascending: false })
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
          stamina: profileResult.data.stamina,
          isPublic: profileResult.data.is_public
        };
        if (!dashboardOpen) loadSeekerProfile(seekerProfileData);
      }
      accountApplications = appsResult.data || [];
      accountReviews = reviewsResult.data || [];
      blockedUserIds = (blocksResult.data || []).map(b => b.blocked_id);
      accountApplicationsError = appsResult.error ? `応募履歴を読み込めませんでした: ${appsResult.error.message}` : "";

      favoriteJobIds = (favsResult.data || []).map(f => String(f.job_id));
      appNotifications = (notifsResult.data || []).map(n => ({ ...n, legacy: false }));
      appNotificationsError = notifsResult.error ? `通知を読み込めませんでした: ${notifsResult.error.message}` : "";
      seekerContactRequests = seekerReqsResult.data || [];
      seekerContactRequestsError = seekerReqsResult.error ? `連絡リクエストを読み込めませんでした: ${seekerReqsResult.error.message}` : "";

      accountDataUserId = userId;
      await fetchAvgRatings();
      renderAccountDashboard();
      renderEmployerDashboard();
      renderJobList();
    }

async function updateApplicationStatus(applicationId, status) {
  if (!currentUser || accountType !== "employer" || !["pending", "reviewed", "dismissed"].includes(status)) return;
  const employerId = currentUser.id;
  const { error } = await supabaseClient
    .from("job_applications")
    .update({ status })
    .eq("id", applicationId);
  if (currentUser?.id !== employerId || accountType !== "employer") return;
  if (error) {
    alert(`応募状況を更新できませんでした: ${error.message}`);
    return;
  }

  // 状態が変更されたら求職者に通知（非同期で実行）
  if (status === 'reviewed') {
    sendNotificationEmail("application_reviewed", applicationId);
  }

  await loadAccountData(currentUser);
}
