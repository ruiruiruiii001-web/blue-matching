function renderJobList(resetLimit = false) {
  if (resetLimit === true) displayLimitJobs = 10;
  const jobList = document.getElementById("jobList");
  const jobCount = document.getElementById("jobCount");
  const keyword = document.getElementById("searchKeyword").value.toLowerCase();
  const openJobsOnly = document.getElementById("openJobsOnly").checked;
  const favoritesOnly = document.getElementById("favoritesOnly").checked;
  const capacityFilter = document.getElementById("capacityFilter").value;
  updateJobFilterOptions();
  const locationFilter = document.getElementById("locationFilter").value;
  const selectedTags = Array.from(document.querySelectorAll('input[name="tagFilter"]:checked')).map(input => input.value);
  document.querySelectorAll("[data-quick-job-tag]").forEach(button => {
    const tag = button.dataset.quickJobTag;
    const selected = selectedTags.includes(tag);
    const available = cachedJobs.some(job => Array.isArray(job.tags) && job.tags.includes(tag));
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
  const sortBy = document.getElementById("jobSort").value;
  const seekerProfile = seekerProfileData;
  const preferredLocation = activeTab === "seeker" && seekerProfile ? seekerProfile.location || "" : "";
  const matchProfile = activeTab === "seeker" ? seekerProfile : null;

                    const filteredJobs = cachedJobs
    .filter(job =>
      (!keyword ||
        (job.title || "").toLowerCase().includes(keyword) ||
        (job.location || "").toLowerCase().includes(keyword) ||
        (job.tags && job.tags.some(t => t.toLowerCase().includes(keyword)))) &&
      (!openJobsOnly || !isJobClosed(job)) &&
        (!favoritesOnly || isFavorite(job.id)) &&
        (!capacityFilter || getCapacityOptionValue(job.capacity) === capacityFilter) &&
        (!locationFilter || (job.location || "").trim() === locationFilter) &&
        (!salaryTypeFilter || getJobPayType(job) === salaryTypeFilter) &&
        (!minimumSalary || (salaryTypeFilter && getJobPayAmount(job) >= minimumSalary)) &&
        (!selectedTags.length || (Array.isArray(job.tags) && selectedTags.some(tag => job.tags.includes(tag)))) &&
        (!currentUser || !blockedUserIds.includes(job.owner_id))
    )

    .sort((a, b) => {
      if (sortBy === "recommended" && matchProfile) {
        const matchDifference = getJobMatchScore(b, matchProfile) - getJobMatchScore(a, matchProfile);
        if (matchDifference !== 0) return matchDifference;
      }
      if (preferredLocation) {
        const locationDifference = getLocationMatchScore(b.location, preferredLocation) - getLocationMatchScore(a.location, preferredLocation);
        if (locationDifference !== 0) return locationDifference;
      }
      if (selectedTags.length > 0) {
        const matchDifference = getTagMatchCount(b, selectedTags) - getTagMatchCount(a, selectedTags);
        if (matchDifference !== 0) return matchDifference;
      }
      if (sortBy === "capacity") {
        const capacityDifference = getCapacitySortValue(a.capacity) - getCapacitySortValue(b.capacity);
        if (capacityDifference !== 0) return capacityDifference;
      }
      if (sortBy === "salary") {
        const salaryDifference = getJobPayAmount(b) - getJobPayAmount(a);
        if (salaryDifference !== 0) return salaryDifference;
      }
      return compareJobsByNewest(a, b);
    });

  jobCount.innerText = `${filteredJobs.length}件`;
  const activeFilters = [
    keyword && `キーワード: ${keyword}`,
    openJobsOnly && "募集中のみ",
    favoritesOnly && "お気に入り",
    locationFilter && `勤務地: ${locationFilter}`,
    capacityFilter && `募集人数: ${document.getElementById("capacityFilter").selectedOptions[0].text}`,
    salaryTypeFilter && `給与: ${document.getElementById("salaryTypeFilter").selectedOptions[0].text}`,
    minimumSalary && `最低給与: ${minimumSalary.toLocaleString()}円`,
    ...selectedTags.map(tag => `タグ: ${tag}`)
  ].filter(Boolean);
  document.getElementById("activeJobFilters").classList.toggle("hidden", activeFilters.length === 0);
  document.getElementById("activeJobFilterSummary").innerText = activeFilters.length
    ? `${activeFilters.length}件の条件で絞り込み中`
    : "";

  if (filteredJobs.length === 0) {
    jobList.innerHTML = favoritesOnly
      ? `<div class="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
          <div class="text-3xl mb-3">⭐</div>
          <p class="text-sm text-gray-500">${currentUser
            ? `お気に入りの求人はありません。<br><button type="button" onclick="resetJobFilters()" class="mt-4 font-bold text-blue-600 underline">条件をリセット</button>`
            : `お気に入りを見るにはログインしてください。<br><button type="button" onclick="openAccountPanel()" class="mt-4 font-bold text-blue-600 underline">ログイン / 新規登録</button>`}</p>
        </div>`
      : `<div class="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-12 text-center shadow-sm">
          <div class="text-3xl mb-3">🔍</div>
          <p class="text-base font-bold text-gray-800">${activeFilters.length ? "条件に合う求人が見つかりませんでした" : "現在、掲載中の求人はありません"}</p>
          <p class="mt-2 text-sm text-gray-500">${activeFilters.length ? "条件をリセットして、ほかの求人も見てみましょう。" : "新しい求人が掲載されるまでお待ちください。"}</p>
          ${activeFilters.length ? '<button type="button" onclick="resetJobFilters()" class="mt-6 min-h-11 rounded-xl bg-blue-600 px-6 py-2.5 font-bold text-white hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all">検索条件をリセット</button>' : ""}
        </div>`;
    return;
  }

  const displayJobs = filteredJobs.slice(0, displayLimitJobs);

  jobList.innerHTML = displayJobs.map(job => `
    <article onclick="openModal(${job.id})" class="cursor-pointer group relative bg-white rounded-2xl border border-gray-100 p-5 transition-all hover:shadow-md hover:border-blue-200 sm:p-6 mb-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
                        <div class="mb-3 flex flex-wrap gap-2">
            <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${job.work_style === 'short' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}">${job.work_style === 'short' ? '⚡ 単発・短期' : '🤝 常用・正社員'}</span>
            <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${isJobClosed(job) ? 'bg-gray-100 text-gray-500' : 'bg-emerald-50 text-emerald-700'}">${isJobClosed(job) ? '募集終了' : '募集中'}</span>

            ${job.capacity <= 0 ? '' : `<span class="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 uppercase">募集人数 ${formatJobCapacity(job.capacity)}</span>`}
            ${matchProfile && getJobMatchScore(job, matchProfile) > 0 ? '<span class="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-0.5 text-[10px] font-bold text-purple-700 uppercase">希望条件に一致</span>' : ''}
          </div>
                                      <h3 class="break-words text-lg font-extrabold leading-tight text-gray-900 sm:text-xl group-hover:text-blue-700 transition-colors">${escapeHtml(job.title)}</h3>
          <div class="flex items-center gap-2 mt-1">
            <p class="text-[10px] font-medium text-gray-400 uppercase tracking-widest">${escapeHtml(formatJobFreshness(job))}</p>
            ${renderRatingBadge(job.owner_id)}
          </div>
        </div>


        <button type="button" aria-label="${isFavorite(job.id) ? 'お気に入りから削除' : 'お気に入りに追加'}" aria-pressed="${isFavorite(job.id)}" onclick="event.stopPropagation(); toggleFavorite(${job.id})" class="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-100 bg-amber-50/50 text-xl text-amber-500 hover:bg-amber-100 hover:text-amber-600 transition-all" title="${isFavorite(job.id) ? 'お気に入りから削除' : 'お気に入りに追加'}">${isFavorite(job.id) ? '★' : '☆'}</button>
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
            <p class="truncate text-base font-black text-emerald-700">${escapeHtml(job.salary || '給与応相談')}</p>
          </div>
        </div>
      </div>
      ${Array.isArray(job.tags) && job.tags.length ? `<div class="mt-5 flex flex-wrap gap-1.5">${job.tags.slice(0, 5).map(tag => `<span class="rounded-lg bg-blue-50/50 px-2.5 py-1 text-[10px] font-bold text-blue-600 ring-1 ring-inset ring-blue-100/50">${escapeHtml(tag)}</span>`).join("")}${job.tags.length > 5 ? '<span class="text-[10px] text-gray-400 self-center">...</span>' : ''}</div>` : ''}
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
  `).join("");

  if (filteredJobs.length > displayLimitJobs) {
    const loadMoreBtn = document.createElement("button");
    loadMoreBtn.type = "button";
    loadMoreBtn.onclick = loadMoreJobs;
    loadMoreBtn.className = "w-full py-4 mt-4 bg-white border border-blue-100 text-blue-600 font-bold rounded-2xl hover:bg-blue-50 transition-colors shadow-sm";
    loadMoreBtn.innerText = `もっと求人を見る (${filteredJobs.length - displayLimitJobs}件の残り)`;
    jobList.appendChild(loadMoreBtn);
  }
}

function resetJobFilters() {
  displayLimitJobs = 10;
  document.getElementById("searchKeyword").value = "";
  document.getElementById("openJobsOnly").checked = false;
  document.getElementById("favoritesOnly").checked = false;
  document.getElementById("locationFilter").value = "";
  document.getElementById("capacityFilter").value = "";
  document.getElementById("salaryTypeFilter").value = "";
  document.getElementById("minimumSalary").value = "";
  document.querySelectorAll('input[name="tagFilter"]').forEach(input => {
    input.checked = false;
  });
  document.getElementById("advancedJobFilters").open = false;
  renderJobList();
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
  return Boolean(job.is_closed || job.capacity <= 0);
}

function getTagMatchCount(job, selectedTags) {
  if (!Array.isArray(job.tags)) return 0;
  return selectedTags.filter(tag => job.tags.includes(tag)).length;
}

function updateJobFilterOptions() {
  const locationSelect = document.getElementById("locationFilter");
  const previousLocation = locationSelect.value;
  const locations = [...new Set(cachedJobs.map(job => (job.location || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "ja"));
  locationSelect.replaceChildren(new Option("すべての勤務地", ""));
  locations.forEach(location => locationSelect.add(new Option(location, location)));
  locationSelect.value = locations.includes(previousLocation) ? previousLocation : "";

  const tagOptions = document.getElementById("tagFilterOptions");
  const previousTags = new Set(
    Array.from(tagOptions.querySelectorAll('input[name="tagFilter"]:checked')).map(input => input.value)
  );
  const tags = [...new Set(cachedJobs.flatMap(job => Array.isArray(job.tags) ? job.tags : []))]
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

  clearJobReportWidget();
  const alreadyApplied = Boolean(currentUser && accountApplications.some(application =>
    application.applicant_id === currentUser.id && application.job_id === String(selectedJob.id)
  ));
  const selectedJobIsClosed = isJobClosed(selectedJob);
  const isSeekerAccount = Boolean(currentUser && accountType === "seeker");
  const canApply = Boolean(isSeekerAccount && !selectedJobIsClosed &&
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
    : "ログイン / 新規登録";
  if (!currentUser) {
    document.getElementById("applicationLoginPrompt").innerText = "応募画面に進むには、求職者アカウントでログインしてください。";
  } else if (accountType !== "seeker") {
    document.getElementById("applicationLoginPrompt").innerText = "サイトから応募するには求職者アカウントが必要です。別の求職者アカウントでログインしてください。";
  } else if (selectedJob.owner_id === currentUser.id) {
    document.getElementById("applicationLoginPrompt").innerText = "自分が投稿した求人には応募できません。";
  } else if (selectedJobIsClosed) {
    document.getElementById("applicationLoginPrompt").innerText = "募集が終了しているため、サイトから応募できません。";
  } else if (alreadyApplied) {
    document.getElementById("applicationLoginPrompt").innerText = "この求人にはすでにサイトから応募済みです。応募履歴はマイページで確認できます。";
  }
  document.getElementById("jobReportForm").classList.add("hidden");
  document.getElementById("jobReportButton").classList.remove("hidden");
  document.getElementById("jobReportSuccess").classList.add("hidden");
  document.getElementById("jobReportReason").value = "";
  document.getElementById("jobReportDetails").value = "";
  document.getElementById("jobReportSubmitButton").disabled = true;
  setJobReportStatus("通報するには確認を完了してください。");
  document.getElementById("modalTitle").innerText = selectedJob.title;
  document.getElementById("modalJobFreshness").innerText = formatJobFreshness(selectedJob);
  document.getElementById("modalLocation").innerText = selectedJob.location ? `📍 ${selectedJob.location}` : "";
  document.getElementById("modalSalary").innerText = selectedJob.salary || "給与応相談";
  document.getElementById("modalCapacity").innerText = `募集人数: ${formatJobCapacity(selectedJob.capacity)}`;
  document.getElementById("modalCapacity").classList.toggle("hidden", selectedJob.capacity <= 0);
  document.getElementById("modalDuties").innerText = selectedJob.duties || "特記事項なし";
  document.getElementById("modalClosed").classList.toggle("hidden", !selectedJobIsClosed);
  updateModalFavoriteButton();

  const tagsContainer = document.getElementById("modalTags");
  tagsContainer.innerHTML = selectedJob.tags ? selectedJob.tags.map(t => `<span class="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded font-bold">${escapeHtml(t)}</span>`).join("") : '';

  const modal = document.getElementById("jobModal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  document.getElementById("jobModalContent").scrollTop = 0;
}

async function generateAIDuties() {
  const title = document.getElementById("jobTitle").value.trim();
  const status = document.getElementById("aiStatus");
  if (!title) {
    alert("先に職種名（例: 解体作業員）を入力してください。AIがそれを元に文章を作ります。");
    return;
  }
  status.innerText = "✨ AIが魅力的な文章を考えています...";
  status.classList.remove("hidden");
  try {
    const response = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: `${title}の現場求人情報を募集しています。親しみやすく、かつ誠実な印象で、仕事内容や現場の魅力を200文字程度で作成してください。「未経験歓迎」「チームワーク重視」などの要素を含めてください。箇条書きではなく、呼びかけるような自然な文章にしてください。`
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
  const jobArea = String(jobLocation || "").trim();
  const preferredArea = String(preferredLocation || "").trim();
  if (!jobArea || !preferredArea) return 0;
  if (jobArea.includes(preferredArea) || preferredArea.includes(jobArea)) return 2;

  const jobPrefecture = getPrefecture(jobArea);
  const preferredPrefecture = getPrefecture(preferredArea);
  return jobPrefecture && jobPrefecture === preferredPrefecture ? 1 : 0;
}

function getJobMatchScore(job, profile) {
  let score = 0;
  const preferredJobTypes = String(profile.jobType || "")
    .split(/[,、，]/)
    .map(jobType => jobType.trim().toLocaleLowerCase())
    .filter(Boolean);
  const jobDescription = `${job.title || ""} ${job.duties || ""}`.toLocaleLowerCase();
  if (preferredJobTypes.some(jobType => jobDescription.includes(jobType))) score += 4;

  score += getLocationMatchScore(job.location, profile.location) * 2;

  if (profile.payType && getJobPayType(job) === profile.payType) score += 1;
  if (profile.minimumSalary && getJobPayAmount(job) >= Number(profile.minimumSalary)) score += 1;
  return score;
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

function loadMoreProfiles() {
  displayLimitProfiles += 10;
  renderEmployerDashboard();
}
