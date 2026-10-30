// Supabaseから求人一覧を取得
async function fetchJobs() {
  const { data, error } = await supabaseClient
    .from('published_jobs')
    .select('*')
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
  const location = document.getElementById("jobLocation").value.trim();
  const salary = document.getElementById("jobSalary").value.trim();
  const phone = document.getElementById("jobPhone").value.trim();
  const line = document.getElementById("jobLine").value.trim();
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
  const normalizedPhone = normalizeJapanesePhone(phone);

  const checkedTags = Array.from(document.querySelectorAll('input[name="jobTag"]:checked')).map(cb => cb.value);
  const workPreferences = getCheckedValues("jobWorkPreference");

  if (!title || !phone) {
    alert("「職種名」と「連絡用電話番号」は必須項目です。");
    return;
  }

  if (title.length > 80 || location.length > 100 || salary.length > 100 || duties.length > 2000 ||
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

  if (!isValidJapanesePhone(normalizedPhone)) {
    alert("連絡用電話番号は日本の電話番号を入力してください（例: 09012345678）。");
    return;
  }

  if (/-\s*\d/.test(salary)) {
    alert("給与表記にマイナスの金額は入力できません。");
    return;
  }

  if (line.length > 200) {
    alert("LINE ID / URLは200文字以内で入力してください。");
    return;
  }

  if (line) {
    const isHttpsUrl = /^https:\/\//i.test(line);
    if (isHttpsUrl) {
      try {
        const lineUrl = new URL(line);
        if (!["line.me", "www.line.me"].includes(lineUrl.hostname)) throw new Error("unsupported host");
      } catch {
        alert("LINE URLにはhttps://line.meから始まるURLを入力してください。");
        return;
      }
    } else if (!/^[A-Za-z0-9._-]{1,64}$/.test(line)) {
      alert("LINE IDは英数字と「.」「_」「-」で入力するか、https://line.meのURLを入力してください。");
      return;
    }
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
    title, location, salary, phone: normalizedPhone, line, duties, capacity,
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
  showEmployerDashboardView("jobs");
  editingJobId = id;
  document.getElementById("jobTitle").value = job.title || "";
  setCheckedValues("jobWorkPreference", job.work_preferences);
  document.getElementById("jobImageUrl").value = job.image_url || "";

  document.getElementById("jobLocation").value = job.location || "";
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
  document.getElementById("jobPhone").value = job.phone || "";
  document.getElementById("jobLine").value = job.line || "";
  document.getElementById("jobDuties").value = job.duties || "";
  document.getElementById("jobCapacity").value = getCapacityOptionValue(job.capacity);
  const jobTags = getNormalizedJobTags(job.tags);
  document.querySelectorAll('input[name="jobTag"]').forEach(cb => {
    cb.checked = jobTags.includes(cb.value);
  });
  document.getElementById("jobFormHeading").innerText = "求人情報を編集";
  document.getElementById("jobSubmitButton").innerText = "変更を保存";
  document.getElementById("cancelEditButton").classList.remove("hidden");
  document.getElementById("cancelEditButton").innerText = "編集をキャンセル";
  document.getElementById("employerJobForm").classList.remove("hidden");
  document.getElementById("employerJobForm").scrollIntoView({ behavior: "smooth" });
  document.getElementById("jobTitle").focus({ preventScroll: true });
}

function openEmployerJobForm() {
  if (!currentUser || accountType !== "employer") return;
  if (!dashboardOpen) openAccountPanel();
  showEmployerDashboardView("jobs");
  cancelJobEdit();
  document.getElementById("cancelEditButton").classList.remove("hidden");
  document.getElementById("cancelEditButton").innerText = "キャンセル";
  document.getElementById("employerJobForm").classList.remove("hidden");
  document.getElementById("employerJobForm").scrollIntoView({ behavior: "smooth" });
  document.getElementById("jobTitle").focus({ preventScroll: true });
}

function cancelJobEdit() {
  editingJobId = null;
  document.getElementById("employerJobForm").classList.add("hidden");
  document.getElementById("cancelEditButton").classList.add("hidden");
  document.getElementById("jobTitle").value = "";
  setCheckedValues("jobWorkPreference", []);
  document.getElementById("jobImageUrl").value = "";

  document.getElementById("jobLocation").value = "";
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
  document.getElementById("jobPhone").value = "";
  document.getElementById("jobLine").value = "";
  document.getElementById("jobDuties").value = "";
  document.getElementById("jobCapacity").value = "1";
  document.querySelectorAll('input[name="jobTag"]').forEach(cb => cb.checked = false);
  document.getElementById("jobFormHeading").innerText = "現場求人のクラウド投稿";
  document.getElementById("jobSubmitButton").innerText = "🔥 クラウドに求人を今すぐ掲載する";
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
