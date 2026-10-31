// Supabaseから求人一覧を取得
async function fetchJobs() {
  const { data, error } = await supabaseClient
    .from('published_jobs')
    .select('id, title, location, salary, duties, capacity, work_style, work_preferences, start_time, end_time, break_minutes, overtime_details, allowance_details, pay_type, pay_amount, pay_amount_max, pay_condition_details, required_licenses, preferred_licenses, experience_requirement, experience_requirement_details, tags, image_url, owner_id, is_closed, is_hidden, hidden_reason, expires_at, created_at, updated_at')
    .order('id', { ascending: false });

  if (error) {
    console.error("データ取得エラー:", error);
    return;
  }
  cachedJobs = data || [];
  renderJobList();
  renderEmployerDashboard();
  renderAccountDashboard();
}

// 求人投稿・編集（Supabaseへ保存）
async function publishJob() {
  if (!currentUser || accountType !== "employer") {
    setAuthMessage("求人を管理するには企業・親方アカウントでログインしてください。", true);
    return;
  }

  const title = document.getElementById("jobTitle").value.trim();
  const location = getLocationPreferencesFromForm("jobLocationPrefecture", "jobLocation").trim();
  const salary = document.getElementById("jobSalary").value.trim();
  const duties = document.getElementById("jobDuties").value.trim();
  const capacity = parseInt(document.getElementById("jobCapacity").value) || 1;
  const payType = document.getElementById("jobPayType").value;
  const payAmountValue = document.getElementById("jobPayAmount").value;
  const payAmount = payAmountValue ? Number(payAmountValue) : null;
  const payAmountMaxValue = document.getElementById("jobPayAmountMax").value;
  const payAmountMax = payAmountMaxValue ? Number(payAmountMaxValue) : null;
  const payConditionDetails = document.getElementById("jobPayConditionDetails").value.trim();
  const requiredLicenses = getCheckedValues("jobRequiredLicense");
  const requiredLicenseSet = new Set(requiredLicenses);
  const preferredLicenses = getCheckedValues("jobPreferredLicense")
    .filter(license => !requiredLicenseSet.has(license));
  const experienceRequirement = document.getElementById("jobExperienceRequirement").value;
  const experienceRequirementDetails = document.getElementById("jobExperienceRequirementDetails").value.trim();
  const breakMinutesValue = document.getElementById("jobBreakMinutes").value.trim();
  const breakMinutes = breakMinutesValue ? Number(breakMinutesValue) : null;
  const overtimeDetails = document.getElementById("jobOvertimeDetails").value.trim();
  const allowanceDetails = document.getElementById("jobAllowanceDetails").value.trim();
  const checkedTags = Array.from(document.querySelectorAll('input[name="jobTag"]:checked')).map(cb => cb.value);
  const workPreferences = getCheckedValues("jobWorkPreference");
  const durationValue = document.getElementById("jobDurationDays").value;
  const durationDays = durationValue === "keep" ? null : Number(durationValue);
  if (durationDays !== null && !JOB_DURATION_OPTIONS.includes(durationDays)) {
    alert("掲載期間を選択してください。");
    return;
  }

  if (!title) {
    alert("「職種・現場名」は必須項目です。");
    return;
  }

  if (title.length > 80 || location.length > 500 || salary.length > 100 || duties.length > 2000 ||
      overtimeDetails.length > 300 || allowanceDetails.length > 1000 ||
      payConditionDetails.length > 500 || experienceRequirementDetails.length > 500) {
    alert("入力欄の文字数上限を超えています。求人情報を短くして再度お試しください。");
    return;
  }

  if (breakMinutes !== null &&
      (!Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes > 1440)) {
    alert("休憩時間は0〜1,440分の整数で入力してください。");
    return;
  }

  if (/-\s*\d/.test(salary)) {
    alert("給与表記にマイナスの金額は入力できません。");
    return;
  }

  if ((payType && (!Number.isFinite(payAmount) || !Number.isInteger(payAmount) || payAmount <= 0 || payAmount > 100000000)) ||
      (!payType && payAmountValue)) {
    alert("給与の絞り込み条件を設定する場合は、給与区分と1〜100,000,000円の整数を入力してください。");
    return;
  }

  if ((payAmountMax !== null &&
       (!payType || !Number.isInteger(payAmountMax) || payAmountMax <= 0 || payAmountMax > 100000000 || !payAmount)) ||
      (payAmount !== null && payAmountMax !== null && payAmountMax < payAmount)) {
    alert("給与上限を入力する場合は、給与区分と下限も入力し、上限を下限以上にしてください。金額は1〜100,000,000円の整数です。");
    return;
  }

  const jobData = {
    title, location, salary, duties, capacity,
    work_style: workPreferences.some(value => ["employment:spot", "employment:short_term"].includes(value)) ? "short" : "regular",
    work_preferences: workPreferences,
    start_time: document.getElementById("jobStartTime").value || null,
    end_time: document.getElementById("jobEndTime").value || null,
    break_minutes: breakMinutes,
    overtime_details: overtimeDetails,
    allowance_details: allowanceDetails,
    pay_type: payType || null,

    pay_amount: payAmount,
    pay_amount_max: payAmountMax,
    pay_condition_details: payConditionDetails,
    required_licenses: requiredLicenses,
    preferred_licenses: preferredLicenses,
    experience_requirement: experienceRequirement,
    experience_requirement_details: experienceRequirementDetails,
    tags: getNormalizedJobTags(checkedTags),
    image_url: document.getElementById("jobImageUrl").value.trim() || null,
    ...(durationDays !== null && { expires_at: getJobExpiryDateFromDays(durationDays) }),
    ...(!editingJobId && { owner_id: currentUser.id })
  };

  const query = supabaseClient.from('published_jobs');
  const { error } = editingJobId
    ? await query.update(jobData).eq('id', editingJobId)
    : await query.insert([jobData]);

  if (error) {
    alert(`${editingJobId ? "更新" : "投稿"}に失敗しました: ${error.message}`);
    return;
  }

  const wasEditing = editingJobId !== null;
  cancelJobEdit();

  alert(wasEditing ? "求人情報を更新しました！" : "クラウド上に求人を掲載しました！");
  if (!wasEditing) {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#2563eb', '#3b82f6', '#60a5fa', '#ffffff']
    });
  }
  await fetchJobs();

}

function editJob(id) {
  const job = cachedJobs.find(item => item.id === id);
  if (!currentUser || accountType !== "employer" || !job || job.owner_id !== currentUser.id) return;

  if (!dashboardOpen) openAccountPanel();
  showEmployerDashboardView("job-editor");
  editingJobId = id;
  document.getElementById("jobTitle").value = job.title || "";
  setCheckedValues("jobWorkPreference", job.work_preferences);
  document.getElementById("jobImageUrl").value = job.image_url || "";

  setLocationPreferences(
    job.location || "",
    "jobLocationPrefecture",
    "jobLocation",
    "jobLocationPrefectureOptions",
    "jobLocationPrefecture"
  );
  document.getElementById("jobSalary").value = job.salary || "";
  document.getElementById("jobStartTime").value = job.start_time || "";
  document.getElementById("jobEndTime").value = job.end_time || "";
  document.getElementById("jobBreakMinutes").value = job.break_minutes ?? "";
  document.getElementById("jobOvertimeDetails").value = job.overtime_details || "";
  document.getElementById("jobAllowanceDetails").value = job.allowance_details || "";
  document.getElementById("jobPayType").value = getJobPayType(job);
  const payAmount = getJobPayAmount(job);
  document.getElementById("jobPayAmount").value = payAmount > 0 ? String(payAmount) : "";
  document.getElementById("jobPayAmountMax").value = job.pay_amount_max ?? "";
  document.getElementById("jobPayConditionDetails").value = job.pay_condition_details || "";
  const requiredLicenses = Array.isArray(job.required_licenses) ? [...new Set(job.required_licenses)] : [];
  const requiredLicenseSet = new Set(requiredLicenses);
  const preferredLicenses = (Array.isArray(job.preferred_licenses) ? [...new Set(job.preferred_licenses)] : [])
    .filter(license => !requiredLicenseSet.has(license));
  setCheckedValues("jobRequiredLicense", requiredLicenses);
  setCheckedValues("jobPreferredLicense", preferredLicenses);
  document.getElementById("jobExperienceRequirement").value = job.experience_requirement || "none";
  document.getElementById("jobExperienceRequirementDetails").value = job.experience_requirement_details || "";
  document.getElementById("jobDuties").value = job.duties || "";
  document.getElementById("jobCapacity").value = getCapacityOptionValue(job.capacity);
  setJobDurationControl(true, job);
  const legacyLocation = parseLocationPreferences(job.location || "").otherLocations.length > 0;
  document.getElementById("jobLocationLegacyNotice").classList.toggle("hidden", !legacyLocation);
  const jobTags = getNormalizedJobTags(job.tags);
  setCheckedValues("jobTag", jobTags);
  document.getElementById("jobFormHeading").innerText = "求人情報を編集";
  document.getElementById("jobSubmitButton").innerText = "変更を保存";
  document.getElementById("cancelEditButton").classList.remove("hidden");
  document.getElementById("cancelEditButton").innerText = "編集をキャンセル";
  document.getElementById("employerJobForm").classList.remove("hidden");
  document.getElementById("myPageOverlayContent").scrollTop = 0;
  document.getElementById("jobTitle").focus({ preventScroll: true });
}

function openEmployerJobForm() {
  if (!currentUser || accountType !== "employer") return;
  if (!dashboardOpen) openAccountPanel();
  cancelJobEdit();
  showEmployerDashboardView("job-editor");
  document.getElementById("cancelEditButton").classList.remove("hidden");
  document.getElementById("cancelEditButton").innerText = "キャンセル";
  document.getElementById("employerJobForm").classList.remove("hidden");
  document.getElementById("myPageOverlayContent").scrollTop = 0;
  document.getElementById("jobTitle").focus({ preventScroll: true });
}

function cancelJobEdit() {
  editingJobId = null;
  document.getElementById("employerJobForm").classList.add("hidden");
  document.getElementById("cancelEditButton").classList.add("hidden");
  document.getElementById("jobTitle").value = "";
  setCheckedValues("jobWorkPreference", []);
  document.getElementById("jobImageUrl").value = "";

  setLocationPreferences(
    "",
    "jobLocationPrefecture",
    "jobLocation",
    "jobLocationPrefectureOptions",
    "jobLocationPrefecture"
  );
  document.getElementById("jobSalary").value = "";
  document.getElementById("jobStartTime").value = "";
  document.getElementById("jobEndTime").value = "";
  document.getElementById("jobBreakMinutes").value = "";
  document.getElementById("jobOvertimeDetails").value = "";
  document.getElementById("jobAllowanceDetails").value = "";
  document.getElementById("jobPayType").value = "";
  document.getElementById("jobPayAmount").value = "";
  document.getElementById("jobPayAmountMax").value = "";
  document.getElementById("jobPayConditionDetails").value = "";
  setCheckedValues("jobRequiredLicense", []);
  setCheckedValues("jobPreferredLicense", []);
  document.getElementById("jobExperienceRequirement").value = "none";
  document.getElementById("jobExperienceRequirementDetails").value = "";
  document.getElementById("jobDuties").value = "";
  document.getElementById("jobCapacity").value = "1";
  setJobDurationControl(false);
  document.getElementById("jobLocationLegacyNotice").classList.add("hidden");
  document.querySelectorAll('input[name="jobTag"]').forEach(cb => cb.checked = false);
  document.getElementById("jobFormHeading").innerText = "現場求人のクラウド投稿";
  document.getElementById("jobSubmitButton").innerText = "🔥 クラウドに求人を今すぐ掲載する";
  if (dashboardOpen) showEmployerDashboardView("jobs");
}

function setJobDurationControl(editing, job = null) {
  const select = document.getElementById("jobDurationDays");
  const keepOption = select.querySelector('option[value="keep"]');
  keepOption.hidden = !editing;
  keepOption.disabled = !editing;
  select.value = editing ? "keep" : String(DEFAULT_JOB_DURATION_DAYS);
  const status = getJobExpiryStatus(job || {});
  const note = document.getElementById("jobDurationNote");
  note.textContent = editing && status ? `現在: ${status.text}` : "";
  note.classList.toggle("text-red-700", Boolean(status?.warning));
  note.classList.toggle("text-gray-500", !status?.warning);
}

async function extendJob(id, days = DEFAULT_JOB_DURATION_DAYS) {
  const job = cachedJobs.find(item => item.id === id);
  if (!currentUser || accountType !== "employer" || !job || job.owner_id !== currentUser.id) return;
  if (!confirm(`「${job.title}」の掲載を今日から${days}日間に延長しますか？`)) return;

  const { error } = await supabaseClient
    .from('published_jobs')
    .update({ expires_at: getJobExpiryDateFromDays(days) })
    .eq('id', id)
    .eq('owner_id', currentUser.id);

  if (error) {
    alert(`掲載の延長に失敗しました: ${error.message}`);
    return;
  }

  await fetchJobs();
}

async function toggleJobClosed(id) {
  const job = cachedJobs.find(item => item.id === id);
  if (!currentUser || accountType !== "employer" || !job || job.owner_id !== currentUser.id) return;

  const isClosed = Boolean(job.is_closed);
  const action = isClosed ? "募集を再開" : "募集を終了";
  if (!confirm(`「${job.title}」の${action}をしますか？`)) return;

  const { error } = await supabaseClient
    .from('published_jobs')
    .update({ is_closed: !isClosed })
    .eq('id', id)
    .eq('owner_id', currentUser.id);

  if (error) {
    alert(`${action}に失敗しました: ${error.message}`);
    return;
  }

  await fetchJobs();
  if (selectedJob && selectedJob.id === id) openModal(id);
}

// 求職者プロフィール保存

async function deleteJob(id) {
  const job = cachedJobs.find(item => item.id === id);
  if (!currentUser || accountType !== "employer" || !job || job.owner_id !== currentUser.id) return;
  if (!confirm("この求人をクラウドから削除しますか？")) return;

  const { error } = await supabaseClient
    .from('published_jobs')
    .delete()
    .eq('id', id)
    .eq('owner_id', currentUser.id);

  if (error) {
    alert("削除に失敗しました: " + error.message);
    return;
  }

  fetchJobs();
  closeModal();
}
