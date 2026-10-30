function formatDashboardDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("ja-JP");
}

function formatJobFreshness(job) {
  const createdAt = Date.parse(job.created_at || "");
  const updatedAt = Date.parse(job.updated_at || "");
  if (Number.isFinite(updatedAt) && (!Number.isFinite(createdAt) || updatedAt - createdAt > 60000)) {
    return `最終更新: ${formatDashboardDate(job.updated_at)}`;
  }
  return job.created_at ? `掲載日: ${formatDashboardDate(job.created_at)}` : "";
}

function formatApplicationStatus(status) {
  return { pending: "未確認", reviewed: "確認済み", dismissed: "対応不要" }[status] || "未確認";
}

function formatApplicationStatusClass(status) {
  return {
    pending: "bg-amber-100 text-amber-900",
    reviewed: "bg-emerald-100 text-emerald-900",
    dismissed: "bg-gray-100 text-gray-700"
  }[status] || "bg-amber-100 text-amber-900";
}

function formatApplicationStatusDescription(status) {
  return {
    pending: "企業からの確認を待っています。",
    reviewed: "企業が応募を確認しました。以降の連絡は企業からの案内をご確認ください。",
    dismissed: "企業が今回は対応不要と判断しました。"
  }[status] || "応募状況を確認できません。";
}

function normalizeJapanesePhone(phone) {
  return phone.replace(/[()\s-]/g, "");
}

function isValidJapanesePhone(phone) {
  return /^(0\d{9,10}|\+81\d{9,10})$/.test(phone);
}

async function uploadImage(fileInput, targetId, statusId) {

  const file = fileInput.files[0];
  const status = document.getElementById(statusId);
  if (!file) return;

  if (!currentUser) {
    alert("写真をアップロードするにはログインが必要です。");
    return;
  }

  status.innerText = "⏳ アップロード中...";
  status.className = "text-[10px] text-blue-600 font-bold animate-pulse";

  try {
    // ファイル名をユニークにする (userId_timestamp_name)
    const fileExt = file.name.split('.').pop();
    const fileName = `${currentUser.id}_${Date.now()}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    // Supabase Storage にアップロード
    const { data, error } = await supabaseClient.storage
      .from('job-media')
      .upload(filePath, file);

    if (error) throw error;

    // 公開URLを取得
    const { data: { publicUrl } } = supabaseClient.storage
      .from('job-media')
      .getPublicUrl(filePath);

    document.getElementById(targetId).value = publicUrl;
    status.innerText = "✅ アップロード完了";
    status.className = "text-[10px] text-green-600 font-bold";
  } catch (error) {
    console.error("Upload error:", error);
    status.innerText = "❌ アップロード失敗: " + error.message;
    status.className = "text-[10px] text-red-600 font-bold";
  }
}

function escapeHtml(str) {


  if (!str) return '';
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}
