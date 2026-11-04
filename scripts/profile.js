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
  const availableDates = [...new Set(
    Array.from(document.querySelectorAll("#seekerAvailableDates [data-available-date]"))
      .map(item => item.dataset.availableDate)
  )].sort();
  if (availableDates.length > 60 || availableDates.some(date =>
    !formatWorkDate(date) || date < getLocalDateISO()
  )) {
    alert("働ける日は今日以降の日付を60日分まで登録できます。");
    return;
  }
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
    available_dates: profile.availableDates,
    is_public: isPublic,
    updated_at: new Date().toISOString()
  };
  let profileResult = await supabaseClient
    .from("seeker_profiles")
    .upsert(profileRow, { onConflict: "user_id" });

  if (isMissingAvailabilityColumnError(profileResult.error)) {
    delete profileRow.available_dates;
    profileResult = await supabaseClient
      .from("seeker_profiles")
      .upsert(profileRow, { onConflict: "user_id" });
    if (!profileResult.error) {
      alert("プロフィールは保存しました。働ける日を保存するにはREADME記載の 20261116_add_seeker_availability_dates.sql をSupabaseで実行してください。");
    }
  }
  if (profileResult.error) {
    alert(`プロフィールを保存できませんでした: ${profileResult.error.message}`);
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
  if (!Object.prototype.hasOwnProperty.call(profileRow, "available_dates")) {
    delete publicProfileRow.available_dates;
  }
  const publicProfileResult = isPublic
    ? await supabaseClient.from("seeker_public_profiles").upsert(publicProfileRow, { onConflict: "user_id" })
    : { error: null };
  if (publicProfileResult.error) {
    alert(`プロフィール本体は保存しましたが、公開設定を更新できませんでした: ${publicProfileResult.error.message}`);
    return;
  }

  seekerProfileData = profile;
  seekerProfileData.isPublic = isPublic;
  applySeekerSalaryPreferences(profile);
  const profileSavedMessage = document.getElementById("profileSavedMessage");
  profileSavedMessage.innerText = Object.prototype.hasOwnProperty.call(profileRow, "available_dates")
    ? "👍 プロフィールと働ける日を保存しました。"
    : "👍 プロフィールを保存しました。空き日の保存・検索はデータベース移行後に使えます。";
  profileSavedMessage.classList.remove("hidden");
  accountDataUserId = currentUser.id;
  renderAccountDashboard();
  renderJobList();
}

function isMissingAvailabilityColumnError(error) {
  return ["42703", "PGRST204"].includes(error?.code) &&
    String(error.message || "").includes("available_dates");
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
  setSeekerAvailableDates(profile.availableDates || []);

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
  setSeekerAvailableDates([]);
  document.getElementById("profileSavedMessage").classList.add("hidden");
  applySeekerSalaryPreferences({});
  updateSelectionDetails("seekerJobTypeOption");
  updateSelectionDetails("seekerLic");
}

function initializeSeekerAvailabilityControls() {
  const dateInput = document.getElementById("seekerAvailableDate");
  if (dateInput) {
    dateInput.min = getLocalDateISO();
    dateInput.value = getLocalDateISO();
  }
  const searchDate = document.getElementById("seekerSearchAvailabilityDate");
  if (searchDate) {
    searchDate.min = getLocalDateISO();
    searchDate.value = getLocalDateISO();
  }
}

function addSeekerAvailableDate() {
  const dateInput = document.getElementById("seekerAvailableDate");
  const date = dateInput.value;
  if (!formatWorkDate(date) || date < getLocalDateISO()) {
    alert("今日以降の日付を選択してください。");
    return;
  }
  const selectedDates = Array.from(
    document.querySelectorAll("#seekerAvailableDates [data-available-date]")
  ).map(item => item.dataset.availableDate);
  if (selectedDates.includes(date)) return;
  if (selectedDates.length >= 60) {
    alert("働ける日は60日分まで登録できます。");
    return;
  }
  setSeekerAvailableDates([...selectedDates, date]);
}

function setSeekerAvailableDates(values) {
  const container = document.getElementById("seekerAvailableDates");
  if (!container) return;
  const today = getLocalDateISO();
  const dates = [...new Set(Array.isArray(values) ? values : [])]
    .filter(date => formatWorkDate(date) && date >= today)
    .sort();
  container.replaceChildren();
  dates.forEach(date => {
    const item = document.createElement("span");
    item.dataset.availableDate = date;
    item.className = "inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-900";
    const label = document.createElement("span");
    label.textContent = formatWorkDate(date);
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "rounded-full px-1 text-emerald-700 hover:bg-emerald-100";
    removeButton.setAttribute("aria-label", `${formatWorkDate(date)}を削除`);
    removeButton.textContent = "×";
    removeButton.addEventListener("click", () => {
      setSeekerAvailableDates(dates.filter(value => value !== date));
    });
    item.append(label, removeButton);
    container.append(item);
  });
  if (!dates.length) {
    const empty = document.createElement("span");
    empty.className = "text-xs text-gray-500";
    empty.textContent = "登録された日付はありません。";
    container.append(empty);
  }
}

function applySeekerSalaryPreferences(profile) {
  document.getElementById("salaryTypeFilter").value = profile.payType || "";
  document.getElementById("minimumSalary").value = profile.minimumSalary ?? "";
}
