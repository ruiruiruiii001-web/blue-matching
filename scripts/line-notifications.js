async function updateLineNotificationStatus() {
  if (!currentUser || accountType !== "employer") return;
  const userId = currentUser.id;
  const status = document.getElementById("lineNotificationStatus");
  const unlink = document.getElementById("lineNotificationUnlink");
  status.textContent = "連携状態を確認しています。";
  unlink.classList.add("hidden");
  const { data, error } = await supabaseClient.functions.invoke("line-link", { body: { action: "status" } });
  if (currentUser?.id !== userId || accountType !== "employer") return;
  if (error || typeof data?.linked !== "boolean") {
    console.error("LINE連携状態の取得に失敗しました:", error);
    status.textContent = "LINE連携状態を確認できませんでした。時間をおいて再度お試しください。";
    return;
  }
  status.textContent = data.linked ? "LINE応募通知を連携中です。" : "LINE応募通知は連携されていません。";
  if (data.deliveryFailed) {
    status.textContent += " 過去に送信できなかった通知があります。サイト内の応募・通知も確認してください。";
  }
  unlink.classList.toggle("hidden", !data.linked);
}

async function showPilotLinePrompt() {
  if (!currentUser || accountType !== "employer") return;
  const userId = currentUser.id;
  document.getElementById("pilotLinePrompt").classList.add("hidden");
  let data;
  let error;
  try {
    ({ data, error } = await supabaseClient.functions.invoke("line-link", { body: { action: "status" } }));
  } catch (requestError) {
    error = requestError;
  }
  if (currentUser?.id !== userId || accountType !== "employer") return;
  if (error || typeof data?.linked !== "boolean") {
    console.error("LINE連携状態の取得に失敗しました:", error);
    const status = document.getElementById("employerDashboardStatus");
    status.textContent = "LINE連携状態を確認できませんでした。「応募・チャット」から状態を確認してください。";
    status.classList.remove("hidden");
    return;
  }
  document.getElementById("pilotLinePromptStatus").textContent = "新しい応募をLINEで受け取れます。連携は任意です。";
  document.getElementById("pilotLinePrompt").classList.toggle("hidden", data.linked);
}

async function unlinkLineNotifications() {
  if (!currentUser || accountType !== "employer") return;
  if (!window.confirm("LINE応募通知の連携を解除しますか？")) return;
  const button = document.getElementById("lineNotificationUnlink");
  button.disabled = true;
  try {
    const { error } = await supabaseClient.functions.invoke("line-link", { body: { action: "unlink" } });
    if (error) {
      console.error("LINE連携の解除に失敗しました:", error);
      document.getElementById("lineNotificationStatus").textContent = "解除できませんでした。もう一度お試しください。";
      return;
    }
    await updateLineNotificationStatus();
  } finally {
    button.disabled = false;
  }
}
