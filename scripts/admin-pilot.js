async function loadAdminPilotOverview() {
  const container = document.getElementById("adminPilotOverview");
  container.replaceChildren(createElement("p", "text-sm text-gray-600", "読み込んでいます…"));
  const { data, error } = await supabaseClient.rpc("admin_pilot_overview");
  if (error || !data) {
    container.replaceChildren(createElement("p", "text-sm text-red-700", `テスト運用の状況を読み込めませんでした: ${error?.message || "応答がありません"}`));
    return;
  }
  container.replaceChildren(createElement("p", "rounded-lg bg-blue-50 p-4 text-sm font-bold",
    `掲載者 ${data.employer_count}件 / 募集 ${data.job_count}件 / 応募 ${data.application_count}件`));
  const groups = [
    ["掲載者（最大100件）", data.employers, row => `${row.name} / 募集 ${row.job_count}件`],
    ["募集（新しい順・最大100件）", data.jobs, row => `${row.title} / ${row.employer} / 審査: ${row.moderation_status} / ${row.is_closed ? "終了" : "受付中"} / ${new Date(row.created_at).toLocaleString("ja-JP")}`],
    ["応募（新しい順・最大100件）", data.applications, row => `${row.job_title} / ${row.employer} / ${formatApplicationStatus(row.status)} / ${new Date(row.created_at).toLocaleString("ja-JP")}`]
  ];
  groups.forEach(([heading, rows, format]) => {
    const section = createElement("section", "rounded-xl bg-white p-4");
    section.append(createElement("h2", "font-bold text-gray-900", heading));
    if (!rows.length) section.append(createElement("p", "mt-2 text-sm text-gray-600", "該当するデータはありません。"));
    const list = createElement("ul", "mt-2 space-y-2 text-sm text-gray-700");
    rows.forEach(row => list.append(createElement("li", "break-words border-b border-gray-100 pb-2", format(row))));
    section.append(list);
    container.append(section);
  });
}

document.getElementById("adminPilotReload").addEventListener("click", loadAdminPilotOverview);
