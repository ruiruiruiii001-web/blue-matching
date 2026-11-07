let seekerAvailabilityResetTimer = null;
let seekerAvailabilityChoice = false;
const SEEKER_AVAILABILITY_NEVER_PROMPT_KEY = "blueMatchingAvailabilityNeverPrompt";
const SEEKER_AVAILABILITY_LEGACY_DAILY_PROMPT_KEY = "blueMatchingAvailabilityDailyPrompt";
const SEEKER_AVAILABILITY_LAST_PROMPTED_KEY = "blueMatchingAvailabilityLastPrompted";

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
    ...(!PILOT_MODE && { available_dates: profile.availableDates }),
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
  syncSeekerAvailabilityControl();
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

  const status = document.getElementById("seekerAvailabilityStatus");
  const availableDates = seekerAvailabilityChoice ? [getLocalDateISO()] : [];
  status.className = "mt-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600";
  status.innerText = "保存しています...";

  const { data, error } = await supabaseClient
    .from("seeker_profiles")
    .update({ available_dates: availableDates, updated_at: new Date().toISOString() })
    .eq("user_id", currentUser.id)
    .select("is_public")
    .maybeSingle();

  if (isMissingAvailabilityColumnError(error)) {
    status.className = "mt-3 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-amber-800";
    status.innerText = "この機能を使うには、README記載の20261116_add_seeker_availability_dates.sqlをSupabaseで実行してください。";
    return;
  }
  if (error) {
    status.className = "mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-red-700";
    status.innerText = `今日の状況を保存できませんでした: ${error.message}`;
    console.error("今日の働ける状況を保存できませんでした:", error);
    return;
  }
  if (!data) {
    status.className = "mt-3 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-amber-800";
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
      status.className = "mt-3 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-amber-800";
      status.innerText = isMissingAvailabilityColumnError(publicError)
        ? "状況は保存しましたが、掲載者の検索に表示するにはデータベース移行が必要です。"
        : `状況は保存しましたが、公開プロフィールを更新できませんでした: ${publicError.message}`;
      console.error("今日の働ける状況を公開プロフィールへ反映できませんでした:", publicError);
      seekerProfileData = { ...seekerProfileData, availableDates, isPublic: true };
      return;
    }
  }

  seekerProfileData = { ...seekerProfileData, availableDates, isPublic: data.is_public };
  status.className = "mt-3 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-bold text-emerald-800";
  status.innerText = data.is_public
    ? seekerAvailabilityChoice ? "保存しました。掲載者の「今日働ける人」検索に表示されます。" : "保存しました。今日は検索結果に表示されません。"
    : "保存しました。プロフィール公開に同意した場合だけ、掲載者の検索に表示されます。";
}

function syncSeekerAvailabilityControl() {
  if (PILOT_MODE) {
    document.getElementById("seekerAvailabilityLauncher")?.classList.add("hidden");
    return;
  }
  const availableToday = Boolean(
    Array.isArray(seekerProfileData?.availableDates) &&
    seekerProfileData.availableDates.includes(getLocalDateISO())
  );
  setSeekerAvailabilityChoice(availableToday);
  const dailyPromptCheckbox = document.getElementById("seekerAvailabilityDailyPrompt");
  if (dailyPromptCheckbox) dailyPromptCheckbox.checked = getSeekerAvailabilityNeverPrompt();
  const launcher = document.getElementById("seekerAvailabilityLauncher");
  if (launcher) launcher.classList.toggle("hidden", !currentUser || accountType !== "seeker");

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
    if (seekerProfileData && !getSeekerAvailabilityNeverPrompt()) {
      const lastPromptedKey = `${SEEKER_AVAILABILITY_LAST_PROMPTED_KEY}:${currentUser.id}`;
      try {
        if (localStorage.getItem(lastPromptedKey) !== getLocalDateISO()) {
          localStorage.setItem(lastPromptedKey, getLocalDateISO());
          showSeekerAvailabilityDialog();
        }
      } catch (error) {
        console.error("今日の状況の確認日を保存できませんでした:", error);
      }
    }
  }
}

function getSeekerAvailabilityNeverPrompt() {
  try {
    const savedPreference = localStorage.getItem(SEEKER_AVAILABILITY_NEVER_PROMPT_KEY);
    if (savedPreference !== null) return savedPreference === "1";

    const legacyPreference = localStorage.getItem(SEEKER_AVAILABILITY_LEGACY_DAILY_PROMPT_KEY);
    const neverPrompt = legacyPreference === "0";
    if (legacyPreference !== null) {
      localStorage.setItem(SEEKER_AVAILABILITY_NEVER_PROMPT_KEY, neverPrompt ? "1" : "0");
    }
    return neverPrompt;
  } catch (error) {
    console.error("今日の状況の確認設定を読み込めませんでした:", error);
    return false;
  }
}

function setSeekerAvailabilityNeverPrompt(neverPrompt) {
  const status = document.getElementById("seekerAvailabilityStatus");
  try {
    localStorage.setItem(SEEKER_AVAILABILITY_NEVER_PROMPT_KEY, neverPrompt ? "1" : "0");
    if (status) {
      status.className = "mt-3 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-emerald-800";
      status.innerText = neverPrompt
        ? "今後、自動では表示しません。必要なときは画面右下のボタンから設定できます。"
        : "今日の状況を1日1回、自動で確認します。";
    }
  } catch (error) {
    console.error("今日の状況の確認設定を保存できませんでした:", error);
    if (status) {
      status.className = "mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-red-700";
      status.innerText = "確認設定を保存できませんでした。このブラウザーの保存領域を確認してください。";
    }
  }
}

function setSeekerAvailabilityChoice(available) {
  seekerAvailabilityChoice = available;
  const yesButton = document.getElementById("seekerAvailabilityYes");
  const noButton = document.getElementById("seekerAvailabilityNo");
  if (!yesButton || !noButton) return;
  yesButton.setAttribute("aria-pressed", String(available));
  noButton.setAttribute("aria-pressed", String(!available));
  yesButton.className = available
    ? "min-h-14 rounded-xl border-2 border-emerald-700 bg-emerald-700 px-3 py-3 text-base font-bold text-white hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
    : "min-h-14 rounded-xl border-2 border-emerald-700 bg-white px-3 py-3 text-base font-bold text-emerald-900 hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700";
  noButton.className = !available
    ? "min-h-14 rounded-xl border-2 border-gray-700 bg-gray-700 px-3 py-3 text-base font-bold text-white hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-700"
    : "min-h-14 rounded-xl border-2 border-gray-300 bg-white px-3 py-3 text-base font-bold text-gray-800 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-700";
}

function showSeekerAvailabilityDialog() {
  const dialog = document.getElementById("seekerAvailabilityDialog");
  if (!dialog) return;
  dialog.classList.remove("hidden");
  dialog.classList.add("flex");
  document.getElementById("seekerAvailabilityYes")?.focus();
}

function openSeekerAvailabilityDialog() {
  if (!currentUser || accountType !== "seeker") return;
  syncSeekerAvailabilityControl();
  showSeekerAvailabilityDialog();
}

function closeSeekerAvailabilityDialog() {
  const dialog = document.getElementById("seekerAvailabilityDialog");
  if (!dialog) return;
  dialog.classList.add("hidden");
  dialog.classList.remove("flex");
  document.getElementById("seekerAvailabilityLauncher")?.focus();
}

function loadSeekerProfile(profile) {
  if (!profile) return;
  document.getElementById("seekerName").value = profile.name || "";
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
