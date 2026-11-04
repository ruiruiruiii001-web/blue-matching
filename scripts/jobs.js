// Supabaseからお仕事一覧を取得
async function fetchJobs() {
  const jobColumns = 'id, title, location, salary, duties, capacity, work_style, work_preferences, start_time, end_time, break_minutes, overtime_details, allowance_details, pay_type, pay_amount, pay_amount_max, pay_condition_details, required_licenses, preferred_licenses, experience_requirement, experience_requirement_details, tags, image_url, image_urls, category, work_date, payment_method, moderation_status, moderation_note, owner_id, is_closed, is_hidden, hidden_reason, expires_at, created_at, updated_at';
  const legacyJobColumns = jobColumns.replace(", image_urls", "");
  const pageSize = 1000;
  const loadPages = async columns => {
    const rows = [];
    for (let from = 0; ; from += pageSize) {
      const result = await supabaseClient
        .from('published_jobs')
        .select(columns)
        .order('id', { ascending: false })
        .range(from, from + pageSize - 1);
      if (result.error) return { rows, error: result.error };
      rows.push(...(result.data || []));
      if ((result.data || []).length < pageSize) break;
    }
    return { rows, error: null };
  };
  let result = await loadPages(jobColumns);
  const missingImageUrlsColumn = result.error &&
    ["42703", "PGRST204"].includes(result.error.code) &&
    result.error.message.includes("image_urls");
  if (missingImageUrlsColumn) {
    jobImagesSchemaReady = false;
    result = await loadPages(legacyJobColumns);
  } else if (!result.error) {
    jobImagesSchemaReady = true;
  }

  if (result.error) {
    console.error("データ取得エラー:", result.error);
    cachedJobs = [];
    const list = document.getElementById("jobList");
    const message = document.createElement("p");
    message.className = "rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800";
    message.setAttribute("role", "alert");
    message.textContent = ["42703", "PGRST204"].includes(result.error.code)
      ? "お仕事一覧を読み込めません。最新のDB移行SQLをSupabaseで実行済みか確認してください。"
      : `お仕事一覧を読み込めませんでした: ${result.error.message}`;
    list.replaceChildren(message);
    return false;
  }
  cachedJobs = result.rows.map(job => ({
    ...job,
    image_urls: Array.isArray(job.image_urls) ? job.image_urls : job.image_url ? [job.image_url] : []
  }));
  await loadEmployerPublicProfiles(cachedJobs.map(job => job.owner_id));
  renderJobList();
  renderEmployerDashboard();
  renderAccountDashboard();
  openSharedJobFromUrl();
  return true;
}

let sharedJobHandled = false;
function openSharedJobFromUrl() {
  if (sharedJobHandled) return;
  sharedJobHandled = true;
  const sharedId = new URLSearchParams(location.search).get("job");
  if (!sharedId) return;
  if (cachedJobs.some(job => String(job.id) === sharedId)) {
    openModal(sharedId);
  } else {
    alert("このお仕事は見つかりませんでした。掲載が終了したか、非公開になっている可能性があります。");
  }
}

// お仕事投稿・編集（Supabaseへ保存）
async function publishJob() {
  if (!currentUser || accountType !== "employer") {
    setAuthMessage("お仕事を管理するには「お仕事をお願いする方」アカウントでログインしてください。", true);
    return;
  }

  const title = document.getElementById("jobTitle").value.trim();
  const workCategory = document.getElementById("jobWorkCategory").value;
  const workDate = document.getElementById("jobWorkDate").value || null;
  const paymentMethod = "cash_on_site";
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
    alert("募集タイトルは必須項目です。");
    return;
  }

  if (!Object.prototype.hasOwnProperty.call(WORK_CATEGORY_LABELS, workCategory)) {
    alert("作業カテゴリを選択してください。");
    return;
  }

  if (workCategory !== "other" && !workDate) {
    alert("単発のお手伝いは作業日を入力してください。");
    return;
  }

  if (workCategory !== "other" && !location) {
    alert("単発のお手伝いは勤務地を入力してください。番地など個人宅を特定できる情報は入力しないでください。");
    return;
  }

  if (workDate) {
    const today = new Date();
    const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const existingWorkDate = editingJobId === null
      ? null
      : cachedJobs.find(job => String(job.id) === String(editingJobId))?.work_date;
    if (workDate < localToday && workDate !== existingWorkDate) {
      alert("作業日は今日以降の日付を選択してください。");
      return;
    }
  }

  if (title.length > 80 || location.length > 500 || salary.length > 100 || duties.length > 2000 ||
      overtimeDetails.length > 300 || allowanceDetails.length > 1000 ||
      payConditionDetails.length > 500 || experienceRequirementDetails.length > 500) {
    alert("入力欄の文字数上限を超えています。お仕事情報を短くして再度お試しください。");
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

  if (!jobImagesSchemaReady && pendingJobImageFiles.length) {
    alert("写真を登録するには、README記載の写真用SQLをSupabaseで実行してください。");
    return;
  }

  let uploadedImages;
  try {
    uploadedImages = jobImagesSchemaReady
      ? await uploadPendingJobImages()
      : { urls: [], paths: [] };
  } catch (error) {
    alert(`写真をアップロードできませんでした: ${error.message}`);
    return;
  }
  const oldImages = editingJobId === null
    ? []
    : getJobImages(cachedJobs.find(job => String(job.id) === String(editingJobId)) || {});
  const imageUrls = [...retainedJobImageUrls, ...uploadedImages.urls];

  const jobData = {
    title, location, salary, duties, capacity,
    category: workCategory,
    work_date: workDate,
    payment_method: paymentMethod,
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
    image_url: imageUrls[0] || null,
    ...(jobImagesSchemaReady && { image_urls: imageUrls }),
    ...(durationDays !== null && { expires_at: getJobExpiryDateFromDays(durationDays) }),
    ...(!editingJobId && { owner_id: currentUser.id })
  };

  const query = supabaseClient.from('published_jobs');
  const result = editingJobId
    ? await query.update(jobData).eq('id', editingJobId).eq('owner_id', currentUser.id).select("id").maybeSingle()
    : await query.insert([jobData]).select("id").single();

  if (result.error || !result.data) {
    const cleanupError = uploadedImages.paths.length
      ? (await supabaseClient.storage.from("job-media").remove(uploadedImages.paths)).error
      : null;
    if (cleanupError) console.error("保存に失敗したお仕事の写真の後片付けに失敗しました:", cleanupError);
    alert(`${editingJobId ? "更新" : "投稿"}に失敗しました: ${result.error?.message || "対象のお仕事を更新できませんでした。"}`);
    return;
  }

  const wasEditing = editingJobId !== null;
  const removedImages = oldImages.filter(url => !imageUrls.includes(url));
  const cleanupFailures = await deleteUnreferencedJobImages(removedImages, wasEditing ? editingJobId : null);
  cancelJobEdit();

  const refreshed = await fetchJobs();
  const savedJob = cachedJobs.find(job => String(job.id) === String(result.data.id));
  const saveMessage = !refreshed
    ? "保存しましたが、状態を確認できませんでした。画面を再読み込みしてください。"
    : savedJob?.moderation_status === "pending"
      ? "審査申請を受け付けました。確認後に一覧へ公開されます。"
      : savedJob?.moderation_status === "rejected"
        ? "保存しました。再審査に出すには、却下理由を確認して内容を修正してください。"
        : "お仕事情報を保存しました。";
  alert(`${saveMessage}${cleanupFailures.length ? "\n一部の不要な写真を整理できませんでした。時間をおいて再度お試しください。" : ""}`);
  if (!wasEditing) {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#2563eb', '#3b82f6', '#60a5fa', '#ffffff']
    });
  }
  document.getElementById("myPageOverlayContent").scrollTop = 0;
  window.scrollTo({ top: 0, behavior: "instant" });
}

function editJob(id) {
  const job = cachedJobs.find(item => item.id === id);
  if (!currentUser || accountType !== "employer" || !job || job.owner_id !== currentUser.id) return;

  if (!dashboardOpen) openAccountPanel();
  showEmployerDashboardView("job-editor");
  document.getElementById("jobAdvancedDetails").open = true;
  document.getElementById("jobLocationPreferences").open = true;
  editingJobId = id;
  document.getElementById("jobTitle").value = job.title || "";
  document.getElementById("jobWorkCategory").value = job.category || "other";
  document.getElementById("jobWorkDate").value = job.work_date || "";
  setCheckedValues("jobWorkPreference", job.work_preferences);
  setJobImagesForEdit(job);

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
  const payTypeSelect = document.getElementById("jobPayType");
  const payType = getJobPayType(job);
  if (payType === "monthly" && !Array.from(payTypeSelect.options).some(option => option.value === "monthly")) {
    const legacyMonthlyOption = new Option("月給（既存募集）", "monthly");
    legacyMonthlyOption.dataset.legacy = "true";
    payTypeSelect.add(legacyMonthlyOption);
  }
  payTypeSelect.value = payType;
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
  document.getElementById("jobFormHeading").innerText = "お仕事情報を編集";
  document.getElementById("jobSubmitButton").innerText = "再審査に出す";
  document.getElementById("cancelEditButton").classList.remove("hidden");
  document.getElementById("cancelEditButton").innerText = "編集をキャンセル";
  document.getElementById("employerJobForm").classList.remove("hidden");
  document.getElementById("myPageOverlayContent").scrollTop = 0;
  document.getElementById("jobTitle").focus({ preventScroll: true });
}

function duplicateJob(id) {
  const job = cachedJobs.find(item => item.id === id);
  if (!currentUser || accountType !== "employer" || !job || job.owner_id !== currentUser.id) return;
  editJob(id);
  editingJobId = null;
  setJobDurationControl(false);
  document.getElementById("jobFormHeading").innerText = "お仕事を複製して新規投稿";
  document.getElementById("jobSubmitButton").innerText = "🔥 この内容で新しく掲載する";
  document.getElementById("cancelEditButton").innerText = "キャンセル";
}

function openEmployerJobForm() {
  if (!currentUser || accountType !== "employer") return;
  if (!dashboardOpen) openAccountPanel();
  cancelJobEdit();
  showEmployerDashboardView("job-editor");
  document.getElementById("jobLocationPreferences").open = true;
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
  document.getElementById("jobWorkCategory").value = "";
  document.getElementById("jobWorkDate").value = "";
  setCheckedValues("jobWorkPreference", []);
  resetJobImages();

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
  const payTypeSelect = document.getElementById("jobPayType");
  const legacyMonthlyOption = payTypeSelect.querySelector('option[data-legacy="true"]');
  if (legacyMonthlyOption) legacyMonthlyOption.remove();
  payTypeSelect.value = "";
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
  document.getElementById("jobFormHeading").innerText = "地域のお手伝いを募集";
  document.getElementById("jobSubmitButton").innerText = "審査に出す";
  document.getElementById("jobAdvancedDetails").open = false;
  document.getElementById("jobLocationPreferences").open = false;
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

const MAX_JOB_LISTING_DAYS_AHEAD = 30;

async function extendJob(id, days = null) {
  const job = cachedJobs.find(item => item.id === id);
  if (!currentUser || accountType !== "employer" || !job || job.owner_id !== currentUser.id) return;
  const select = document.getElementById(`extendDays-${id}`);
  days = days ?? (Number(select?.value) || DEFAULT_JOB_DURATION_DAYS);
  if (!JOB_DURATION_OPTIONS.includes(days)) {
    alert("掲載期間は7日・14日・30日から選択してください。");
    return;
  }

  // 期限が残っていれば残り日数に加算し、切れていれば今日から数える
  const currentExpiry = Date.parse(job.expires_at || "");
  const base = Number.isFinite(currentExpiry) && currentExpiry > Date.now() ? currentExpiry : Date.now();
  const maxExpiry = Date.now() + MAX_JOB_LISTING_DAYS_AHEAD * 86400000;
  const newExpiry = Math.min(base + days * 86400000, maxExpiry);
  if (newExpiry <= base) {
    alert(`掲載期限は今日から最大${MAX_JOB_LISTING_DAYS_AHEAD}日先までです。これ以上は延長できません。`);
    return;
  }
  const newExpiryText = new Date(newExpiry).toLocaleDateString("ja-JP");
  const capped = base + days * 86400000 > maxExpiry ? `（上限の${MAX_JOB_LISTING_DAYS_AHEAD}日先までに調整されます）` : "";
  if (!confirm(`「${job.title}」の掲載を${days}日延長し、${newExpiryText}までにしますか？${capped}`)) return;

  const { error } = await supabaseClient
    .from('published_jobs')
    .update({ expires_at: new Date(newExpiry).toISOString() })
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

// プロフィール保存

async function deleteJob(id) {
  const job = cachedJobs.find(item => item.id === id);
  if (!currentUser || accountType !== "employer" || !job || job.owner_id !== currentUser.id) return;
  if (!confirm("このお仕事をクラウドから削除しますか？")) return;

  const { error } = await supabaseClient
    .from('published_jobs')
    .delete()
    .eq('id', id)
    .eq('owner_id', currentUser.id);

  if (error) {
    alert("削除に失敗しました: " + error.message);
    return;
  }

  const cleanupFailures = await deleteUnreferencedJobImages(getJobImages(job), id);
  if (cleanupFailures.length) {
    alert("お仕事は削除しましたが、一部の写真を整理できませんでした。");
  }
  fetchJobs();
  closeModal();
}
