const MAX_INTERVIEW_SLOTS = 5;
const interviewSlotCache = new Map();

function formatInterviewSlot(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ja-JP", { year: "numeric", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });
}

function renderInterviewBox(box, slots, message = "", isError = false) {
  if (PILOT_MODE) {
    const selected = slots.find(slot => slot.is_selected);
    box.innerHTML = selected
      ? `<section class="mt-5 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
          <h5 class="text-sm font-bold text-gray-800">確定済みの作業・相談日時</h5>
          <p class="mt-2 text-sm text-gray-800">${escapeHtml(formatInterviewSlot(selected.starts_at))}</p>
          <p class="mt-1 text-xs text-gray-600">変更が必要な場合はメッセージで相談してください。</p>
        </section>`
      : "";
    return;
  }
  const applicationId = box.dataset.applicationId;
  const isEmployer = accountType === "employer";
  const selected = slots.find(slot => slot.is_selected);
  const now = Date.now();
  const messageHtml = `<p role="status" aria-live="polite" class="mt-2 text-xs ${isError ? "text-red-700" : "text-emerald-700"}">${escapeHtml(message)}</p>`;
  const slotItems = slots.map(slot => {
    const past = new Date(slot.starts_at).getTime() <= now;
    const action = isEmployer
      ? (slot.is_selected ? "" : `<button type="button" data-slot-delete="${escapeHtml(slot.id)}" class="min-h-9 rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs font-bold text-gray-600 hover:bg-gray-50">削除</button>`)
      : (!selected && !past ? `<button type="button" data-slot-select="${escapeHtml(slot.id)}" class="min-h-9 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700">この日時にする</button>` : "");
    return `<li class="flex flex-wrap items-center justify-between gap-2 rounded-lg ${slot.is_selected ? "border border-emerald-300 bg-emerald-50" : "bg-white"} px-3 py-2">
      <span class="text-sm ${past && !slot.is_selected ? "text-gray-400" : "text-gray-800"}">${escapeHtml(formatInterviewSlot(slot.starts_at))}${slot.is_selected ? ' <span class="ml-1 font-bold text-emerald-700">確定</span>' : ""}${past && !slot.is_selected ? " （期限切れ）" : ""}</span>
      ${action}
    </li>`;
  }).join("");
  const form = isEmployer && !selected && slots.length < MAX_INTERVIEW_SLOTS
    ? `<div class="mt-3 flex flex-wrap items-end gap-2">
        <label class="text-xs font-bold text-gray-700">候補日時を追加
          <input type="datetime-local" data-slot-input class="mt-1 block min-h-10 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
        </label>
        <button type="button" data-slot-add class="min-h-10 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700">追加</button>
      </div>`
    : "";
  const guide = isEmployer
    ? `<p class="mt-1 text-[11px] text-gray-500">最大${MAX_INTERVIEW_SLOTS}件まで提示できます。応募した方が1つ選ぶと確定します。</p>`
    : `<p class="mt-1 text-[11px] text-gray-500">${selected ? "日時が確定しました。変更が必要な場合はメッセージで相談してください。" : "都合のよい日時を1つ選んでください。"}</p>`;
  box.innerHTML = `
    <section class="mt-5 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
      <h5 class="text-sm font-bold text-gray-800">作業・相談日時の調整</h5>
      ${guide}
      ${slots.length ? `<ul class="mt-3 space-y-2">${slotItems}</ul>` : `<p class="mt-3 text-xs text-gray-500">${isEmployer ? "候補日時はまだ提示していません。" : "掲載者からの候補日時はまだありません。"}</p>`}
      ${form}
      ${messageHtml}
    </section>`;
  box.querySelector("[data-slot-add]")?.addEventListener("click", () => addInterviewSlot(box, applicationId));
  box.querySelectorAll("[data-slot-delete]").forEach(button =>
    button.addEventListener("click", () => deleteInterviewSlot(box, applicationId, button.dataset.slotDelete)));
  box.querySelectorAll("[data-slot-select]").forEach(button =>
    button.addEventListener("click", () => selectInterviewSlot(box, applicationId, button.dataset.slotSelect)));
}

async function reloadInterviewBox(box, applicationId, message = "", isError = false) {
  const { data, error } = await supabaseClient
    .from("interview_slots")
    .select("id, starts_at, is_selected")
    .eq("application_id", applicationId)
    .order("starts_at", { ascending: true });
  if (!box.isConnected) return;
  if (error) {
    const schemaUnavailable = ["42P01", "PGRST205"].includes(error.code);
    if (schemaUnavailable) {
      box.innerHTML = '<p class="mt-5 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">日時調整を使うには、README記載の日時調整用SQLを実行してください。</p>';
      return;
    }
    box.innerHTML = `<p class="mt-5 text-xs text-red-700">候補日時を読み込めませんでした: ${escapeHtml(error.message)}</p>`;
    return;
  }
  interviewSlotCache.set(applicationId, data || []);
  renderInterviewBox(box, data || [], message, isError);
}

async function addInterviewSlot(box, applicationId) {
  if (!currentUser || accountType !== "employer") return;
  const value = box.querySelector("[data-slot-input]").value;
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
    renderInterviewBox(box, interviewSlotCache.get(applicationId) || [], "未来の日時を入力してください。", true);
    return;
  }
  const { error } = await supabaseClient.from("interview_slots").insert({
    application_id: applicationId,
    employer_id: currentUser.id,
    starts_at: date.toISOString()
  });
  if (error) {
    await reloadInterviewBox(box, applicationId, `追加できませんでした: ${error.message}`, true);
    return;
  }
  await reloadInterviewBox(box, applicationId, "候補日時を追加しました。");
}

async function deleteInterviewSlot(box, applicationId, slotId) {
  if (!currentUser || accountType !== "employer") return;
  const { error } = await supabaseClient
    .from("interview_slots")
    .delete()
    .eq("id", slotId)
    .eq("employer_id", currentUser.id);
  if (error) {
    await reloadInterviewBox(box, applicationId, `削除できませんでした: ${error.message}`, true);
    return;
  }
  await reloadInterviewBox(box, applicationId, "候補日時を削除しました。");
}

async function selectInterviewSlot(box, applicationId, slotId) {
  if (!currentUser || accountType !== "seeker") return;
  const slot = (interviewSlotCache.get(applicationId) || []).find(item => item.id === slotId);
  if (!slot || !confirm(`${formatInterviewSlot(slot.starts_at)} を選択しますか？`)) return;
  const { error } = await supabaseClient.rpc("select_interview_slot", { p_slot_id: slotId });
  if (error) {
    await reloadInterviewBox(box, applicationId, `確定できませんでした: ${error.message}`, true);
    return;
  }
  await reloadInterviewBox(box, applicationId, "日時を確定しました。");
}

function hydrateInterviewBoxes(root = document) {
  if (!currentUser || !["employer", "seeker"].includes(accountType)) return;
  root.querySelectorAll("[data-interview-box]:not([data-interview-hydrated])").forEach(box => {
    box.dataset.interviewHydrated = "true";
    reloadInterviewBox(box, box.dataset.applicationId);
  });
}

// 応募一覧・通知詳細など複数の画面が会話欄を描画するため、描画後に日時調整欄を読み込む
new MutationObserver(() => hydrateInterviewBoxes()).observe(document.body, { childList: true, subtree: true });
