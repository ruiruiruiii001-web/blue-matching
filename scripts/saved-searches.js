const MAX_SAVED_SEARCHES = 5;
let savedSearches = [];
let savedSearchesUserId = null;

function resetSavedSearches() {
  savedSearches = [];
  savedSearchesUserId = null;
  renderSavedSearches();
}

function getCurrentJobFilters() {
  const filters = {
    keyword: document.getElementById("searchKeyword").value.trim(),
    openJobsOnly: document.getElementById("openJobsOnly").checked,
    location: document.getElementById("locationFilter").value,
    capacity: document.getElementById("capacityFilter").value,
    salaryType: document.getElementById("salaryTypeFilter").value,
    minimumSalary: Number(document.getElementById("minimumSalary").value) || 0,
    tags: Array.from(document.querySelectorAll('input[name="tagFilter"]:checked')).map(input => input.value)
  };
  return filters;
}

function hasJobFilters(filters) {
  return Boolean(filters.keyword || filters.openJobsOnly || filters.location || filters.capacity ||
    filters.salaryType || filters.minimumSalary || (filters.tags && filters.tags.length));
}

function describeJobFilters(filters) {
  return [
    filters.keyword && `「${filters.keyword}」`,
    filters.location,
    filters.salaryType && { hourly: "時給", daily: "日給", monthly: "月給" }[filters.salaryType],
    filters.minimumSalary && `${Number(filters.minimumSalary).toLocaleString()}円以上`,
    filters.capacity && "募集人数指定",
    filters.openJobsOnly && "募集中のみ",
    ...(filters.tags || [])
  ].filter(Boolean).join(" / ") || "条件なし";
}

function jobMatchesSavedFilters(job, filters) {
  const keyword = String(filters.keyword || "").toLowerCase();
  const tags = Array.isArray(filters.tags) ? filters.tags : [];
  const jobTags = getNormalizedJobTags(job.tags);
  return (!keyword ||
      (job.title || "").toLowerCase().includes(keyword) ||
      (job.location || "").toLowerCase().includes(keyword) ||
      getWorkPreferenceLabels(job.work_preferences).some(value => value.toLocaleLowerCase().includes(keyword)) ||
      jobTags.some(tag => tag.toLocaleLowerCase().includes(keyword))) &&
    (!filters.openJobsOnly || !isJobClosed(job)) &&
    (!filters.capacity || getCapacityOptionValue(job.capacity) === filters.capacity) &&
    (!filters.location || jobMatchesLocationFilter(job.location, filters.location)) &&
    (!filters.salaryType || getJobPayType(job) === filters.salaryType) &&
    (!filters.minimumSalary || (filters.salaryType && getJobPayAmount(job) >= filters.minimumSalary)) &&
    (!tags.length || tags.some(tag => jobTags.includes(tag)));
}

function countNewJobsForSavedSearch(search) {
  const seenAt = new Date(search.last_seen_at).getTime();
  return cachedJobs.filter(job =>
    new Date(job.created_at).getTime() > seenAt &&
    !isJobClosed(job) &&
    job.owner_id !== currentUser?.id &&
    !blockedUserIds.includes(job.owner_id) &&
    jobMatchesSavedFilters(job, search.filters || {})
  ).length;
}

async function loadSavedSearches() {
  if (!currentUser) return;
  const userId = currentUser.id;
  const { data, error } = await supabaseClient
    .from("saved_searches")
    .select("id, name, filters, last_seen_at")
    .order("created_at", { ascending: true });
  if (currentUser?.id !== userId) return;
  if (error) {
    console.error("保存した検索条件を読み込めませんでした:", error);
    return;
  }
  savedSearches = data || [];
  savedSearchesUserId = userId;
  renderSavedSearches();
}

function renderSavedSearches() {
  const container = document.getElementById("savedSearches");
  const saveButton = document.getElementById("saveSearchButton");
  if (!container || !saveButton) return;
  const loggedIn = Boolean(currentUser);
  saveButton.classList.toggle("hidden", !loggedIn || !hasJobFilters(getCurrentJobFilters()));
  container.replaceChildren();
  const showSaved = loggedIn && savedSearches.length > 0;
  container.classList.toggle("hidden", !showSaved);
  container.classList.toggle("flex", showSaved);
  if (!loggedIn) return;

  const heading = document.createElement("p");
  heading.className = "w-full text-xs font-bold text-gray-700";
  heading.textContent = "保存した検索条件";
  container.append(heading);

  savedSearches.forEach(search => {
    const newCount = countNewJobsForSavedSearch(search);
    const wrapper = document.createElement("div");
    wrapper.className = "flex items-center overflow-hidden rounded-lg border border-blue-200 bg-white text-sm";

    const apply = document.createElement("button");
    apply.type = "button";
    apply.className = "min-h-10 px-3 py-2 text-left font-bold text-blue-800 hover:bg-blue-50";
    apply.textContent = search.name;
    apply.title = describeJobFilters(search.filters || {});
    apply.addEventListener("click", () => applySavedSearch(search.id));
    wrapper.append(apply);

    if (newCount > 0) {
      const badge = document.createElement("span");
      badge.className = "mr-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white";
      badge.textContent = `新着${newCount}件`;
      wrapper.append(badge);
    }

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "min-h-10 min-w-10 px-2 text-gray-500 hover:bg-red-50 hover:text-red-700";
    remove.setAttribute("aria-label", `${search.name}を削除`);
    remove.textContent = "×";
    remove.addEventListener("click", () => deleteSavedSearch(search.id));
    wrapper.append(remove);
    container.append(wrapper);
  });
}

async function saveCurrentSearch() {
  if (!currentUser) return;
  const filters = getCurrentJobFilters();
  if (!hasJobFilters(filters)) return;
  if (savedSearches.length >= MAX_SAVED_SEARCHES) {
    alert(`保存できる検索条件は${MAX_SAVED_SEARCHES}件までです。不要な条件を削除してください。`);
    return;
  }
  const name = window.prompt("この検索条件の名前を入力してください（60文字以内）", describeJobFilters(filters).slice(0, 60));
  if (name === null) return;
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 60) {
    alert("名前は1〜60文字で入力してください。");
    return;
  }
  const { data, error } = await supabaseClient
    .from("saved_searches")
    .insert({ user_id: currentUser.id, name: trimmed, filters })
    .select("id, name, filters, last_seen_at")
    .single();
  if (error) {
    alert(`検索条件を保存できませんでした: ${error.message}`);
    return;
  }
  savedSearches.push(data);
  renderSavedSearches();
}

async function applySavedSearch(id) {
  const search = savedSearches.find(item => item.id === id);
  if (!search) return;
  const filters = search.filters || {};
  displayLimitJobs = 10;
  document.getElementById("searchKeyword").value = filters.keyword || "";
  document.getElementById("openJobsOnly").checked = Boolean(filters.openJobsOnly);
  document.getElementById("favoritesOnly").checked = false;
  document.getElementById("capacityFilter").value = filters.capacity || "";
  document.getElementById("salaryTypeFilter").value = filters.salaryType || "";
  document.getElementById("minimumSalary").value = filters.minimumSalary || "";
  document.querySelectorAll('input[name="tagFilter"]').forEach(input => {
    input.checked = (filters.tags || []).includes(input.value);
  });
  updateJobFilterOptions();
  document.getElementById("locationFilter").value = filters.location || "";

  const seenAt = new Date().toISOString();
  search.last_seen_at = seenAt;
  renderJobList();
  const { error } = await supabaseClient
    .from("saved_searches")
    .update({ last_seen_at: seenAt })
    .eq("id", id);
  if (error) console.error("確認日時を更新できませんでした:", error);
}

async function deleteSavedSearch(id) {
  const search = savedSearches.find(item => item.id === id);
  if (!search || !confirm(`保存した検索条件「${search.name}」を削除しますか？`)) return;
  const { error } = await supabaseClient.from("saved_searches").delete().eq("id", id);
  if (error) {
    alert(`削除できませんでした: ${error.message}`);
    return;
  }
  savedSearches = savedSearches.filter(item => item.id !== id);
  renderSavedSearches();
}
