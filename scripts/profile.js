let seekerAvailabilityResetTimer = null;

async function saveSeekerProfile() {
  if (!currentUser || accountType !== "seeker") {
    promptLogin("プロフィールを保存するにはお仕事探しアカウントでログインしてください。");
    return;
  }

  const selectedJobTypes = getCheckedValues("seekerJobTypeOption");
  const otherJobTypes = document.getElementById("seekerJobType").value
    .split(/[,、，]/)
    .map(value => value.trim())
    .filter(Boolean);
  const jobType = [...new Set([...selectedJobTypes, ...otherJobTypes])].join("、");
  const selectedLicenses = getCheckedValues("seekerLic");
  const otherLicenses = document.getElementById("seekerOtherLicenses").value
    .split(/[,、，]/)
    .map(value => value.trim())
    .filter(Boolean);
  const checkedLic = [...new Set([...selectedLicenses, ...otherLicenses])];
  const workPreferences = getCheckedValues("seekerWorkPreference");
  const today = getLocalDateISO();
  const availableDates = seekerProfileData?.availableDates?.includes(today) ? [today] : [];
  const preferredPayType = document.getElementById("seekerPayType").value;
  const minimumSalaryValue = document.getElementById("seekerMinimumSalary").value;
  const preferredMinimumSalary = minimumSalaryValue ? Number(minimumSalaryValue) : null;

  if (preferredMinimumSalary !== null &&
      (!Number.isFinite(preferredMinimumSalary) || preferredMinimumSalary <= 0 || !preferredPayType)) {
    alert("希望最低額を入力する場合は、給与区分も選択してください。");
    return;
  }

  const profile = {
    name: document.getElementById("seekerName").value.trim(),
    phone: normalizeJapanesePhone(document.getElementById("seekerPhone").value.trim()),
    avatarUrl: document.getElementById("seekerAvatarUrl").value.trim(),
    jobType,
    location: getLocationPreferencesFromForm(),
    payType: preferredPayType,
    minimumSalary: preferredMinimumSalary,
    licenses: checkedLic,
    expYears: document.getElementById("seekerExpYears").value,
    experienceDetails: document.getElementById("seekerExperienceDetails").value.trim(),
    stamina: document.getElementById("seekerStamina").value,
    workPreferences,
    availableDates
  };


  if (!profile.name) {
    alert("お名前を入力してください。");
    return;
  }
  if (profile.phone && !isValidJapanesePhone(profile.phone)) {
    alert("電話番号は日本の電話番号を入力してください（例: 09012345678）。");
    return;
  }
  if (profile.location.length > 500) {
    alert("希望勤務地は全体で500文字以内にしてください。");
    return;
  }

  const isPublic = document.getElementById("seekerProfilePublic").checked;
  if (!isPublic) {
    const { error: unpublishError } = await supabaseClient
      .from("seeker_public_profiles")
      .delete()
      .eq("user_id", currentUser.id);
    if (unpublishError) {
      alert(`公開プロフィールを非公開にできませんでした: ${unpublishError.message}`);
      return;
    }
  }

  const profileRow = {
    user_id: currentUser.id,
    name: profile.name,
    phone: profile.phone || null,
    avatar_url: profile.avatarUrl || null,
    job_type: profile.jobType,
    location: profile.location,
    pay_type: profile.payType || null,
    minimum_salary: profile.minimumSalary,
    licenses: profile.licenses,
    exp_years: profile.expYears,
    experience_details: profile.experienceDetails,
    stamina: profile.stamina,
    work_preferences: profile.workPreferences,
    is_public: isPublic,
    updated_at: new Date().toISOString()
  };
  const { error: profileError } = await supabaseClient
    .from("seeker_profiles")
    .upsert(profileRow, { onConflict: "user_id" });
  if (profileError) {
    alert(`プロフィールを保存できませんでした: ${profileError.message}`);
    return;
  }

  const publicProfileRow = {
    user_id: currentUser.id,
    job_type: profile.jobType,
    location: profile.location,
    pay_type: profile.payType || null,
    minimum_salary: profile.minimumSalary,
    licenses: profile.licenses,
    exp_years: profile.expYears,
    experience_details: profile.experienceDetails,
    stamina: profile.stamina,
    work_preferences: profile.workPreferences,
    available_dates: profile.availableDates,
    updated_at: new Date().toISOString()
  };
  let publicProfileResult = isPublic
    ? await supabaseClient.from("seeker_public_profiles").upsert(publicProfileRow, { onConflict: "user_id" })
    : { error: null };
  let availabilityMigrationMissing = false;
  if (isMissingAvailabilityColumnError(publicProfileResult.error)) {
    availabilityMigrationMissing = true;
    delete publicProfileRow.available_dates;
    publicProfileResult = await supabaseClient
      .from("seeker_public_profiles")
      .upsert(publicProfileRow, { onConflict: "user_id" });
  }
  if (publicProfileResult.error) {
    alert(`プロフィール本体は保存しましたが、公開設定を更新できませんでした: ${publicProfileResult.error.message}`);
    return;
  }

  seekerProfileData = profile;
  seekerProfileData.isPublic = isPublic;
  applySeekerSalaryPreferences(profile);
  const profileSavedMessage = document.getElementById("profileSavedMessage");
  profileSavedMessage.innerText = availabilityMigrationMissing
    ? "👍 プロフィールを保存しました。今日の働ける状況を公開するには、データベース移行を実行してください。"
    : "👍 プロフィールを保存しました。";
  profileSavedMessage.classList.remove("hidden");
  accountDataUserId = currentUser.id;
  renderAccountDashboard();
  renderJobList();
}

function isMissingAvailabilityColumnError(error) {
  return ["42703", "PGRST204"].includes(error?.code) &&
    String(error.message || "").includes("available_dates");
}

async function saveSeekerAvailability() {
  if (!currentUser || accountType !== "seeker") {
    promptLogin("今日の働ける状況を保存するには、お仕事探しアカウントでログインしてください。");
    return;
  }

  const checkbox = document.getElementById("seekerAvailableToday");
  const status = document.getElementById("seekerAvailabilityStatus");
  const availableDates = checkbox.checked ? [getLocalDateISO()] : [];
  status.className = "mt-3 text-sm text-gray-600";
  status.innerText = "保存しています...";

  const { data, error } = await supabaseClient
    .from("seeker_profiles")
    .update({ available_dates: availableDates, updated_at: new Date().toISOString() })
    .eq("user_id", currentUser.id)
    .select("is_public")
    .maybeSingle();

  if (isMissingAvailabilityColumnError(error)) {
    status.className = "mt-3 text-sm text-amber-800";
    status.innerText = "この機能を使うには、README記載の20261116_add_seeker_availability_dates.sqlをSupabaseで実行してください。";
    return;
  }
  if (error) {
    status.className = "mt-3 text-sm text-red-700";
    status.innerText = `今日の状況を保存できませんでした: ${error.message}`;
    console.error("今日の働ける状況を保存できませんでした:", error);
    return;
  }
  if (!data) {
    status.className = "mt-3 text-sm text-amber-800";
    status.innerText = "先にプロフィールを保存してください。";
    return;
  }

  if (data.is_public) {
    const { error: publicError } = await supabaseClient
      .from("seeker_public_profiles")
      .upsert({
        user_id: currentUser.id,
        available_dates: availableDates,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });
    if (publicError) {
      status.className = "mt-3 text-sm text-amber-800";
      status.innerText = isMissingAvailabilityColumnError(publicError)
        ? "状況は保存しましたが、掲載者の検索に表示するにはデータベース移行が必要です。"
        : `状況は保存しましたが、公開プロフィールを更新できませんでした: ${publicError.message}`;
      console.error("今日の働ける状況を公開プロフィールへ反映できませんでした:", publicError);
      seekerProfileData = { ...seekerProfileData, availableDates, isPublic: true };
      return;
    }
  }

  seekerProfileData = { ...seekerProfileData, availableDates, isPublic: data.is_public };
  status.className = "mt-3 text-sm text-emerald-800";
  status.innerText = data.is_public
    ? checkbox.checked ? "保存しました。掲載者の「今日働ける人」検索に表示されます。" : "保存しました。今日は検索結果に表示されません。"
    : "保存しました。プロフィール公開に同意した場合だけ、掲載者の検索に表示されます。";
}

function syncSeekerAvailabilityControl() {
  const checkbox = document.getElementById("seekerAvailableToday");
  if (!checkbox) return;
  checkbox.checked = Boolean(
    Array.isArray(seekerProfileData?.availableDates) &&
    seekerProfileData.availableDates.includes(getLocalDateISO())
  );
  const status = document.getElementById("seekerAvailabilityStatus");
  if (status) {
    status.innerText = "";
    status.className = "mt-3 hidden text-sm";
  }

  if (seekerAvailabilityResetTimer !== null) {
    clearTimeout(seekerAvailabilityResetTimer);
    seekerAvailabilityResetTimer = null;
  }
  if (currentUser && accountType === "seeker") {
    const now = new Date();
    const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    seekerAvailabilityResetTimer = setTimeout(() => {
      seekerAvailabilityResetTimer = null;
      syncSeekerAvailabilityControl();
    }, nextDay.getTime() - now.getTime() + 10);
  }
}

function loadSeekerProfile(profile) {
  if (!profile) return;
  document.getElementById("seekerName").value = profile.name || "";
  document.getElementById("seekerPhone").value = profile.phone || "";
  document.getElementById("seekerAvatarUrl").value = profile.avatarUrl || "";
  const jobTypes = String(profile.jobType || "").split(/[,、，]/).map(value => value.trim()).filter(Boolean);
  setCheckedValues("seekerJobTypeOption", jobTypes.filter(value => JOB_TYPE_OPTIONS.includes(value)));
  document.getElementById("seekerJobType").value = jobTypes
    .filter(value => !JOB_TYPE_OPTIONS.includes(value))
    .join("、");

  setLocationPreferences(profile.location || "");
  const payTypeSelect = document.getElementById("seekerPayType");
  if (profile.payType === "monthly" && !Array.from(payTypeSelect.options).some(option => option.value === "monthly")) {
    const legacyMonthlyOption = new Option("月給（既存プロフィール）", "monthly");
    legacyMonthlyOption.dataset.legacy = "true";
    payTypeSelect.add(legacyMonthlyOption);
  }
  payTypeSelect.value = profile.payType || "";
  document.getElementById("seekerMinimumSalary").value = profile.minimumSalary ?? "";
  setCheckedValues("seekerWorkPreference", profile.workPreferences);
  applySeekerSalaryPreferences(profile);
  document.getElementById("seekerExpYears").value = profile.expYears || "未経験（やる気あり）";
  document.getElementById("seekerExperienceDetails").value = profile.experienceDetails || "";
  const stamina = profile.stamina === "★★★★★ (自信あり)"
    ? "★★★★★ (とても自信あり)"
    : profile.stamina || "";
  document.getElementById("seekerStamina").value = stamina;
  document.getElementById("seekerProfilePublic").checked = Boolean(profile.isPublic);

  const licenses = Array.isArray(profile.licenses) ? profile.licenses : [];
  setCheckedValues("seekerLic", licenses.filter(value => LICENSE_OPTIONS.includes(value)));
  document.getElementById("seekerOtherLicenses").value = licenses
    .filter(value => !LICENSE_OPTIONS.includes(value))
    .join("、");
  updateSelectionDetails("seekerJobTypeOption");
  updateSelectionDetails("seekerLic");
}

    function clearSeekerProfileForm() {
  seekerProfileData = null;
  document.getElementById("seekerName").value = "";
  document.getElementById("seekerPhone").value = "";
  document.getElementById("seekerAvatarUrl").value = "";
  document.getElementById("seekerJobType").value = "";
  setCheckedValues("seekerJobTypeOption", []);
  document.getElementById("seekerOtherLicenses").value = "";

  setLocationPreferences("");
  const payTypeSelect = document.getElementById("seekerPayType");
  const legacyMonthlyOption = payTypeSelect.querySelector('option[data-legacy="true"]');
  if (legacyMonthlyOption) legacyMonthlyOption.remove();
  payTypeSelect.value = "";
  document.getElementById("seekerMinimumSalary").value = "";
  setCheckedValues("seekerLic", []);
  setCheckedValues("seekerWorkPreference", []);
  document.getElementById("seekerExpYears").value = "未経験（やる気あり）";
  document.getElementById("seekerExperienceDetails").value = "";
  document.getElementById("seekerStamina").value = "";
  document.getElementById("seekerProfilePublic").checked = false;
  syncSeekerAvailabilityControl();
  document.getElementById("profileSavedMessage").classList.add("hidden");
  applySeekerSalaryPreferences({});
  updateSelectionDetails("seekerJobTypeOption");
  updateSelectionDetails("seekerLic");
}

function applySeekerSalaryPreferences(profile) {
  document.getElementById("salaryTypeFilter").value = profile.payType || "";
  document.getElementById("minimumSalary").value = profile.minimumSalary ?? "";
}
