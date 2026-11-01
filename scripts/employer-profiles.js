let employerPublicProfiles = new Map();
let employerProfileLoadError = "";
let employerProfileLoadedUserId = null;
let employerProfilesSchemaReady = false;

function getEmployerPublicProfile(userId) {
  return employerPublicProfiles.get(String(userId)) || null;
}

async function loadEmployerPublicProfiles(userIds) {
  const ids = [...new Set(userIds.filter(Boolean).map(String))];
  if (!ids.length) {
    employerPublicProfiles = new Map();
    return;
  }
  const { data, error } = await supabaseClient
    .from("employer_public_profiles")
    .select("user_id, display_name, service_area, introduction")
    .in("user_id", ids);
  if (error) {
    const schemaUnavailable = ["42P01", "PGRST205"].includes(error.code);
    employerProfileLoadError = schemaUnavailable ? "" : error.message;
    employerProfilesSchemaReady = false;
    if (!schemaUnavailable) console.error("企業プロフィールを読み込めませんでした:", error);
    return;
  }
  employerProfilesSchemaReady = true;
  employerProfileLoadError = "";
  employerPublicProfiles = new Map((data || []).map(profile => [String(profile.user_id), profile]));
}

async function loadEmployerProfileForm() {
  if (!currentUser || accountType !== "employer") return;
  employerProfileLoadedUserId = currentUser.id;
  const status = document.getElementById("employerProfileStatus");
  if (status) {
    status.textContent = "プロフィールを読み込んでいます…";
    status.className = "mb-3 text-sm text-gray-600";
  }
  const { data, error } = await supabaseClient
    .from("employer_public_profiles")
    .select("display_name, service_area, introduction")
    .eq("user_id", currentUser.id)
    .maybeSingle();
  if (currentUser?.id !== employerProfileLoadedUserId || !document.getElementById("employerProfileName")) return;
  if (error) {
    if (["42P01", "PGRST205"].includes(error.code)) {
      status.textContent = "企業プロフィール機能を使うには、README記載の企業プロフィール用SQLを実行してください。";
      status.className = "mb-3 text-sm text-amber-800";
      return;
    }
    status.textContent = `プロフィールを読み込めませんでした: ${error.message}`;
    status.className = "mb-3 text-sm text-red-700";
    return;
  }
  employerProfilesSchemaReady = true;
  document.getElementById("employerProfileName").value = data?.display_name || "";
  document.getElementById("employerProfileArea").value = data?.service_area || "";
  document.getElementById("employerProfileIntroduction").value = data?.introduction || "";
  status.textContent = data ? "公開中のプロフィールです。保存内容は求人ページに表示されます。" : "プロフィールはまだ登録されていません。";
  status.className = "mb-3 text-sm text-gray-600";
}

async function saveEmployerProfile(event) {
  event.preventDefault();
  if (!currentUser || accountType !== "employer") return;
  const userId = currentUser.id;
  const status = document.getElementById("employerProfileStatus");
  if (!employerProfilesSchemaReady) {
    status.textContent = "企業プロフィール用SQLを実行してから保存してください。";
    status.className = "mb-3 text-sm text-amber-800";
    return;
  }
  const displayName = document.getElementById("employerProfileName").value.trim();
  const serviceArea = document.getElementById("employerProfileArea").value.trim();
  const introduction = document.getElementById("employerProfileIntroduction").value.trim();
  if (!displayName || displayName.length > 100 || serviceArea.length > 300 || introduction.length > 1000) {
    status.textContent = "企業・屋号は1〜100文字、対応地域は300文字、紹介文は1,000文字以内で入力してください。";
    status.className = "mb-3 text-sm text-red-700";
    return;
  }
  const { data, error } = await supabaseClient
    .from("employer_public_profiles")
    .upsert({
      user_id: userId,
      display_name: displayName,
      service_area: serviceArea,
      introduction
    }, { onConflict: "user_id" })
    .select("user_id, display_name, service_area, introduction")
    .single();
  if (error) {
    if (currentUser?.id !== userId) return;
    status.textContent = `保存できませんでした: ${error.message}`;
    status.className = "mb-3 text-sm text-red-700";
    return;
  }
  employerPublicProfiles.set(String(data.user_id), data);
  if (currentUser?.id !== userId) return;
  employerProfileLoadError = "";
  status.textContent = "企業プロフィールを保存しました。求人ページに表示されます。";
  status.className = "mb-3 text-sm text-emerald-700";
  renderJobList();
}

function renderEmployerProfileSummary(userId) {
  const profile = getEmployerPublicProfile(userId);
  if (!profile) {
    return `<p class="mt-1 text-[10px] text-gray-500">${employerProfileLoadError ? "企業プロフィールを読み込めませんでした" : "企業プロフィール未登録"}</p>`;
  }
  return `<p class="mt-1 truncate text-xs font-bold text-blue-700">${escapeHtml(profile.display_name)}</p>`;
}

function renderEmployerProfileDetails(userId) {
  const profile = getEmployerPublicProfile(userId);
  if (!profile) return "";
  return `
    <section class="mb-5 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
      <h3 class="font-bold text-gray-900">${escapeHtml(profile.display_name)}</h3>
      ${profile.service_area ? `<p class="mt-2 text-sm text-gray-700"><span class="font-bold">対応地域:</span> ${escapeHtml(profile.service_area)}</p>` : ""}
      ${profile.introduction ? `<p class="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">${escapeHtml(profile.introduction)}</p>` : ""}
    </section>`;
}
