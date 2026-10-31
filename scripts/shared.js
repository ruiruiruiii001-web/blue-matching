const JOB_TYPE_OPTIONS = [
  "大工・木造建築", "解体", "足場", "土木", "とび", "鉄筋", "型枠", "左官",
  "塗装", "内装", "電気工事", "配管・設備", "造園", "重機オペレーター",
  "現場監督・施工管理", "運搬・ドライバー", "清掃・養生"
];

const LICENSE_OPTIONS = [
  "普通自動車免許", "準中型免許", "中型免許", "大型免許", "玉掛け",
  "クレーン運転士", "小型移動式クレーン", "フォークリフト",
  "足場の組立て等作業主任者", "足場特別教育", "車両系建設機械",
  "高所作業車", "ガス溶接", "アーク溶接", "職長・安全衛生責任者",
  "施工管理技士", "電気工事士", "配管技能士", "石綿作業主任者",
  "フルハーネス特別教育"
];

const LEGACY_JOB_TAG_ALIASES = {
  "日払い・手渡しOK": ["日払いOK", "手渡しOK"],
  "雨天時給料保証あり": ["雨天時休業補償あり"],
  "未経験・即日OK": ["未経験歓迎", "即日勤務OK"],
  "夜勤・高収入": ["夜勤あり"],
  "週1〜OK・シフト自由": ["週1日〜OK", "シフト相談可"]
};

const PREFECTURE_GROUPS = [
  ["北海道・東北", ["北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県"]],
  ["関東", ["茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県"]],
  ["中部", ["新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県"]],
  ["近畿", ["三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県"]],
  ["中国", ["鳥取県", "島根県", "岡山県", "広島県", "山口県"]],
  ["四国", ["徳島県", "香川県", "愛媛県", "高知県"]],
  ["九州・沖縄", ["福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"]]
];

const PREFECTURES = PREFECTURE_GROUPS.flatMap(([, prefectures]) => prefectures);

function getNormalizedJobTags(values) {
  const tags = Array.isArray(values) ? values : [];
  return [...new Set(tags.flatMap(tag => LEGACY_JOB_TAG_ALIASES[tag] || [tag]))];
}

const WORK_PREFERENCE_GROUPS = [
  {
    key: "employment",
    label: "勤務形態",
    reason: "希望する勤務形態が一致",
    weight: 2,
    options: [
      ["spot", "単発・スポット"], ["short_term", "短期（1〜3か月）"],
      ["long_term", "長期・常用"], ["full_time", "正社員"],
      ["contract", "契約社員"], ["part_time", "アルバイト・パート"],
      ["outsourcing", "業務委託"]
    ]
  },
  {
    key: "days",
    label: "週の勤務日数",
    reason: "週の勤務日数が一致",
    weight: 1,
    options: [
      ["days_1", "週1日〜"], ["days_2_3", "週2〜3日"],
      ["days_4_5", "週4〜5日"], ["days_6", "週6日"],
      ["days_flexible", "勤務日数相談可"]
    ]
  },
  {
    key: "time",
    label: "勤務時間帯",
    reason: "勤務時間帯が一致",
    weight: 1,
    options: [
      ["day", "日勤"], ["night", "夜勤"], ["early", "早朝"],
      ["evening", "夕勤"], ["shift", "シフト制"],
      ["time_flexible", "勤務時間相談可"]
    ]
  }
];

function renderCheckboxOptions(containerId, inputName, options) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.replaceChildren(...options.map((option, index) => {
    const label = document.createElement("label");
    label.className = "flex min-h-10 items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm hover:bg-blue-50";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = inputName;
    checkbox.value = option.value || option;
    checkbox.id = `${inputName}-${index}`;
    checkbox.className = "h-4 w-4 shrink-0 rounded text-blue-600 focus:ring-blue-500";
    const text = document.createElement("span");
    text.textContent = option.label || option;
    label.htmlFor = checkbox.id;
    label.append(checkbox, text);
    return label;
  }));
}

function renderWorkPreferenceOptions(containerId, inputName) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.replaceChildren(...WORK_PREFERENCE_GROUPS.map(group => {
    const fieldset = document.createElement("fieldset");
    fieldset.className = "space-y-2";
    const legend = document.createElement("legend");
    legend.className = "mb-2 text-sm font-bold text-gray-700";
    legend.textContent = group.label;
    const options = document.createElement("div");
    options.className = "grid grid-cols-1 gap-2 sm:grid-cols-2";
    const groupOptions = group.options.map(([value, label]) => ({
      value: `${group.key}:${value}`,
      label
    }));
    options.append(...groupOptions.map((option, index) => {
      const wrapper = document.createElement("label");
      wrapper.className = "flex min-h-10 items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm hover:bg-blue-50";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.name = inputName;
      checkbox.value = option.value;
      checkbox.id = `${inputName}-${group.key}-${index}`;
      checkbox.className = "h-4 w-4 shrink-0 rounded text-blue-600 focus:ring-blue-500";
      const text = document.createElement("span");
      text.textContent = option.label;
      wrapper.htmlFor = checkbox.id;
      wrapper.append(checkbox, text);
      return wrapper;
    }));
    fieldset.append(legend, options);
    return fieldset;
  }));
}

function renderLocationPreferenceOptions(
  containerId = "seekerLocationPrefectureOptions",
  inputName = "seekerLocationPrefecture",
  selectionName = inputName
) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.replaceChildren(...PREFECTURE_GROUPS.map(([region, prefectures], regionIndex) => {
    const regionDetails = document.createElement("details");
    regionDetails.dataset.prefectureRegion = "";
    regionDetails.className = "rounded-lg border border-blue-100 bg-white";
    const summary = document.createElement("summary");
    summary.className = "flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-bold text-gray-700";
    const regionLabel = document.createElement("span");
    regionLabel.textContent = region;
    const icon = document.createElement("span");
    icon.dataset.regionIcon = "";
    icon.className = "text-blue-700";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "▼";
    summary.append(regionLabel, icon);

    const options = document.createElement("div");
    options.className = "grid grid-cols-1 gap-2 p-3 sm:grid-cols-2";
    prefectures.forEach((prefecture, prefectureIndex) => {
      const option = document.createElement("div");
      option.dataset.locationOption = "";
      option.className = "rounded-lg border border-gray-100 bg-gray-50 p-2";
      const label = document.createElement("label");
      label.className = "flex min-h-9 items-center gap-2 text-sm";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.name = inputName;
      checkbox.value = prefecture;
      checkbox.dataset.prefecture = prefecture;
      checkbox.id = `${inputName}-${regionIndex}-${prefectureIndex}`;
      checkbox.className = "h-4 w-4 shrink-0 rounded text-blue-600 focus:ring-blue-500";
      const text = document.createElement("span");
      text.textContent = prefecture;
      label.htmlFor = checkbox.id;
      label.append(checkbox, text);

      const cityContainer = document.createElement("div");
      cityContainer.dataset.cityContainer = "";
      cityContainer.className = "mt-2 hidden";
      const cityLabel = document.createElement("label");
      cityLabel.className = "block text-xs text-gray-600";
      cityLabel.textContent = "市区町村（任意・複数は「、」区切り）";
      const cityInput = document.createElement("input");
      cityInput.type = "text";
      cityInput.maxLength = 100;
      cityInput.dataset.prefectureCity = prefecture;
      cityInput.placeholder = "例: 横浜市、川崎市";
      cityInput.className = "mt-1 h-10 w-full rounded border px-3 py-2 text-sm text-gray-900";
      cityLabel.append(cityInput);
      cityContainer.append(cityLabel);
      option.append(label, cityContainer);
      options.append(option);

      checkbox.addEventListener("change", () => {
        cityContainer.classList.toggle("hidden", !checkbox.checked);
        if (!checkbox.checked) cityInput.value = "";
        updateSelectionDetails(selectionName);
      });
      cityInput.addEventListener("input", () => updateSelectionDetails(selectionName));
    });
    regionDetails.append(summary, options);
    regionDetails.addEventListener("toggle", () => {
      icon.textContent = regionDetails.open ? "▲" : "▼";
    });
    return regionDetails;
  }));
}

function getLocationPreferenceEntries(location) {
  return [...new Set(String(location || "")
    .split(/[,、，;／\/\n]/)
    .map(value => value.trim())
    .filter(Boolean))];
}

function parseLocationPreferences(location) {
  const preferences = new Map();
  const otherLocations = [];
  getLocationPreferenceEntries(location).forEach(entry => {
    const prefecture = PREFECTURES.find(value => entry.includes(value));
    if (!prefecture) {
      otherLocations.push(entry);
      return;
    }
    const city = entry.slice(entry.indexOf(prefecture) + prefecture.length).trim();
    const cities = preferences.get(prefecture) || [];
    if (city) cities.push(city);
    preferences.set(prefecture, cities);
  });
  return { preferences, otherLocations };
}

function getLocationPreferencesFromForm(
  inputName = "seekerLocationPrefecture",
  otherLocationId = "seekerLocation"
) {
  const entries = [];
  document.querySelectorAll(`input[name="${inputName}"]:checked`).forEach(checkbox => {
    const prefecture = checkbox.value;
    const cityInput = checkbox.closest("[data-location-option]")?.querySelector("[data-prefecture-city]");
    const cities = cityInput ? getLocationPreferenceEntries(cityInput.value) : [];
    if (cities.length) {
      cities.forEach(city => entries.push(`${prefecture} ${city}`));
    } else {
      entries.push(prefecture);
    }
  });
  entries.push(...getLocationPreferenceEntries(document.getElementById(otherLocationId).value));
  return [...new Set(entries)].join("、");
}

function setLocationPreferences(
  location,
  inputName = "seekerLocationPrefecture",
  otherLocationId = "seekerLocation",
  containerId = "seekerLocationPrefectureOptions",
  selectionName = inputName
) {
  const { preferences, otherLocations } = parseLocationPreferences(location);
  const container = document.getElementById(containerId);
  container.querySelectorAll(`input[name="${inputName}"]`).forEach(checkbox => {
    const cities = preferences.get(checkbox.value);
    checkbox.checked = Boolean(cities);
    const cityContainer = checkbox.closest("[data-location-option]").querySelector("[data-city-container]");
    const cityInput = cityContainer.querySelector("[data-prefecture-city]");
    cityInput.value = cities ? [...new Set(cities)].join("、") : "";
    cityContainer.classList.toggle("hidden", !checkbox.checked);
    const regionDetails = checkbox.closest("details[data-prefecture-region]");
    if (checkbox.checked) regionDetails.open = true;
    regionDetails.querySelector("[data-region-icon]").textContent = regionDetails.open ? "▲" : "▼";
  });
  if (!preferences.size) {
    container.querySelectorAll("details[data-prefecture-region]").forEach(details => {
      details.open = false;
      details.querySelector("[data-region-icon]").textContent = "▼";
    });
  }
  document.getElementById(otherLocationId).value = otherLocations.join("、");
  updateSelectionDetails(selectionName, true);
}

function initializeJobRequirementControls() {
  renderCheckboxOptions("jobRequiredLicenseOptions", "jobRequiredLicense", LICENSE_OPTIONS);
  renderCheckboxOptions("jobPreferredLicenseOptions", "jobPreferredLicense", LICENSE_OPTIONS);

  ["jobRequiredLicense", "jobPreferredLicense"].forEach(inputName => {
    document.querySelectorAll(`input[name="${inputName}"]`).forEach(input => {
      input.addEventListener("change", () => {
        if (!input.checked) return;
        const counterpartName = inputName === "jobRequiredLicense"
          ? "jobPreferredLicense"
          : "jobRequiredLicense";
        const counterpart = [...document.querySelectorAll(`input[name="${counterpartName}"]`)]
          .find(option => option.value === input.value);
        if (counterpart) {
          counterpart.checked = false;
          updateSelectionDetails(counterpartName);
        }
      });
    });
  });
}

function updateSelectionDetails(inputName, expandSelected = false) {
  document.querySelectorAll("details[data-selection-name]").forEach(details => {
    if (details.dataset.selectionName !== inputName) return;
    if (details.dataset.locationInputName === inputName) {
      const areas = [];
      details.querySelectorAll(`input[name="${inputName}"]:checked`).forEach(checkbox => {
        const cityInput = checkbox.closest("[data-location-option]")?.querySelector("[data-prefecture-city]");
        const cities = cityInput ? getLocationPreferenceEntries(cityInput.value) : [];
        areas.push(...(cities.length ? cities.map(city => `${checkbox.value} ${city}`) : [checkbox.value]));
      });
      const otherLocationId = details.dataset.locationOtherInput;
      areas.push(...getLocationPreferenceEntries(document.getElementById(otherLocationId).value));
      const count = details.querySelector("[data-selected-count]");
      if (count) count.textContent = `${details.dataset.locationCountLabel} ${new Set(areas).size}件`;
      if (expandSelected) details.open = areas.length > 0;
      updateSelectionDisclosure(details);
      return;
    }
    const extraInput = document.getElementById(details.dataset.selectionExtraInput);
    const selectedValues = new Set(
      [...details.querySelectorAll('input[type="checkbox"]:checked')]
        .map(input => input.value.trim())
    );
    if (extraInput) {
      extraInput.value.split(/[,、，]/).forEach(value => {
        const normalizedValue = value.trim();
        if (normalizedValue) selectedValues.add(normalizedValue);
      });
    }
    const selectedCount = selectedValues.size;
    const count = details.querySelector("[data-selected-count]");
    if (count) count.textContent = `選択済み ${selectedCount}件`;
    if (expandSelected) details.open = selectedCount > 0;
    updateSelectionDisclosure(details);
  });
}

function updateSelectionDisclosure(details) {
  const label = details.querySelector("[data-toggle-label]");
  const icon = details.querySelector("[data-toggle-icon]");
  if (label) label.textContent = details.open ? "閉じる" : "選択肢を開く";
  if (icon) icon.textContent = details.open ? "▲" : "▼";
}

function initializeSelectionDetails() {
  document.querySelectorAll("details[data-selection-name]").forEach(details => {
    const inputName = details.dataset.selectionName;
    details.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.addEventListener("change", () => updateSelectionDetails(inputName));
    });
    const extraInput = document.getElementById(details.dataset.selectionExtraInput);
    if (extraInput) {
      extraInput.addEventListener("input", () => updateSelectionDetails(inputName));
    }
    details.addEventListener("toggle", () => updateSelectionDisclosure(details));
    updateSelectionDetails(inputName);
  });
  ["seekerLocation", "jobLocation"].forEach((inputId, index) => {
    const inputName = index === 0 ? "seekerLocationPrefecture" : "jobLocationPrefecture";
    document.getElementById(inputId).addEventListener("input", () => updateSelectionDetails(inputName));
  });
}

function getCheckedValues(inputName) {
  return Array.from(document.querySelectorAll(`input[name="${inputName}"]:checked`))
    .map(input => input.value);
}

function setCheckedValues(inputName, values) {
  const selectedValues = new Set(Array.isArray(values) ? values : []);
  document.querySelectorAll(`input[name="${inputName}"]`).forEach(input => {
    input.checked = selectedValues.has(input.value);
  });
  updateSelectionDetails(inputName, true);
}

function getWorkPreferenceLabels(values) {
  const labels = new Map(
    WORK_PREFERENCE_GROUPS.flatMap(group =>
      group.options.map(([value, label]) => [`${group.key}:${value}`, label])
    )
  );
  return (Array.isArray(values) ? values : [])
    .map(value => labels.get(value))
    .filter(Boolean);
}

function getWorkPreferenceMatch(jobPreferences, seekerPreferences) {
  const jobValues = new Set(Array.isArray(jobPreferences) ? jobPreferences : []);
  const seekerValues = new Set(Array.isArray(seekerPreferences) ? seekerPreferences : []);
  let score = 0;
  let maximumScore = 0;
  const reasons = [];

  WORK_PREFERENCE_GROUPS.forEach(group => {
    const groupValues = group.options.map(([value]) => `${group.key}:${value}`);
    const jobGroup = groupValues.filter(value => jobValues.has(value));
    const seekerGroup = groupValues.filter(value => seekerValues.has(value));
    if (!jobGroup.length || !seekerGroup.length) return;
    maximumScore += group.weight;
    if (jobGroup.some(value => seekerValues.has(value))) {
      score += group.weight;
      reasons.push(group.reason);
    }
  });
  return { score, maximumScore, reasons };
}

function initializeProfileOptionControls() {
  renderCheckboxOptions("seekerJobTypeOptions", "seekerJobTypeOption", JOB_TYPE_OPTIONS);
  renderCheckboxOptions("seekerLicenseOptions", "seekerLic", LICENSE_OPTIONS);
  initializeJobRequirementControls();
  renderWorkPreferenceOptions("seekerWorkPreferences", "seekerWorkPreference");
  renderWorkPreferenceOptions("jobWorkPreferences", "jobWorkPreference");
  renderLocationPreferenceOptions();
  renderLocationPreferenceOptions(
    "jobLocationPrefectureOptions",
    "jobLocationPrefecture",
    "jobLocationPrefecture"
  );
  initializeSelectionDetails();
}

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
    pending: "応募を受け付けました。企業の確認後にメッセージを送信できます。進捗はマイページの応募履歴で確認できます。",
    reviewed: "企業が応募を確認しました。メッセージで連絡できます。",
    dismissed: "企業が今回は選考を見送りました。理由を応募履歴で確認できます。"
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
