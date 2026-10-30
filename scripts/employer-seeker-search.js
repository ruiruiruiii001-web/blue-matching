let employerPublicSeekers = [];
let employerPublicSeekersError = "";
let employerPublicSeekersUserId = null;
let employerPublicSeekersLoadingUserId = null;
let seekerSearchFilterOptionsUserId = null;
let displayLimitSeekers = 10;

function updateAccountSearchSurface() {
  const isEmployerTab = activeTab === "employer";
  const canSearchSeekers = isEmployerTab && Boolean(currentUser) && accountType === "employer";
  const jobSearchPanel = document.getElementById("jobSearchPanel");
  const seekerSearchPanel = document.getElementById("employerSeekerSearch");
  const jobList = document.getElementById("jobList");
  const jobCount = document.getElementById("jobCount");
  const jobListTitle = document.getElementById("jobListTitle");
  const jobListDescription = document.getElementById("jobListDescription");
  const jobTrustNotice = document.getElementById("jobTrustNotice");
  if (!jobSearchPanel || !seekerSearchPanel || !jobList || !jobCount || !jobListTitle) return;

  jobSearchPanel.classList.toggle("hidden", isEmployerTab);
  seekerSearchPanel.classList.toggle("hidden", !canSearchSeekers);
  jobList.classList.toggle("hidden", isEmployerTab);
  jobCount.classList.toggle("hidden", isEmployerTab && !canSearchSeekers);
  jobTrustNotice?.classList.toggle("hidden", isEmployerTab);
  if (isEmployerTab) {
    jobListTitle.innerText = canSearchSeekers ? "求職者検索" : "アカウント情報を確認しています";
    jobListDescription?.classList.toggle("hidden", !canSearchSeekers);
    if (jobListDescription && canSearchSeekers) {
      jobListDescription.innerText = "企業へのプロフィール公開を許可した求職者だけを検索できます。";
    }
    if (canSearchSeekers) renderEmployerSeekerSearch();
    return;
  }

  jobListTitle.innerText = activeTab === "seeker" ? "希望に合う求人を探す" : "現場求人一覧";
  jobListDescription?.classList.toggle("hidden", activeTab !== "seeker");
  if (jobListDescription && activeTab === "seeker") {
    jobListDescription.innerText = "希望職種・勤務地・給与条件の一致度を目安に求人をおすすめ順で表示します。検索条件は以下のパネルから自由に変更できます。";
  }
}

function resetEmployerSeekerSearch() {
  employerPublicSeekers = [];
  employerPublicSeekersError = "";
  employerPublicSeekersUserId = null;
  employerPublicSeekersLoadingUserId = null;
  seekerSearchFilterOptionsUserId = null;
  displayLimitSeekers = 10;
  const keyword = document.getElementById("seekerSearchKeyword");
  if (keyword) keyword.value = "";
  const jobSelect = document.getElementById("seekerSearchJob");
  if (jobSelect) jobSelect.value = "";
  const location = document.getElementById("seekerSearchLocation");
  if (location) location.innerHTML = '<option value="">すべての勤務地</option>';
  const licenses = document.getElementById("seekerSearchLicenses");
  if (licenses) licenses.innerHTML = '<p class="text-xs text-gray-400">公開プロフィールを読み込むと表示されます。</p>';
  const experience = document.getElementById("seekerSearchExperience");
  if (experience) experience.value = "";
  const payType = document.getElementById("seekerSearchPayType");
  if (payType) payType.value = "";
  const sort = document.getElementById("seekerSearchSort");
  if (sort) sort.value = "match";
  const status = document.getElementById("employerSeekerSearchStatus");
  if (status) {
    status.innerText = "";
    status.classList.add("hidden");
  }
  renderEmployerSeekerSearch();
}

async function loadPublicSeekerProfiles(user) {
  if (!user || currentUser?.id !== user.id || accountType !== "employer" ||
      employerPublicSeekersUserId === user.id || employerPublicSeekersLoadingUserId === user.id) return;

  employerPublicSeekersLoadingUserId = user.id;
  employerPublicSeekersError = "";
  employerPublicSeekers = [];
  renderEmployerSeekerSearch();

  const profiles = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabaseClient
      .from("seeker_public_profiles")
      .select("job_type, location, pay_type, minimum_salary, licenses, exp_years, experience_details, stamina, work_preferences, updated_at")
      .order("updated_at", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (currentUser?.id !== user.id || accountType !== "employer") return;
    if (error) {
      employerPublicSeekersError = `公開プロフィールを読み込めませんでした: ${error.message}`;
      console.error("公開プロフィール検索エラー:", error);
      break;
    }
    profiles.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }

  if (currentUser?.id !== user.id || accountType !== "employer") return;
  employerPublicSeekers = profiles;
  employerPublicSeekersUserId = user.id;
  employerPublicSeekersLoadingUserId = null;
  renderEmployerSeekerSearch();
}

function renderEmployerSeekerSearch(resetLimit = false) {
  const results = document.getElementById("employerSeekerSearchResults");
  const status = document.getElementById("employerSeekerSearchStatus");
  const count = document.getElementById("jobCount");
  if (!results || !status || !count) return;
  if (resetLimit) displayLimitSeekers = 10;

  if (!currentUser || accountType !== "employer") {
    results.innerHTML = "";
    count.innerText = "0件";
    return;
  }

  if (employerPublicSeekersError) {
    status.innerHTML = `${escapeHtml(employerPublicSeekersError)} <button type="button" onclick="retryPublicSeekerSearch()" class="ml-2 font-bold underline">再読み込み</button>`;
  } else {
    status.innerText = employerPublicSeekersLoadingUserId === currentUser.id
      ? "公開プロフィールを読み込んでいます..."
      : "";
  }
  status.classList.toggle("hidden", !employerPublicSeekersError && employerPublicSeekersLoadingUserId !== currentUser.id);

  const keyword = (document.getElementById("seekerSearchKeyword")?.value || "").trim().toLocaleLowerCase();
  const location = document.getElementById("seekerSearchLocation")?.value || "";
  const experience = document.getElementById("seekerSearchExperience")?.value || "";
  const payType = document.getElementById("seekerSearchPayType")?.value || "";
  const sortBy = document.getElementById("seekerSearchSort")?.value || "match";
  const selectedLicenses = Array.from(document.querySelectorAll('input[name="seekerSearchLicense"]:checked'))
    .map(input => input.value);
  const ownedJobs = cachedJobs.filter(job =>
    job.owner_id === currentUser.id && !isJobClosed(job)
  );
  const jobSelect = document.getElementById("seekerSearchJob");
  const selectedJobId = jobSelect.value;
  const selectedJob = ownedJobs.find(job => String(job.id) === selectedJobId);
  const previousJobId = selectedJob ? String(selectedJob.id) : "";
  jobSelect.innerHTML = `<option value="">${ownedJobs.length ? "求人を選ぶとマッチ度順に表示" : "募集中の自社求人がありません"}</option>`;
  ownedJobs.forEach(job => {
    jobSelect.add(new Option(`${job.title || "求人"} ・ ${job.location || "勤務地未設定"}`, String(job.id)));
  });
  jobSelect.value = previousJobId;
  const matchedJob = ownedJobs.find(job => String(job.id) === jobSelect.value);

  if (seekerSearchFilterOptionsUserId !== currentUser.id &&
      employerPublicSeekersUserId === currentUser.id) {
    const selectedLocation = location;
    const locations = [...new Set(employerPublicSeekers.map(profile => String(profile.location || "").trim()).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, "ja"));
    const locationSelect = document.getElementById("seekerSearchLocation");
    locationSelect.innerHTML = '<option value="">すべての勤務地</option>';
    locations.forEach(value => locationSelect.add(new Option(value, value)));
    locationSelect.value = locations.includes(selectedLocation) ? selectedLocation : "";

    const licenseOptions = [...new Set(employerPublicSeekers.flatMap(profile =>
      Array.isArray(profile.licenses) ? profile.licenses.map(String) : []
    ))].sort((left, right) => left.localeCompare(right, "ja"));
    document.getElementById("seekerSearchLicenses").innerHTML = licenseOptions.length
      ? licenseOptions.map(license => `
        <label class="flex min-h-9 items-center gap-2 rounded px-2 text-sm hover:bg-blue-50">
          <input type="checkbox" name="seekerSearchLicense" value="${escapeHtml(license)}" onchange="renderEmployerSeekerSearch(true)" class="h-4 w-4 rounded text-blue-600 focus:ring-blue-500">
          ${escapeHtml(license)}
        </label>
      `).join("")
      : '<p class="text-xs text-gray-400">公開中の資格情報はありません。</p>';
    seekerSearchFilterOptionsUserId = currentUser.id;
  }

  const filteredProfiles = employerPublicSeekers
    .filter(profile => {
      const searchableText = [
        profile.job_type,
        profile.location,
        profile.exp_years,
        profile.experience_details,
        profile.stamina,
        ...getWorkPreferenceLabels(profile.work_preferences),
        ...(Array.isArray(profile.licenses) ? profile.licenses : [])
      ].join(" ").toLocaleLowerCase();
      return (!keyword || searchableText.includes(keyword)) &&
        (!location || String(profile.location || "").trim() === location) &&
        (!experience || profile.exp_years === experience) &&
        (!payType || profile.pay_type === payType) &&
        (!selectedLicenses.length ||
          selectedLicenses.some(license => Array.isArray(profile.licenses) && profile.licenses.includes(license)));
    })
    .sort((left, right) => {
      if (sortBy === "match" && matchedJob) {
        const leftMatch = getSeekerJobMatch(matchedJob, left);
        const rightMatch = getSeekerJobMatch(matchedJob, right);
        const scoreDifference = rightMatch.score - leftMatch.score;
        if (scoreDifference !== 0) return scoreDifference;
      }
      if (sortBy === "salary") {
        const salaryDifference = (Number(right.minimum_salary) || 0) - (Number(left.minimum_salary) || 0);
        if (salaryDifference !== 0) return salaryDifference;
      }
      return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
    });

  count.innerText = `${filteredProfiles.length}件`;
  const activeFilters = [
    keyword && `キーワード: ${keyword}`,
    location && `勤務地: ${location}`,
    experience && `経験: ${experience}`,
    payType && `希望給与区分: ${document.getElementById("seekerSearchPayType").selectedOptions[0].text}`,
    ...selectedLicenses.map(license => `資格: ${license}`)
  ].filter(Boolean);
  const activeFiltersContainer = document.getElementById("activeSeekerFilters");
  activeFiltersContainer.classList.toggle("hidden", activeFilters.length === 0);
  activeFiltersContainer.classList.toggle("flex", activeFilters.length > 0);
  document.getElementById("activeSeekerFilterSummary").innerText = activeFilters.length
    ? `${activeFilters.length}件の条件で絞り込み中`
    : "";

  if (employerPublicSeekersLoadingUserId === currentUser.id || employerPublicSeekersError) {
    results.innerHTML = "";
    return;
  }
  if (filteredProfiles.length === 0) {
    results.innerHTML = `<div class="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-12 text-center shadow-sm">
      <div class="mb-3 text-3xl">🔍</div>
      <p class="text-base font-bold text-gray-800">${activeFilters.length ? "条件に合う求職者が見つかりませんでした" : "公開中の求職者プロフィールはありません"}</p>
      <p class="mt-2 text-sm text-gray-500">${activeFilters.length ? "条件をリセットして、ほかのプロフィールも見てみましょう。" : "求職者がプロフィールの公開を許可すると、ここに表示されます。"}</p>
      ${activeFilters.length ? '<button type="button" onclick="resetEmployerSeekerFilters()" class="mt-6 min-h-11 rounded-xl bg-blue-600 px-6 py-2.5 font-bold text-white hover:bg-blue-700">検索条件をリセット</button>' : ""}
    </div>`;
    return;
  }

  const visibleProfiles = filteredProfiles.slice(0, displayLimitSeekers);
  results.innerHTML = visibleProfiles.map(profile => {
    const payTypeLabels = { hourly: "時給", daily: "日給", monthly: "月給" };
    const pay = profile.pay_type
      ? `${payTypeLabels[profile.pay_type] || "給与"}${profile.minimum_salary ? `・希望最低額 ${Number(profile.minimum_salary).toLocaleString()}円` : ""}`
      : "希望給与の指定なし";
    const licenses = Array.isArray(profile.licenses) && profile.licenses.length
      ? profile.licenses.map(license => `<span class="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800">${escapeHtml(String(license))}</span>`).join("")
      : '<span class="text-sm text-gray-500">登録なし</span>';
    const workPreferences = getWorkPreferenceLabels(profile.work_preferences);
    const match = matchedJob ? getSeekerJobMatch(matchedJob, profile) : null;
    const matchLabel = match && match.maximumScore > 0
      ? `<div class="mt-4 rounded-lg ${match.score >= 11 ? "bg-emerald-50 text-emerald-900" : match.score >= 6 ? "bg-amber-50 text-amber-900" : "bg-gray-50 text-gray-700"} p-3">
          <div class="flex items-center justify-between gap-3">
            <span class="text-sm font-bold">条件一致スコア</span>
            <span class="text-lg font-black">${match.score}点</span>
          </div>
          <p class="mt-1 text-xs">${match.reasons.length ? `一致: ${escapeHtml(match.reasons.join("・"))}` : "登録済みの希望条件と一致する項目はありません"}</p>
          <p class="mt-1 text-[10px] opacity-75">最大14点。登録済みの希望条件だけで算出する目安です。</p>
        </div>`
      : matchedJob
        ? '<p class="mt-4 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">比較できる希望条件が未登録です。プロフィール内容を参考にしてください。</p>'
        : "";
    return `<article class="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:border-blue-200 hover:shadow-md sm:p-6">
      <div class="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-4">
        <div class="min-w-0">
          <h3 class="break-words text-lg font-extrabold leading-tight text-gray-900">${escapeHtml(String(profile.job_type || "希望職種未設定"))}</h3>
          <p class="mt-1 text-sm text-gray-600">📍 ${escapeHtml(String(profile.location || "希望勤務地未設定"))}</p>
        </div>
        <span class="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">公開中</span>
      </div>
      <dl class="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div><dt class="text-xs font-bold text-gray-500">現場経験</dt><dd class="mt-1 font-medium text-gray-800">${escapeHtml(String(profile.exp_years || "未設定"))}</dd></div>
        <div class="sm:col-span-2"><dt class="text-xs font-bold text-gray-500">経験した作業・できること</dt><dd class="mt-1 whitespace-pre-wrap font-medium text-gray-800">${escapeHtml(String(profile.experience_details || "未登録"))}</dd></div>
        <div><dt class="text-xs font-bold text-gray-500">希望給与</dt><dd class="mt-1 font-medium text-gray-800">${escapeHtml(pay)}</dd></div>
        <div><dt class="text-xs font-bold text-gray-500">体力自信度</dt><dd class="mt-1 font-medium text-gray-800">${escapeHtml(String(profile.stamina || "未設定"))}</dd></div>
        <div><dt class="text-xs font-bold text-gray-500">資格</dt><dd class="mt-1 flex flex-wrap gap-1.5">${licenses}</dd></div>
      </dl>
      <div class="mt-4">
        <p class="text-xs font-bold text-gray-500">希望する働き方</p>
        <div class="mt-1 flex flex-wrap gap-1.5">${workPreferences.length
          ? workPreferences.map(value => `<span class="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-800">${escapeHtml(value)}</span>`).join("")
          : '<span class="text-sm text-gray-500">未設定</span>'}</div>
      </div>
      ${matchLabel}
      <p class="mt-4 border-t border-gray-100 pt-3 text-[10px] font-medium text-gray-400">プロフィール更新: ${formatDashboardDate(profile.updated_at)}</p>
    </article>`;
  }).join("");

  if (filteredProfiles.length > visibleProfiles.length) {
    results.insertAdjacentHTML("beforeend", `<button type="button" onclick="showMoreSeekerProfiles()" class="min-h-12 w-full rounded-xl border border-blue-200 bg-white px-4 py-3 font-bold text-blue-700 hover:bg-blue-50">さらに表示（残り${filteredProfiles.length - visibleProfiles.length}件）</button>`);
  }
}

function getSeekerJobMatch(job, profile) {
  let score = 0;
  let maximumScore = 0;
  const reasons = [];
  const preferredJobTypes = String(profile.job_type || "")
    .split(/[,、，]/)
    .map(value => value.trim().toLocaleLowerCase())
    .filter(Boolean);
  if (preferredJobTypes.length) {
    maximumScore += 4;
    const jobDescription = `${job.title || ""} ${job.duties || ""}`.toLocaleLowerCase();
    if (preferredJobTypes.some(jobType => jobDescription.includes(jobType))) {
      score += 4;
      reasons.push("希望職種が一致");
    }
  }

  if (String(profile.location || "").trim() && String(job.location || "").trim()) {
    maximumScore += 4;
    const locationScore = getLocationMatchScore(job.location, profile.location);
    score += locationScore * 2;
    if (locationScore === 2) reasons.push("希望勤務地が一致");
    else if (locationScore === 1) reasons.push("希望都道府県が一致");
  }

  const profilePayType = profile.pay_type || "";
  const jobPayType = getJobPayType(job);
  if (profilePayType && jobPayType) {
    maximumScore += 1;
    if (profilePayType === jobPayType) {
      score += 1;
      reasons.push("希望給与区分が一致");
    }
  }

  const minimumSalary = Number(profile.minimum_salary) || 0;
  const jobSalary = getJobPayAmount(job);
  if (minimumSalary > 0 && jobSalary > 0) {
    maximumScore += 1;
    if (jobSalary >= minimumSalary) {
      score += 1;
      reasons.push("求人給与が希望最低額以上");
    }
  }

  const workMatch = getWorkPreferenceMatch(job.work_preferences, profile.work_preferences);
  score += workMatch.score;
  maximumScore += workMatch.maximumScore;
  reasons.push(...workMatch.reasons);

  return {
    score,
    maximumScore,
    reasons
  };
}

function showMoreSeekerProfiles() {
  displayLimitSeekers += 10;
  renderEmployerSeekerSearch();
}

function retryPublicSeekerSearch() {
  if (!currentUser || accountType !== "employer") return;
  employerPublicSeekersError = "";
  employerPublicSeekersUserId = null;
  loadPublicSeekerProfiles(currentUser);
}

function resetEmployerSeekerFilters() {
  document.getElementById("seekerSearchJob").value = "";
  document.getElementById("seekerSearchKeyword").value = "";
  document.getElementById("seekerSearchLocation").value = "";
  document.getElementById("seekerSearchExperience").value = "";
  document.getElementById("seekerSearchPayType").value = "";
  document.getElementById("seekerSearchSort").value = "match";
  document.querySelectorAll('input[name="seekerSearchLicense"]').forEach(input => {
    input.checked = false;
  });
  renderEmployerSeekerSearch(true);
}
