const TRACKING_STAGES = [
  ["none", "未設定"],
  ["interview", "日時調整中"],
  ["offer", "条件確認中"],
  ["hired", "作業確定"],
  ["not_hired", "今回は見送り"]
];

function trackingDateToInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = number => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function renderTrackingBox(box, tracking, message = "", isError = false) {
  const applicationId = box.dataset.applicationId;
  const stage = tracking?.stage || "none";
  box.innerHTML = `
    <section class="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
      <h4 class="text-sm font-black text-gray-900">連絡・作業状況 <span class="text-[10px] font-bold text-gray-500">（掲載者のみ表示）</span></h4>
      <div class="mt-3 grid gap-3 sm:grid-cols-2">
        <label class="block text-xs font-bold text-gray-700">状況
          <select data-tracking-stage class="mt-1 min-h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
            ${TRACKING_STAGES.map(([value, label]) => `<option value="${value}"${value === stage ? " selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
        <label class="block text-xs font-bold text-gray-700">作業日時・相談日時
          <input data-tracking-interview type="datetime-local" value="${trackingDateToInput(tracking?.interview_at)}" class="mt-1 min-h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
        </label>
      </div>
      <label class="mt-3 block text-xs font-bold text-gray-700">社内メモ（1,000文字まで）
        <textarea data-tracking-memo rows="3" maxlength="1000" class="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">${escapeHtml(tracking?.memo || "")}</textarea>
      </label>
      <div class="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" data-tracking-save class="min-h-10 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700">保存する</button>
        <p role="status" aria-live="polite" class="text-xs ${isError ? "text-red-700" : "text-emerald-700"}">${escapeHtml(message)}</p>
      </div>
    </section>`;
  box.querySelector("[data-tracking-save]").addEventListener("click", () => saveApplicationTracking(box, applicationId));
}

async function saveApplicationTracking(box, applicationId) {
  if (!currentUser || accountType !== "employer") return;
  const interviewValue = box.querySelector("[data-tracking-interview]").value;
  const interviewAt = interviewValue ? new Date(interviewValue) : null;
  const row = {
    application_id: applicationId,
    employer_id: currentUser.id,
    stage: box.querySelector("[data-tracking-stage]").value,
    interview_at: interviewAt && !Number.isNaN(interviewAt.getTime()) ? interviewAt.toISOString() : null,
    memo: box.querySelector("[data-tracking-memo]").value.trim().slice(0, 1000) || null,
    updated_at: new Date().toISOString()
  };
  const { data, error } = await supabaseClient
    .from("application_tracking")
    .upsert(row, { onConflict: "application_id" })
    .select()
    .single();
  if (error) {
    renderTrackingBox(box, row, `保存できませんでした: ${error.message}`, true);
    return;
  }
  renderTrackingBox(box, data, "保存しました。");
}

async function hydrateApplicationTracking(root = document) {
  if (!currentUser || accountType !== "employer") return;
  for (const box of root.querySelectorAll("[data-tracking-box]")) {
    const applicationId = box.dataset.applicationId;
    const { data, error } = await supabaseClient
      .from("application_tracking")
      .select("*")
      .eq("application_id", applicationId)
      .maybeSingle();
    if (!box.isConnected) continue;
    renderTrackingBox(box, data, error ? `読み込めませんでした: ${error.message}` : "", Boolean(error));
  }
}
