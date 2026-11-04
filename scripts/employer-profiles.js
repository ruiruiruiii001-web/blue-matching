let employerPublicProfiles = new Map();
let employerProfileLoadError = "";
let employerProfileLoadedUserId = null;
let employerProfilesSchemaReady = false;
let employerProfilePhotoSchemaReady = null;
const employerProfileColumns = "user_id, display_name, service_area, introduction, photo_url";
const employerProfileBaseColumns = "user_id, display_name, service_area, introduction";

function isMissingEmployerProfilePhotoColumnError(error) {
  return ["42703", "PGRST204"].includes(error?.code) &&
    String(error.message || "").includes("photo_url");
}

async function uploadEmployerProfilePhoto(fileInput) {
  if (employerProfilePhotoSchemaReady === false) {
    const status = document.getElementById("employerProfilePhotoStatus");
    status.innerText = "写真を保存するには、README記載の20261117_add_employer_profile_photo.sqlをSupabaseで実行してください。";
    status.className = "mt-1 text-xs text-amber-800";
    fileInput.value = "";
    return;
  }
  await uploadImage(fileInput, "employerProfilePhotoUrl", "employerProfilePhotoStatus");
  updateEmployerProfilePhotoPreview();
}

function updateEmployerProfilePhotoPreview() {
  const preview = document.getElementById("employerProfilePhotoPreview");
  const photoUrl = document.getElementById("employerProfilePhotoUrl")?.value || "";
  if (!preview) return;
  preview.src = photoUrl;
  preview.classList.toggle("hidden", !photoUrl);
}

function setEmployerProfileStatus(message, tone = "info", shouldScroll = false) {
  const status = document.getElementById("employerProfileStatus");
  if (!status) return;
  const styles = {
    info: "mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600",
    warning: "mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800",
    error: "mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700",
    success: "mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800"
  };
  status.textContent = message;
  status.className = styles[tone] || styles.info;
  if (shouldScroll) status.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function getEmployerPublicProfile(userId) {
  return employerPublicProfiles.get(String(userId)) || null;
}

async function loadEmployerPublicProfiles(userIds) {
  const ids = [...new Set(userIds.filter(Boolean).map(String))];
  if (!ids.length) {
    employerPublicProfiles = new Map();
    return;
  }
  let result = await supabaseClient
    .from("employer_public_profiles")
    .select(employerProfileColumns)
    .in("user_id", ids);
  if (isMissingEmployerProfilePhotoColumnError(result.error)) {
    employerProfilePhotoSchemaReady = false;
    console.error("掲載者プロフィール写真用のデータベース移行が未適用です:", result.error);
    result = await supabaseClient
      .from("employer_public_profiles")
      .select(employerProfileBaseColumns)
      .in("user_id", ids);
  } else if (!result.error) {
    employerProfilePhotoSchemaReady = true;
  }
  const { data, error } = result;
  if (error) {
    const schemaUnavailable = ["42P01", "PGRST205"].includes(error.code);
    employerProfileLoadError = schemaUnavailable ? "" : error.message;
    employerProfilesSchemaReady = false;
    if (!schemaUnavailable) console.error("掲載者プロフィールを読み込めませんでした:", error);
    return;
  }
  employerProfilesSchemaReady = true;
  employerProfileLoadError = "";
  employerPublicProfiles = new Map((data || []).map(profile => [String(profile.user_id), profile]));
}

async function loadEmployerProfileForm() {
  if (!currentUser || accountType !== "employer") return;
  employerProfileLoadedUserId = currentUser.id;
  setEmployerProfileStatus("プロフィールを読み込んでいます…");
  let result = await supabaseClient
    .from("employer_public_profiles")
    .select("display_name, service_area, introduction, photo_url")
    .eq("user_id", currentUser.id)
    .maybeSingle();
  if (isMissingEmployerProfilePhotoColumnError(result.error)) {
    employerProfilePhotoSchemaReady = false;
    console.error("掲載者プロフィール写真用のデータベース移行が未適用です:", result.error);
    result = await supabaseClient
      .from("employer_public_profiles")
      .select("display_name, service_area, introduction")
      .eq("user_id", currentUser.id)
      .maybeSingle();
  } else if (!result.error) {
    employerProfilePhotoSchemaReady = true;
  }
  const { data, error } = result;
  if (currentUser?.id !== employerProfileLoadedUserId || !document.getElementById("employerProfileName")) return;
  if (error) {
    if (["42P01", "PGRST205"].includes(error.code)) {
      setEmployerProfileStatus("掲載者プロフィール機能を使うには、README記載の掲載者プロフィール用SQLを実行してください。", "warning");
      return;
    }
    setEmployerProfileStatus(`プロフィールを読み込めませんでした: ${error.message}`, "error");
    return;
  }
  employerProfilesSchemaReady = true;
  document.getElementById("employerProfileName").value = data?.display_name || "";
  document.getElementById("employerProfileArea").value = data?.service_area || "";
  document.getElementById("employerProfileIntroduction").value = data?.introduction || "";
  document.getElementById("employerProfilePhotoUrl").value = data?.photo_url || "";
  updateEmployerProfilePhotoPreview();
  if (employerProfilePhotoSchemaReady === false) {
    setEmployerProfileStatus("写真を利用するには、README記載の20261117_add_employer_profile_photo.sqlをSupabaseで実行してください。", "warning");
  } else {
    setEmployerProfileStatus(data
      ? "公開中のプロフィールです。保存内容はお仕事の詳細ページに表示されます。"
      : "プロフィールはまだ登録されていません.");
  }
}

async function saveEmployerProfile(event) {
  event.preventDefault();
  if (!currentUser || accountType !== "employer") return;
  const userId = currentUser.id;
  if (!employerProfilesSchemaReady) {
    setEmployerProfileStatus("掲載者プロフィール用SQLを実行してから保存してください。", "warning", true);
    return;
  }
  const displayName = document.getElementById("employerProfileName").value.trim();
  const serviceArea = document.getElementById("employerProfileArea").value.trim();
  const introduction = document.getElementById("employerProfileIntroduction").value.trim();
  const photoUrl = document.getElementById("employerProfilePhotoUrl").value.trim();
  if (!displayName || displayName.length > 100 || serviceArea.length > 300 || introduction.length > 1000 || photoUrl.length > 2048) {
    setEmployerProfileStatus("表示名・屋号は1〜100文字、対応地域は300文字、紹介文は1,000文字以内で入力してください。", "error", true);
    return;
  }
  if (photoUrl && employerProfilePhotoSchemaReady === false) {
    setEmployerProfileStatus("写真を保存するには、README記載の20261117_add_employer_profile_photo.sqlをSupabaseで実行してください。", "warning", true);
    return;
  }
  const profileRow = {
    user_id: userId,
    display_name: displayName,
    service_area: serviceArea,
    introduction
  };
  if (employerProfilePhotoSchemaReady !== false) profileRow.photo_url = photoUrl;
  let result = await supabaseClient
    .from("employer_public_profiles")
    .upsert(profileRow, { onConflict: "user_id" })
    .select(employerProfilePhotoSchemaReady === false ? employerProfileBaseColumns : employerProfileColumns)
    .single();
  if (isMissingEmployerProfilePhotoColumnError(result.error)) {
    employerProfilePhotoSchemaReady = false;
    setEmployerProfileStatus("写真を保存するには、README記載の20261117_add_employer_profile_photo.sqlをSupabaseで実行してください。", "warning", true);
    return;
  }
  const { data, error } = result;
  if (error) {
    if (currentUser?.id !== userId) return;
    setEmployerProfileStatus(`保存できませんでした: ${error.message}`, "error", true);
    return;
  }
  employerPublicProfiles.set(String(data.user_id), data);
  if (currentUser?.id !== userId) return;
  employerProfileLoadError = "";
  setEmployerProfileStatus("掲載者プロフィールを保存しました。お仕事の詳細ページに表示されます。", "success", true);
  renderJobList();
}

function renderEmployerProfileSummary(userId) {
  const profile = getEmployerPublicProfile(userId);
  if (!profile) {
    return `<p class="mt-1 text-[10px] text-gray-500">${employerProfileLoadError ? "掲載者プロフィールを読み込めませんでした" : "掲載者プロフィール未登録"}</p>`;
  }
  return `<p class="mt-1 truncate text-xs font-bold text-blue-700">${escapeHtml(profile.display_name)}</p>`;
}

function renderEmployerProfileDetails(userId) {
  const profile = getEmployerPublicProfile(userId);
  if (!profile) return "";
  return `
    <section class="mb-5 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
      ${profile.photo_url ? `<img src="${escapeHtml(String(profile.photo_url))}" alt="${escapeHtml(String(profile.display_name))}" class="mb-3 max-h-60 w-full rounded-lg object-cover">` : ""}
      <h3 class="font-bold text-gray-900">${escapeHtml(profile.display_name)}</h3>
      ${profile.service_area ? `<p class="mt-2 text-sm text-gray-700"><span class="font-bold">対応地域:</span> ${escapeHtml(profile.service_area)}</p>` : ""}
      ${profile.introduction ? `<p class="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">${escapeHtml(profile.introduction)}</p>` : ""}
    </section>`;
}
