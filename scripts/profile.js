async function saveSeekerProfile() {
  if (!currentUser || accountType !== "seeker") {
    promptLogin("プロフィールを保存するには求職者アカウントでログインしてください。");
    return;
  }

  const checkedLic = Array.from(document.querySelectorAll('input[name="seekerLic"]:checked')).map(cb => cb.value);
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
    jobType: document.getElementById("seekerJobType").value.trim(),
    location: document.getElementById("seekerLocation").value.trim(),
    payType: preferredPayType,
    minimumSalary: preferredMinimumSalary,
    licenses: checkedLic,
    expYears: document.getElementById("seekerExpYears").value,
    stamina: document.getElementById("seekerStamina").value
  };


  if (!profile.name) {
    alert("お名前を入力してください。");
    return;
  }
  if (profile.phone && !isValidJapanesePhone(profile.phone)) {
    alert("電話番号は日本の電話番号を入力してください（例: 09012345678）。");
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

        const { error } = await supabaseClient
    .from("seeker_profiles")
    .upsert({
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
      stamina: profile.stamina,
      is_public: isPublic,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });

  if (error) {
    alert(`プロフィールを保存できませんでした: ${error.message}`);
    return;
  }

        const publicProfileResult = isPublic
    ? await supabaseClient.from("seeker_public_profiles").upsert({
      user_id: currentUser.id,
      job_type: profile.jobType,
      location: profile.location,
      pay_type: profile.payType || null,
      minimum_salary: profile.minimumSalary,
      licenses: profile.licenses,
      exp_years: profile.expYears,
      stamina: profile.stamina,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" })

    : { error: null };
  if (publicProfileResult.error) {
    alert(`プロフィール本体は保存しましたが、公開設定を更新できませんでした: ${publicProfileResult.error.message}`);
    return;
  }

  seekerProfileData = profile;
  seekerProfileData.isPublic = isPublic;
  applySeekerSalaryPreferences(profile);
  document.getElementById("profileSavedMessage").classList.remove("hidden");
  accountDataUserId = currentUser.id;
  renderAccountDashboard();
  renderJobList();
}

    function loadSeekerProfile(profile) {
  if (!profile) return;
  document.getElementById("seekerName").value = profile.name || "";
  document.getElementById("seekerPhone").value = profile.phone || "";
  document.getElementById("seekerAvatarUrl").value = profile.avatarUrl || "";
  document.getElementById("seekerJobType").value = profile.jobType || "";

  document.getElementById("seekerLocation").value = profile.location || "";
  document.getElementById("seekerPayType").value = profile.payType || "";
  document.getElementById("seekerMinimumSalary").value = profile.minimumSalary ?? "";
  applySeekerSalaryPreferences(profile);
  document.getElementById("seekerExpYears").value = profile.expYears || "未経験（やる気あり）";
  document.getElementById("seekerStamina").value = profile.stamina || "★★★★★ (自信あり)";
  document.getElementById("seekerProfilePublic").checked = Boolean(profile.isPublic);

  if (profile.licenses) {
    document.querySelectorAll('input[name="seekerLic"]').forEach(cb => {
      cb.checked = profile.licenses.includes(cb.value);
    });
  }
}

    function clearSeekerProfileForm() {
  seekerProfileData = null;
  document.getElementById("seekerName").value = "";
  document.getElementById("seekerPhone").value = "";
  document.getElementById("seekerAvatarUrl").value = "";
  document.getElementById("seekerJobType").value = "";

  document.getElementById("seekerLocation").value = "";
  document.getElementById("seekerPayType").value = "";
  document.getElementById("seekerMinimumSalary").value = "";
  document.querySelectorAll('input[name="seekerLic"]').forEach(input => input.checked = false);
  document.getElementById("seekerExpYears").value = "未経験（やる気あり）";
  document.getElementById("seekerStamina").value = "★★★★★ (自信あり)";
  document.getElementById("seekerProfilePublic").checked = false;
  document.getElementById("profileSavedMessage").classList.add("hidden");
  applySeekerSalaryPreferences({});
}

function applySeekerSalaryPreferences(profile) {
  document.getElementById("salaryTypeFilter").value = profile.payType || "";
  document.getElementById("minimumSalary").value = profile.minimumSalary ?? "";
}
