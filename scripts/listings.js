const warnedJobSafetyIds = new Set();
let legacySavedWorkDateFilter = "";

function jobMatchesKeyword(job, keyword) {
  if (!keyword) return true;
  const payTypeLabels = { hourly: "時給", daily: "日給", monthly: "月給" };
  const fields = [
    job.title,
    job.location,
    job.duties,
    job.salary,
    job.work_date,
    formatWorkDate(job.work_date),
    job.start_time,
    job.end_time,
    job.pay_amount,
    job.pay_amount_max,
    job.pay_condition_details,
    job.experience_requirement_details,
    job.overtime_details,
    job.allowance_details,
    getWorkCategoryLabel(job.category),
    getPaymentMethodLabel(job.payment_method),
    payTypeLabels[getJobPayType(job)],
    ...getWorkPreferenceLabels(job.work_preferences),
    ...getNormalizedJobTags(job.tags),
    ...(Array.isArray(job.required_licenses) ? job.required_licenses : []),
    ...(Array.isArray(job.preferred_licenses) ? job.preferred_licenses : [])
  ];
  return fields.some(value => String(value ?? "").toLocaleLowerCase().includes(keyword));
}

function renderJobList(resetLimit = false) {
  if (activeTab === "employer") return;
  if (resetLimit === true) displayLimitJobs = 10;
  const jobList = document.getElementById("jobList");
  const jobCount = document.getElementById("jobCount");
  const keyword = document.getElementById("searchKeyword").value.trim().toLocaleLowerCase();
  const openJobsOnly = document.getElementById("openJobsOnly").checked;
  const favoritesOnly = document.getElementById("favoritesOnly").checked;
  const followedOnly = document.getElementById("followedOnly").checked;
  const hideApplied = document.getElementById("hideAppliedJobs").checked;
  const capacityFilter = document.getElementById("capacityFilter").value;
  const categoryFilter = document.getElementById("jobCategoryFilter").value;
  const workDateFilter = document.getElementById("workDateFilter").value || legacySavedWorkDateFilter;
  updateJobFilterOptions();
  const locationFilter = document.getElementById("locationFilter").value;
  const selectedTags = Array.from(document.querySelectorAll('input[name="tagFilter"]:checked')).map(input => input.value);
  document.querySelectorAll("[data-quick-job-tag]").forEach(button => {
    const tag = button.dataset.quickJobTag;
    const selected = selectedTags.includes(tag);
    const available = cachedJobs.some(job => getNormalizedJobTags(job.tags).includes(tag));
    button.setAttribute("aria-pressed", String(selected));
    button.disabled = !available;
    button.classList.toggle("bg-blue-700", selected);
    button.classList.toggle("text-white", selected);
    button.classList.toggle("border-blue-700", selected);
    button.classList.toggle("bg-white", !selected);
    button.classList.toggle("text-blue-900", !selected);
    button.classList.toggle("opacity-50", !available);
  });
  const salaryTypeFilter = document.getElementById("salaryTypeFilter").value;
  const minimumSalary = Number(document.getElementById("minimumSalary").value) || 0;
  const seekerProfile = seekerProfileData;
  const sortSelect = document.getElementById("jobSort");
  const recommendedSortOption = sortSelect.querySelector('option[value="recommended"]');
  const hasSeekerPreferences = Boolean(seekerProfile && (
    String(seekerProfile.jobType || "").trim() ||
    String(seekerProfile.location || "").trim() ||
    seekerProfile.payType ||
    Number(seekerProfile.minimumSalary) > 0 ||
    (Array.isArray(seekerProfile.workPreferences) && seekerProfile.workPreferences.length > 0)
  ));
  const canRecommend = activeTab === "seeker" && hasSeekerPreferences;
  recommendedSortOption.disabled = !canRecommend;
  recommendedSortOption.textContent = canRecommend
    ? "おすすめ順"
    : activeTab === "seeker"
      ? "おすすめ順（希望条件登録後）"
      : "おすすめ順（ログイン時）";
  if (!canRecommend && sortSelect.value === "recommended") sortSelect.value = "newest";
  const sortBy = sortSelect.value;
  const preferredLocation = activeTab === "seeker" && seekerProfile ? seekerProfile.location || "" : "";
  const matchProfile = activeTab === "seeker" ? seekerProfile : null;

                    const filteredJobs = cachedJobs
    .filter(job =>
      jobMatchesKeyword(job, keyword) &&
      (!openJobsOnly || !isJobClosed(job)) &&
        (!favoritesOnly || isFavorite(job.id)) &&
        (!followedOnly || isFollowingEmployer(job.owner_id)) &&
        (!hideApplied || !getSeekerApplication(job.id)) &&
        (!capacityFilter || getCapacityOptionValue(job.capacity) === capacityFilter) &&
        (!categoryFilter || (job.category || "other") === categoryFilter) &&
        matchesJobWorkDate(job.work_date, workDateFilter) &&
        (!locationFilter || jobMatchesLocationFilter(job.location, locationFilter)) &&
        (!salaryTypeFilter || getJobPayType(job) === salaryTypeFilter) &&
        (!minimumSalary || (salaryTypeFilter && getJobPayAmount(job) >= minimumSalary)) &&
        (!selectedTags.length || selectedTags.some(tag => getNormalizedJobTags(job.tags).includes(tag))) &&
        (!currentUser || !blockedUserIds.includes(job.owner_id)) &&
        ((!isJobExpired(job) && !job.is_hidden) || (currentUser && job.owner_id === currentUser.id))
    )

    .sort((a, b) => {
      if (sortBy === "recommended" && matchProfile) {
        const matchDifference = getJobMatchScore(b, matchProfile) - getJobMatchScore(a, matchProfile);
        if (matchDifference !== 0) return matchDifference;
      }
      if (sortBy === "capacity") {
        const capacityDifference = getCapacitySortValue(a.capacity) - getCapacitySortValue(b.capacity);
        if (capacityDifference !== 0) return capacityDifference;
      }
      if (sortBy === "work_date") {
        const dateDifference = (a.work_date || "9999-12-31").localeCompare(b.work_date || "9999-12-31");
        if (dateDifference !== 0) return dateDifference;
      }
      if (sortBy === "salary") {
        const salaryDifference = getJobPayAmount(b) - getJobPayAmount(a);
        if (salaryDifference !== 0) return salaryDifference;
      }
      if (sortBy === "recommended") {
        if (preferredLocation) {
          const locationDifference = getLocationMatchScore(b.location, preferredLocation) - getLocationMatchScore(a.location, preferredLocation);
          if (locationDifference !== 0) return locationDifference;
        }
        if (selectedTags.length > 0) {
          const matchDifference = getTagMatchCount(b, selectedTags) - getTagMatchCount(a, selectedTags);
          if (matchDifference !== 0) return matchDifference;
        }
      }
      return compareJobsByNewest(a, b);
    });

  jobCount.innerText = `求人 ${filteredJobs.length}件`;
  const activeFilters = [
    keyword && `キーワード: ${keyword}`,
    openJobsOnly && "募集中のみ",
    favoritesOnly && "お気に入り",
    followedOnly && "フォロー中の掲載者",
    hideApplied && "応募済みを隠す",
    locationFilter && `勤務地: ${locationFilter}`,
    categoryFilter && `カテゴリ: ${getWorkCategoryLabel(categoryFilter)}`,
    workDateFilter && (workDateFilter === "today" ? "今日の仕事"
      : workDateFilter === "weekend" ? "今週末の仕事"
        : `作業日: ${formatWorkDate(workDateFilter)}`),
    capacityFilter && `募集人数: ${document.getElementById("capacityFilter").selectedOptions[0].text}`,
    salaryTypeFilter && `給与: ${document.getElementById("salaryTypeFilter").selectedOptions[0].text}`,
    minimumSalary && `最低給与: ${minimumSalary.toLocaleString()}円`,
    ...selectedTags.map(tag => `タグ: ${tag}`)
  ].filter(Boolean);
  document.getElementById("activeJobFilters").classList.toggle("hidden", activeFilters.length === 0);
  document.getElementById("activeJobFilterSummary").innerText = activeFilters.length
    ? `${activeFilters.length}件の条件で絞り込み中`
    : "";
  renderSavedSearches();

  if (filteredJobs.length === 0) {
    jobList.innerHTML = favoritesOnly
      ? `<div class="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
          <div class="text-3xl mb-3">⭐</div>
          <p class="text-sm text-gray-500">${currentUser
            ? `お気に入りのお仕事はありません。<br><button type="button" onclick="resetJobFilters()" class="mt-4 font-bold text-blue-600 underline">条件をリセット</button>`
            : `お気に入りを見るにはログインしてください。<br><button type="button" onclick="openAccountPanel()" class="mt-4 font-bold text-blue-600 underline">ログイン</button>`}</p>
        </div>`
      : `<div class="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-12 text-center shadow-sm">
          <div class="text-3xl mb-3">🔍</div>
          <p class="text-base font-bold text-gray-800">${activeFilters.length ? "条件に合うお仕事が見つかりませんでした" : "現在、掲載中のお仕事はありません"}</p>
          <p class="mt-2 text-sm text-gray-500">${activeFilters.length ? "条件をリセットして、ほかのお仕事も見てみましょう。" : "新しいお仕事が掲載されるまでお待ちください。"}</p>
          ${activeFilters.length ? '<button type="button" onclick="resetJobFilters()" class="mt-6 min-h-11 rounded-xl bg-blue-600 px-6 py-2.5 font-bold text-white hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all">検索条件をリセット</button>' : ""}
        </div>`;
    return;
  }

  const displayJobs = filteredJobs.slice(0, displayLimitJobs);

  jobList.innerHTML = displayJobs.map(job => {
    const matchDetails = matchProfile ? getJobMatchDetails(job, matchProfile) : null;
    const workPreferences = getWorkPreferenceLabels(job.work_preferences);
    const primaryImage = getJobImages(job)[0];
    const matchSummary = matchDetails
      ? `<div class="mt-4 rounded-lg ${matchDetails.score >= 11 ? "bg-emerald-50 text-emerald-900" : matchDetails.score >= 6 ? "bg-amber-50 text-amber-900" : "bg-gray-50 text-gray-700"} px-3 py-2 text-xs">
          <span class="font-bold">🎯 希望条件との一致 ${matchDetails.score}/14点</span>
          <span class="ml-1">${matchDetails.reasons.length
            ? `（${escapeHtml(matchDetails.reasons.join("・"))}）`
            : matchDetails.compared
              ? "（一致する項目なし）"
              : "（希望条件が未登録です）"}</span>
        </div>`
      : "";
    return `
    <article onclick="openModal(${job.id})" class="cursor-pointer group relative bg-white rounded-2xl border border-gray-100 p-5 transition-all hover:shadow-md hover:border-blue-200 sm:p-6 mb-4">
      ${primaryImage ? `<img src="${escapeHtml(primaryImage)}" alt="" loading="lazy" class="mb-4 aspect-[16/7] w-full rounded-xl bg-gray-100 object-cover">` : ""}
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
                        <div class="mb-3 flex flex-wrap gap-2">
            <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${isJobClosed(job) ? 'bg-gray-100 text-gray-500' : 'bg-emerald-50 text-emerald-700'}">${isJobClosed(job) ? '⛔ 募集終了' : '🟢 募集中'}</span>
            <span class="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-800">${escapeHtml(getWorkCategoryLabel(job.category))}</span>
            ${job.work_date ? `<span class="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-900">📅 ${escapeHtml(formatWorkDate(job.work_date))}</span>` : ""}
            ${job.moderation_status === "pending" ? '<span class="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-900">審査中・本人のみ表示</span>' : ""}
            ${job.moderation_status === "rejected" ? '<span class="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-bold text-red-800">審査結果を確認してください</span>' : ""}
            ${job.is_hidden ? '<span class="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-[10px] font-bold text-red-700">運営により非表示中</span>' : ''}
            ${renderAppliedBadge(job.id)}

            ${job.capacity <= 0 ? '' : `<span class="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 uppercase">👥 募集人数 ${formatJobCapacity(job.capacity)}</span>`}
          </div>
                                      <h3 class="break-words text-lg font-extrabold leading-tight text-gray-900 sm:text-xl group-hover:text-blue-700 transition-colors">${escapeHtml(job.title)}</h3>
          ${renderEmployerProfileSummary(job.owner_id)}
          ${job.moderation_status === "rejected" && job.owner_id === currentUser?.id && job.moderation_note ? `<p class="mt-2 text-xs text-red-700">審査メモ: ${escapeHtml(job.moderation_note)}</p>` : ""}
          <div class="flex items-center gap-2 mt-1">
            <p class="text-[10px] font-medium text-gray-400 uppercase tracking-widest">${escapeHtml(formatJobFreshness(job))}</p>
            ${renderRatingBadge(job.owner_id)}
          </div>
        </div>


        ${!PILOT_MODE ? `<button type="button" aria-label="${isFavorite(job.id) ? 'お気に入りから削除' : 'お気に入りに追加'}" aria-pressed="${isFavorite(job.id)}" onclick="event.stopPropagation(); toggleFavorite(${job.id})" class="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-100 bg-amber-50/50 text-xl text-amber-500 hover:bg-amber-100 hover:text-amber-600 transition-all" title="${isFavorite(job.id) ? 'お気に入りから削除' : 'お気に入りに追加'}">${isFavorite(job.id) ? '★' : '☆'}</button>` : ""}
      </div>
      <div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div class="flex items-center gap-3">
          <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500 text-sm">📍</div>
          <div class="min-w-0">
            <p class="text-[10px] font-bold text-gray-400 uppercase">勤務地</p>
            <p class="truncate text-sm font-bold text-gray-700">${job.location ? escapeHtml(job.location) : '詳細確認'}</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 text-sm">💰</div>
          <div class="min-w-0">
            <p class="text-[10px] font-bold text-emerald-600/50 uppercase">給与</p>
            <p class="truncate text-base font-black text-emerald-700">${escapeHtml(formatJobSalary(job))}</p>
          </div>
        </div>
      </div>
      ${matchSummary}
      ${workPreferences.length ? `<div class="mt-4 flex flex-wrap gap-1.5">${workPreferences.slice(0, 3).map(value => `<span class="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold text-indigo-800">${escapeHtml(value)}</span>`).join("")}${workPreferences.length > 3 ? `<span class="self-center text-[10px] text-gray-500">ほか${workPreferences.length - 3}件</span>` : ""}</div>` : ""}
      ${getNormalizedJobTags(job.tags).length ? `<div class="mt-2 flex flex-wrap gap-1.5">${getNormalizedJobTags(job.tags).slice(0, 3).map(tag => `<span class="rounded-lg bg-blue-50/50 px-2.5 py-1 text-[10px] font-bold text-blue-600 ring-1 ring-inset ring-blue-100/50">${escapeHtml(tag)}</span>`).join("")}${getNormalizedJobTags(job.tags).length > 3 ? `<span class="text-[10px] text-gray-500 self-center">ほか${getNormalizedJobTags(job.tags).length - 3}件</span>` : ''}</div>` : ''}
      <div class="mt-5 flex items-center justify-between pt-4">
         <div class="flex items-center text-xs font-bold text-blue-600">
           詳細を見る
           <svg class="ml-1 w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
         </div>
         ${activeTab === "employer" && currentUser && job.owner_id === currentUser.id ? `
          <div class="flex gap-2">
            <button onclick="event.stopPropagation(); editJob(${job.id})" class="px-3 py-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">編集</button>
            <button onclick="event.stopPropagation(); toggleJobClosed(${job.id})" class="px-3 py-1.5 text-[10px] font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">${job.is_closed ? '募集再開' : '募集終了'}</button>
          </div>
        ` : ""}
      </div>
    </article>
  `;
  }).join("");

  if (filteredJobs.length > displayLimitJobs) {
    const loadMoreBtn = document.createElement("button");
    loadMoreBtn.type = "button";
    loadMoreBtn.onclick = loadMoreJobs;
    loadMoreBtn.className = "w-full py-4 mt-4 bg-white border border-blue-100 text-blue-600 font-bold rounded-2xl hover:bg-blue-50 transition-colors shadow-sm";
    loadMoreBtn.innerText = `もっと見る (${filteredJobs.length - displayLimitJobs}件の残り)`;
    jobList.appendChild(loadMoreBtn);
  }
}

function getSeekerApplication(jobId) {
  if (!currentUser || accountType !== "seeker") return null;
  return accountApplications.find(application =>
    application.applicant_id === currentUser.id && String(application.job_id) === String(jobId)
  ) || null;
}

function renderAppliedBadge(jobId) {
  const application = getSeekerApplication(jobId);
  if (!application) return "";
  const label = application.status === "reviewed" ? "✅ 応募済み・お仕事確定"
    : application.status === "dismissed" ? "➖ 応募済み・見送り"
    : "📨 応募済み";
  return `<span class="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-bold text-sky-800">${label}</span>`;
}

function resetJobFilters() {
  displayLimitJobs = 10;
  document.getElementById("searchKeyword").value = "";
  document.getElementById("openJobsOnly").checked = false;
  document.getElementById("favoritesOnly").checked = false;
  document.getElementById("followedOnly").checked = false;
  document.getElementById("hideAppliedJobs").checked = false;
  document.getElementById("locationFilter").value = "";
  document.getElementById("capacityFilter").value = "";
  document.getElementById("jobCategoryFilter").value = "";
  document.getElementById("salaryTypeFilter").value = "";
  document.getElementById("minimumSalary").value = "";
  document.querySelectorAll('input[name="tagFilter"]').forEach(input => {
    input.checked = false;
  });
  document.getElementById("advancedJobFilters").open = false;
  document.getElementById("workDateFilter").value = "";
  legacySavedWorkDateFilter = "";
  renderJobList();
}

function setJobWorkDateFromInput() {
  legacySavedWorkDateFilter = "";
  renderJobList(true);
}

function matchesJobWorkDate(workDate, filter) {
  if (!filter || filter === "all") return true;
  if (!workDate) return false;
  if (filter === "today") return workDate === getLocalDateISO();
  if (filter === "weekend") {
    const today = new Date();
    if (today.getDay() === 0) return workDate === getLocalDateISO();
    const saturday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    saturday.setDate(saturday.getDate() + ((6 - today.getDay() + 7) % 7));
    const sunday = new Date(saturday.getFullYear(), saturday.getMonth(), saturday.getDate() + 1);
    return workDate === getLocalDateISO(saturday) || workDate === getLocalDateISO(sunday);
  }
  return workDate === filter;
}

function toggleQuickJobTag(tag) {
  displayLimitJobs = 10;
  const checkbox = Array.from(document.querySelectorAll('input[name="tagFilter"]'))
    .find(input => input.value === tag);
  if (!checkbox) return;
  checkbox.checked = !checkbox.checked;
  renderJobList();
}

function isJobClosed(job) {
  return Boolean(job.is_closed || job.capacity <= 0 || isJobExpired(job));
}

function getTagMatchCount(job, selectedTags) {
  const jobTags = getNormalizedJobTags(job.tags);
  return selectedTags.filter(tag => jobTags.includes(tag)).length;
}

function jobMatchesLocationFilter(jobLocation, selectedLocation) {
  const selectedArea = selectedLocation.replace(/\s+/g, "").toLocaleLowerCase();
  const selectedPrefecture = getPrefecture(selectedLocation);
  return getLocationPreferenceEntries(jobLocation).some(jobArea => {
    const selectedLocal = getLocalLocation(selectedLocation);
    const jobLocal = getLocalLocation(jobArea);
    if (selectedLocal && jobLocal) {
      return selectedLocal.city === jobLocal.city &&
        (!selectedLocal.area || !jobLocal.area || selectedLocal.area === jobLocal.area);
    }
    const normalizedJobArea = jobArea.replace(/\s+/g, "").toLocaleLowerCase();
    if (normalizedJobArea === selectedArea ||
        normalizedJobArea.includes(selectedArea) ||
        selectedArea.includes(normalizedJobArea)) {
      return true;
    }

    const jobPrefecture = getPrefecture(jobArea);
    const isJobPrefectureOnly = jobPrefecture &&
      normalizedJobArea === jobPrefecture.toLocaleLowerCase();
    const isSelectedPrefectureOnly = selectedPrefecture &&
      selectedArea === selectedPrefecture.toLocaleLowerCase();
    return Boolean(
      selectedPrefecture &&
      selectedPrefecture === jobPrefecture &&
      (isJobPrefectureOnly || isSelectedPrefectureOnly)
    );
  });
}

function updateJobFilterOptions() {
  const locationSelect = document.getElementById("locationFilter");
  const previousLocation = locationSelect.value;
  const locations = cachedJobs.flatMap(job => getLocationPreferenceEntries(job.location));
  populateLocationFilter(locationSelect, locations, previousLocation);

  const tagOptions = document.getElementById("tagFilterOptions");
  const previousTags = new Set(
    Array.from(tagOptions.querySelectorAll('input[name="tagFilter"]:checked')).map(input => input.value)
  );
  const tags = [...new Set(cachedJobs.flatMap(job => getNormalizedJobTags(job.tags)))]
    .sort((a, b) => a.localeCompare(b, "ja"));
  tagOptions.replaceChildren();
  if (tags.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "text-xs text-gray-400";
    emptyMessage.textContent = "選択できるタグはありません。";
    tagOptions.append(emptyMessage);
    return;
  }

  tags.forEach((tag, index) => {
    const label = document.createElement("label");
    label.className = "flex items-center gap-2 py-1 cursor-pointer";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "tagFilter";
    checkbox.value = tag;
    checkbox.checked = previousTags.has(tag);
    checkbox.className = "rounded text-blue-600 focus:ring-blue-500";
    checkbox.onchange = renderJobList;

    const text = document.createElement("span");
    text.textContent = tag;
    label.htmlFor = `tagFilter-${index}`;
    checkbox.id = `tagFilter-${index}`;
    label.append(checkbox, text);
    tagOptions.append(label);
  });
}

// モーダル表示
function openModal(id) {
  selectedJob = cachedJobs.find(j => String(j.id) === String(id));
  if (!selectedJob) return;

  const riskyContent = [
    selectedJob.title,
    selectedJob.location,
    selectedJob.salary,
    selectedJob.duties,
    selectedJob.pay_condition_details,
    selectedJob.allowance_details
  ].join("\n");
  const safetyWarnings = getSuspiciousContentWarnings(riskyContent);
  const safetyKey = String(selectedJob.id);
  if (safetyWarnings.length && !warnedJobSafetyIds.has(safetyKey)) {
    warnedJobSafetyIds.add(safetyKey);
    window.alert(`安全確認: ${safetyWarnings.join("・")}に関する表現があります。口座の貸し借りや外部連絡先への誘導には応じず、条件に不安があれば応募せず運営へ通報してください。`);
  }

  clearJobReportWidget();
  recordJobView(selectedJob);
  const alreadyApplied = Boolean(currentUser && accountApplications.some(application =>
    application.applicant_id === currentUser.id && application.job_id === String(selectedJob.id)
  ));
  const selectedJobIsClosed = isJobClosed(selectedJob);
  const isSeekerAccount = Boolean(currentUser && accountType === "seeker");
  const canApply = Boolean(isSeekerAccount && !selectedJobIsClosed &&
    (!selectedJob.moderation_status || selectedJob.moderation_status === "approved") &&
    selectedJob.owner_id !== currentUser.id && !alreadyApplied);
  const continueButton = document.getElementById("applicationContinueButton");
  continueButton.classList.toggle("hidden", !canApply);
  continueButton.href = `/apply.html?jobId=${encodeURIComponent(String(selectedJob.id))}`;
  document.getElementById("applicationLoginPrompt").classList.toggle("hidden", canApply);
  document.getElementById("applicationLoginButton").classList.toggle("hidden",
    canApply || accountType === "employer" || selectedJobIsClosed ||
    selectedJob.owner_id === currentUser?.id || alreadyApplied);
  document.getElementById("applicationLoginButton").innerText = currentUser
    ? "アカウント画面を開く"
    : "ログイン";
  if (!currentUser) {
    document.getElementById("applicationLoginPrompt").innerText = "応募画面に進むには、お仕事探しアカウントでログインしてください。";
  } else if (accountType !== "seeker") {
    document.getElementById("applicationLoginPrompt").innerText = "サイトから応募するにはお仕事探しアカウントが必要です。別のお仕事探しアカウントでログインしてください。";
  } else if (selectedJob.owner_id === currentUser.id) {
    document.getElementById("applicationLoginPrompt").innerText = "自分が投稿したお仕事には応募できません。";
  } else if (selectedJobIsClosed) {
    document.getElementById("applicationLoginPrompt").innerText = "募集が終了しているため、サイトから応募できません。";
  } else if (selectedJob.moderation_status === "pending") {
    document.getElementById("applicationLoginPrompt").innerText = "このお仕事は審査中のため、公開・応募を受け付けていません。";
  } else if (selectedJob.moderation_status === "rejected") {
    document.getElementById("applicationLoginPrompt").innerText = "このお仕事は公開されていません。";
  } else if (alreadyApplied) {
    document.getElementById("applicationLoginPrompt").innerText = "このお仕事にはすでにサイトから応募済みです。応募履歴はマイページで確認できます。";
  }
  document.getElementById("jobReportForm").classList.add("hidden");
  document.getElementById("jobReportButton").classList.remove("hidden");
  document.getElementById("jobReportSuccess").classList.add("hidden");
  document.getElementById("jobReportReason").value = "";
  document.getElementById("jobReportDetails").value = "";
  document.getElementById("jobReportSubmitButton").disabled = true;
  setJobReportStatus("通報するには確認を完了してください。");
  document.getElementById("modalTitle").innerText = selectedJob.title;
  document.getElementById("modalEmployerProfile").innerHTML = renderEmployerProfileDetails(selectedJob.owner_id);
  const imageGallery = document.getElementById("modalJobImages");
  imageGallery.innerHTML = renderJobImageGallery(selectedJob);
  imageGallery.classList.toggle("hidden", getJobImages(selectedJob).length === 0);
  document.getElementById("modalJobFreshness").innerText = formatJobFreshness(selectedJob);
  document.getElementById("modalLocation").innerText = selectedJob.location ? `📍 ${selectedJob.location}` : "";
  document.getElementById("modalSalary").innerText = formatJobSalary(selectedJob);
  document.getElementById("modalCapacity").innerText = `募集人数: ${formatJobCapacity(selectedJob.capacity)}`;
  document.getElementById("modalCapacity").classList.toggle("hidden", selectedJob.capacity <= 0);
  document.getElementById("modalDuties").innerText = selectedJob.duties || "特記事項なし";
  const workConditions = [];
  workConditions.push(`<p><span class="font-bold">作業カテゴリ:</span> ${escapeHtml(getWorkCategoryLabel(selectedJob.category))}</p>`);
  if (selectedJob.work_date) {
    workConditions.push(`<p><span class="font-bold">作業日:</span> ${escapeHtml(formatWorkDate(selectedJob.work_date))}</p>`);
  }
  workConditions.push(`<p><span class="font-bold">支払い方法:</span> ${escapeHtml(getPaymentMethodLabel(selectedJob.payment_method))}</p>`);
  const startTime = selectedJob.start_time ? String(selectedJob.start_time).slice(0, 5) : "";
  const endTime = selectedJob.end_time ? String(selectedJob.end_time).slice(0, 5) : "";
  if (startTime || endTime) {
    workConditions.push(`<p><span class="font-bold">勤務時間:</span> ${escapeHtml(startTime || "未設定")}〜${escapeHtml(endTime || "未設定")}</p>`);
  }
  if (selectedJob.break_minutes !== null && selectedJob.break_minutes !== undefined) {
    workConditions.push(`<p><span class="font-bold">休憩:</span> ${escapeHtml(String(selectedJob.break_minutes))}分</p>`);
  }
  if (selectedJob.overtime_details) {
    workConditions.push(`<p><span class="font-bold">残業の目安:</span> ${escapeHtml(String(selectedJob.overtime_details))}</p>`);
  }
  if (selectedJob.allowance_details) {
    workConditions.push(`<p class="whitespace-pre-wrap"><span class="font-bold">手当・待遇:</span> ${escapeHtml(String(selectedJob.allowance_details))}</p>`);
  }
  if (selectedJob.pay_condition_details) {
    workConditions.push(`<p class="whitespace-pre-wrap"><span class="font-bold">給与の支給条件:</span> ${escapeHtml(String(selectedJob.pay_condition_details))}</p>`);
  }
  document.getElementById("modalWorkConditionsContent").innerHTML = workConditions.join("");
  document.getElementById("modalWorkConditions").classList.toggle("hidden", workConditions.length === 0);

  const requirementDetails = [];
  const requiredLicenses = Array.isArray(selectedJob.required_licenses)
    ? [...new Set(selectedJob.required_licenses)]
    : [];
  const requiredLicenseSet = new Set(requiredLicenses);
  const preferredLicenses = Array.isArray(selectedJob.preferred_licenses)
    ? [...new Set(selectedJob.preferred_licenses)].filter(license => !requiredLicenseSet.has(license))
    : [];
  if (requiredLicenses.length) {
    requirementDetails.push(`<p><span class="font-bold">必須資格:</span> ${requiredLicenses.map(escapeHtml).join("、")}</p>`);
  }
  if (preferredLicenses.length) {
    requirementDetails.push(`<p><span class="font-bold">歓迎資格:</span> ${preferredLicenses.map(escapeHtml).join("、")}</p>`);
  }
  if (selectedJob.experience_requirement === "required") {
    requirementDetails.push('<p><span class="font-bold">実務経験:</span> 必須</p>');
  } else if (selectedJob.experience_requirement === "preferred") {
    requirementDetails.push('<p><span class="font-bold">実務経験:</span> 経験者歓迎（未経験可）</p>');
  }
  if (selectedJob.experience_requirement_details) {
    requirementDetails.push(`<p class="whitespace-pre-wrap"><span class="font-bold">経験の詳細:</span> ${escapeHtml(String(selectedJob.experience_requirement_details))}</p>`);
  }
  document.getElementById("modalApplicationRequirementsContent").innerHTML = requirementDetails.join("");
  document.getElementById("modalApplicationRequirements").classList.toggle("hidden", requirementDetails.length === 0);
  document.getElementById("modalClosed").classList.toggle("hidden", !selectedJobIsClosed);
  updateModalFavoriteButton();
  updateModalFollowButton();

  const tagsContainer = document.getElementById("modalTags");
  tagsContainer.innerHTML = getNormalizedJobTags(selectedJob.tags).map(tag => `<span class="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded font-bold">${escapeHtml(tag)}</span>`).join("");

  const modal = document.getElementById("jobModal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  document.getElementById("jobModalContent").scrollTop = 0;
}

const viewedJobIds = new Set();
let jobViewCounts = new Map();

function recordJobView(job) {
  const key = String(job.id);
  if (viewedJobIds.has(key) || job.owner_id === currentUser?.id) return;
  viewedJobIds.add(key);
  supabaseClient.rpc("record_job_view", { p_job_id: job.id }).then(({ error }) => {
    if (error) console.error("閲覧数を記録できませんでした:", error);
  });
}

async function loadJobViewCounts() {
  if (!currentUser || accountType !== "employer") {
    jobViewCounts = new Map();
    return;
  }
  const userId = currentUser.id;
  const { data, error } = await supabaseClient.from("job_view_counts").select("job_id, view_count");
  if (currentUser?.id !== userId) return;
  if (error) {
    console.error("閲覧数を読み込めませんでした:", error);
    return;
  }
  jobViewCounts = new Map((data || []).map(row => [String(row.job_id), row.view_count]));
  renderEmployerDashboard();
}

function getJobShareUrl(job) {
  return `${location.origin}/?job=${encodeURIComponent(String(job.id))}`;
}

function shareJobToLine() {
  if (PILOT_MODE) {
    alert("テスト運用中は募集の共有ボタンを利用できません。");
    return;
  }
  if (!selectedJob) return;
  const text = `${selectedJob.title}${selectedJob.location ? `（${selectedJob.location}）` : ""}\n${getJobShareUrl(selectedJob)}`;
  window.open(`https://line.me/R/share?text=${encodeURIComponent(text)}`, "_blank", "noopener");
}

async function copyJobLink() {
  if (PILOT_MODE) {
    alert("テスト運用中は募集の共有ボタンを利用できません。");
    return;
  }
  if (!selectedJob) return;
  const button = document.getElementById("modalCopyLinkButton");
  try {
    await navigator.clipboard.writeText(getJobShareUrl(selectedJob));
    button.innerText = "コピーしました";
  } catch {
    window.prompt("このリンクをコピーしてください", getJobShareUrl(selectedJob));
  }
  setTimeout(() => { button.innerText = "リンクをコピー"; }, 2000);
}

function formatJobSalary(job) {
  const payTypeLabels = { hourly: "時給", daily: "日給", monthly: "月給" };
  const payType = getJobPayType(job);
  const minimum = Number(job.pay_amount) || 0;
  const maximum = Number(job.pay_amount_max) || 0;
  if (payType && (minimum > 0 || maximum > 0)) {
    const range = minimum > 0
      ? `${minimum.toLocaleString()}円${maximum > 0 ? `〜${maximum.toLocaleString()}円` : "〜"}`
      : `〜${maximum.toLocaleString()}円`;
    return `${payTypeLabels[payType]} ${range}`;
  }
  return job.salary || "給与応相談";
}

async function generateAIDuties() {
  const title = document.getElementById("jobTitle").value.trim();
  const status = document.getElementById("aiStatus");
  if (!title) {
    alert("先に募集タイトルを入力してください。AIがタイトルを元に作業内容の案を作ります。");
    return;
  }
  status.innerText = "✨ AIが魅力的な文章を考えています...";
  status.classList.remove("hidden");
  try {
    const response = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: `${title}のお仕事を募集しています。親しみやすく誠実な印象で、作業内容や場所の特徴を200文字程度で作成してください。「未経験歓迎」「丁寧に説明します」などの要素を含めてください。募集タイトルから分からない条件は創作せず、箇条書きではなく自然な文章にしてください。`
      })
    });
    const data = await response.json();
    if (data.result) {
      const textarea = document.getElementById("jobDuties");
      textarea.value = data.result;
      status.innerText = "✨ AIが文章を作成しました！必要に応じて修正してください。";
      setTimeout(() => status.classList.add("hidden"), 3000);
    } else {
      throw new Error(data.error || "返答がありませんでした。");
    }
  } catch (error) {
    console.error("AI生成エラー:", error);
    status.innerText = "❌ AI文章の作成に失敗しました。時間をおいて再度お試しください。";
  }
}

function closeModal() {
  const modal = document.getElementById("jobModal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  clearJobReportWidget();
  selectedJob = null;
}

function isFavorite(jobId) {
  return favoriteJobIds.includes(String(jobId));
}

    async function toggleFavorite(jobId) {
  if (!currentUser) {
    promptLogin("お気に入りを保存するにはログインしてください。");
    return;
  }

  const normalizedId = String(jobId);
  const favorited = isFavorite(normalizedId);
  const { error } = favorited
    ? await supabaseClient.from("job_favorites").delete().eq("user_id", currentUser.id).eq("job_id", normalizedId)
    : await supabaseClient.from("job_favorites").insert({ user_id: currentUser.id, job_id: normalizedId });

  if (error) {
    alert(`お気に入りの更新に失敗しました: ${error.message}`);
    return;
  }

  // お気に入り状態をローカルで即座に反映（フィードバック用）
  if (favorited) {
    favoriteJobIds = favoriteJobIds.filter(id => id !== normalizedId);
  } else {
    favoriteJobIds.push(normalizedId);
  }

  renderJobList();
  updateModalFavoriteButton();

  // 実際にはバックグラウンドで再読み込みして整合性を取る
  loadAccountData(currentUser);
}

function isFollowingEmployer(employerId) {
  return followedEmployerIds.includes(String(employerId));
}

async function toggleFollowEmployer(employerId) {
  if (!currentUser) {
    promptLogin("掲載者をフォローするにはログインしてください。");
    return;
  }
  if (accountType !== "seeker" || !employerId || employerId === currentUser.id) return;
  const id = String(employerId);
  const following = isFollowingEmployer(id);
  const { error } = following
    ? await supabaseClient.from("employer_follows").delete().eq("user_id", currentUser.id).eq("employer_id", id)
    : await supabaseClient.from("employer_follows").insert({ user_id: currentUser.id, employer_id: id });
  if (error) {
    alert(`フォローの更新に失敗しました: ${error.message}`);
    return;
  }
  followedEmployerIds = following ? followedEmployerIds.filter(value => value !== id) : [...followedEmployerIds, id];
  renderJobList();
  updateModalFollowButton();
  if (typeof renderAccountDashboard === "function") renderAccountDashboard();
}

function updateModalFollowButton() {
  const button = document.getElementById("modalFollowButton");
  if (!button) return;
  const visible = Boolean(!PILOT_MODE && selectedJob && currentUser && accountType === "seeker" && selectedJob.owner_id !== currentUser.id);
  button.classList.toggle("hidden", !visible);
  if (!visible) return;
  const following = isFollowingEmployer(selectedJob.owner_id);
  button.innerText = following ? "✓ この掲載者をフォロー中（解除）" : "＋ この掲載者をフォロー";
  button.setAttribute("aria-pressed", String(following));
}

function updateModalFavoriteButton() {
  const button = document.getElementById("modalFavoriteButton");
  if (!button || !selectedJob) return;
  const favorited = isFavorite(selectedJob.id);
  button.innerText = favorited ? "★ お気に入りから削除" : "☆ お気に入りに追加";
  button.setAttribute("aria-pressed", String(favorited));
}

function formatJobCapacity(capacity) {
  const count = Number.parseInt(capacity, 10);
  if (Number.isFinite(count) && count <= 0) return "募集終了";
  if (!Number.isFinite(count)) return "1〜3名（少人数・ピンポイント）";
  if (count <= 3) return "1〜3名（少人数・ピンポイント）";
  if (count <= 6) return "4〜6名（チーム・中規模）";
  if (count <= 10) return "7〜10名（大規模）";
  return "11名以上（超大型・大量募集）";
}

function getCapacityOptionValue(capacity) {
  const count = Number.parseInt(capacity, 10);
  if (Number.isFinite(count) && count <= 0) return "";
  if (!Number.isFinite(count) || count <= 3) return "1";
  if (count <= 6) return "4";
  if (count <= 10) return "7";
  return "11";
}

function getCapacitySortValue(capacity) {
  const count = Number.parseInt(capacity, 10);
  return Number.isFinite(count) && count > 0 ? count : 1;
}

function getJobPayType(job) {
  if (["hourly", "daily", "monthly"].includes(job.pay_type)) return job.pay_type;
  const salary = String(job.salary || "");
  if (/時給|時間給/.test(salary)) return "hourly";
  if (/日給|日額/.test(salary)) return "daily";
  if (/月給|月額/.test(salary)) return "monthly";
  return "";
}

function getJobPayAmount(job) {
  const amount = Number(job.pay_amount);
  if (Number.isFinite(amount) && amount > 0) return amount;
  return getSalaryAmount(job.salary);
}

function getLocationMatchScore(jobLocation, preferredLocation) {
  const jobAreas = getLocationPreferenceEntries(jobLocation);
  const preferredAreas = getLocationPreferenceEntries(preferredLocation);
  return preferredAreas.reduce((bestScore, preferredArea) => {
    const matchedScore = jobAreas.reduce((areaScore, jobArea) => {
      const normalizedJobArea = jobArea.replace(/\s+/g, "").toLocaleLowerCase();
      const normalizedPreferredArea = preferredArea.replace(/\s+/g, "").toLocaleLowerCase();
      const preferredPrefecture = getPrefecture(preferredArea);
      const isPrefectureOnly = preferredPrefecture &&
        normalizedPreferredArea === preferredPrefecture.toLocaleLowerCase();
      if (normalizedJobArea.includes(normalizedPreferredArea)) {
        return Math.max(areaScore, isPrefectureOnly ? 1 : 2);
      }
      if (normalizedPreferredArea.includes(normalizedJobArea)) {
        return Math.max(areaScore, 1);
      }
      return preferredPrefecture && preferredPrefecture === getPrefecture(jobArea)
        ? Math.max(areaScore, 1)
        : areaScore;
    }, 0);
    return Math.max(bestScore, matchedScore);
  }, 0);
}

function getJobMatchScore(job, profile) {
  return getJobMatchDetails(job, profile).score;
}

function getJobMatchDetails(job, profile) {
  let score = 0;
  let compared = 0;
  const reasons = [];
  const preferredJobTypes = String(profile.jobType || "")
    .split(/[,、，]/)
    .map(jobType => jobType.trim().toLocaleLowerCase())
    .filter(Boolean);
  const jobDescription = `${job.title || ""} ${job.duties || ""}`.toLocaleLowerCase();
  if (preferredJobTypes.length) {
    compared += 1;
    if (preferredJobTypes.some(jobType => jobDescription.includes(jobType))) {
      score += 4;
      reasons.push("希望する仕事が一致");
    }
  }

  if (String(profile.location || "").trim() && String(job.location || "").trim()) {
    compared += 1;
    const locationScore = getLocationMatchScore(job.location, profile.location);
    score += locationScore * 2;
    if (locationScore === 2) reasons.push("希望勤務地が一致");
    else if (locationScore === 1) reasons.push("希望都道府県が一致");
  }

  if (profile.payType && getJobPayType(job)) {
    compared += 1;
    if (getJobPayType(job) === profile.payType) {
      score += 1;
      reasons.push("希望給与区分が一致");
    }
  }
  if (Number(profile.minimumSalary) > 0 && getJobPayAmount(job) > 0) {
    compared += 1;
    if (getJobPayAmount(job) >= Number(profile.minimumSalary)) {
      score += 1;
      reasons.push("お仕事の給与が希望最低額以上");
    }
  }
  const workMatch = getWorkPreferenceMatch(job.work_preferences, profile.workPreferences);
  score += workMatch.score;
  compared += workMatch.maximumScore > 0 ? 1 : 0;
  reasons.push(...workMatch.reasons);
  return { score, compared, reasons };
}

function getPrefecture(location) {
  const prefectures = [
    "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
    "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
    "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
    "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
    "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
    "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
    "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"
  ];
  return prefectures.find(prefecture => location.includes(prefecture)) || "";
}

function getSalaryAmount(salary) {
  const normalizedSalary = String(salary || "").replace(/,/g, "");
  const match = normalizedSalary.match(/(\d+(?:\.\d+)?)\s*(万|千)?/);
  if (!match) return -1;

  const multiplier = match[2] === "万" ? 10000 : match[2] === "千" ? 1000 : 1;
  return Number(match[1]) * multiplier;
}

function compareJobsByNewest(a, b) {
  const aDate = Date.parse(a.created_at || "");
  const bDate = Date.parse(b.created_at || "");
  if (Number.isFinite(aDate) && Number.isFinite(bDate) && aDate !== bDate) {
    return bDate - aDate;
  }

  const aId = Number(a.id);
  const bId = Number(b.id);
  if (Number.isFinite(aId) && Number.isFinite(bId)) return bId - aId;
  return String(b.id).localeCompare(String(a.id));
}

function loadMoreJobs() {
  displayLimitJobs += 10;
  renderJobList();
}
