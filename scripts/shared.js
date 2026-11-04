const JOB_TYPE_OPTIONS = [
  "イベントスタッフ・案内", "設営・撤去", "農作業・収穫", "飲食店・調理補助",
  "接客・販売", "受付・事務", "清掃", "引っ越し・運搬", "配送・ドライバー",
  "倉庫・仕分け", "組立・軽作業", "ご近所のお手伝い", "介護・生活サポート",
  "保育・子どもサポート", "警備・見守り", "庭仕事・造園", "修理・メンテナンス",
  { value: "大工・木造建築", label: "大工・木造建築" },
  { value: "解体", label: "建物の解体" },
  { value: "足場", label: "足場の組立・解体" },
  { value: "土木", label: "土木・道路工事" },
  "とび", "鉄筋", "型枠", "左官", "塗装", "内装", "電気工事", "配管・設備",
  "重機オペレーター",
  { value: "現場監督・施工管理", label: "施工管理" },
  { value: "清掃・養生", label: "建物の清掃・養生" }
];

const LICENSE_OPTIONS = [
  "普通自動車免許", "食品衛生責任者", "調理師", "防火管理者",
  "介護職員初任者研修", "介護福祉士", "保育士", "看護師",
  "救命講習修了", "日商簿記", "MOS（Microsoft Office Specialist）", "ITパスポート",
  "準中型免許", "中型免許", "大型免許", "玉掛け",
  "クレーン運転士", "小型移動式クレーン", "フォークリフト",
  "足場の組立て等作業主任者", "足場特別教育", "車両系建設機械",
  "高所作業車", "ガス溶接", "アーク溶接", "職長・安全衛生責任者",
  "施工管理技士", "電気工事士", "配管技能士", "石綿作業主任者",
  "フルハーネス特別教育"
];

const JOB_TAG_OPTIONS = Object.freeze([
  "未経験歓迎",
  "交通費支給",
  "作業場所へ直行・直帰OK",
  "マイカー・バイク通勤可",
  "即日勤務OK",
  "夜勤あり",
  "道具・作業着支給",
  "まかないあり",
  "服装自由",
  "道具貸出あり",
  "送迎あり"
]);
const JOB_TAG_OPTION_SET = new Set(JOB_TAG_OPTIONS);

const LEGACY_JOB_TAG_ALIASES = {
  "現場直行直帰OK": ["作業場所へ直行・直帰OK"],
  "未経験・即日OK": ["未経験歓迎", "即日勤務OK"],
  "夜勤・高収入": ["夜勤あり"]
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
  return [...new Set(
    tags.flatMap(tag => LEGACY_JOB_TAG_ALIASES[tag] || [tag])
      .filter(tag => JOB_TAG_OPTION_SET.has(tag))
  )];
}

const WORK_CATEGORY_LABELS = Object.freeze({
  construction_help: "建設・屋外作業",
  event_setup: "イベント・催事",
  farm_work: "農作業",
  neighborhood_help: "ご近所のお手伝い",
  restaurant_help: "飲食店のお手伝い",
  other: "その他のお手伝い"
});

const PAYMENT_METHOD_LABELS = Object.freeze({
  cash_on_site: "当日現金手渡し",
  bank_transfer: "後日振込",
  undecided: "条件を相談"
});

function getWorkCategoryLabel(category) {
  return WORK_CATEGORY_LABELS[category] || WORK_CATEGORY_LABELS.other;
}

function getPaymentMethodLabel(method) {
  return PAYMENT_METHOD_LABELS[method] || PAYMENT_METHOD_LABELS.undecided;
}

function getSuspiciousContentWarnings(value) {
  const text = String(value || "").normalize("NFKC").toLocaleLowerCase();
  const patterns = [
    [/(\bline\b|ライン|telegram|テレグラム|外部(?:の)?(?:sns|アプリ)|別(?:の)?アプリ)/i, "外部連絡先への誘導"],
    [/(口座(?:を|の)?(?:貸|売|譲|使わせ)|名義貸し)/i, "口座や名義の貸し借り"],
    [/(高額.{0,8}(?:手渡|現金)|(?:手渡|現金).{0,8}高額|即日(?:高額|現金))/i, "高額・即金の強調"]
  ];
  return patterns.filter(([pattern]) => pattern.test(text)).map(([, label]) => label);
}

function formatWorkDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return "";
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (date.getFullYear() !== Number(match[1]) ||
      date.getMonth() !== Number(match[2]) - 1 ||
      date.getDate() !== Number(match[3])) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(date);
}

function getLocalDateISO(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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

const ACTIVE_WORK_PREFERENCE_GROUPS = WORK_PREFERENCE_GROUPS.map(group => {
  if (group.key === "employment") {
    return {
      ...group,
      options: group.options.filter(([value]) => ["spot", "short_term"].includes(value))
    };
  }
  if (group.key === "days") {
    return {
      ...group,
      options: group.options.filter(([value]) => ["days_1", "days_2_3", "days_flexible"].includes(value))
    };
  }
  return group;
});

const SEEKER_EXPERIENCE_LABELS = Object.freeze({
  "未経験（やる気あり）": "未経験",
  "3〜5年（即戦力）": "3〜5年",
  "5年以上（ベテラン）": "5年以上"
});

const SEEKER_STAMINA_LABELS = Object.freeze({
  "★★★★★ (とても自信あり)": "かなり自信がある",
  "★★★★☆ (自信あり)": "自信がある",
  "★★★☆☆ (普通)": "ふつう",
  "★★☆☆☆ (やや不安)": "少し不安がある",
  "★☆☆☆☆ (自信なし)": "不安がある",
  "★★★★★ (自信あり)": "自信がある"
});

function getSeekerExperienceLabel(value) {
  return SEEKER_EXPERIENCE_LABELS[value] || value || "未設定";
}

function getSeekerStaminaLabel(value) {
  return SEEKER_STAMINA_LABELS[value] || value || "未設定";
}

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

function renderWorkPreferenceOptions(containerId, inputName, groups = WORK_PREFERENCE_GROUPS) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.replaceChildren(...groups.map(group => {
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
    ACTIVE_WORK_PREFERENCE_GROUPS.flatMap(group =>
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

  ACTIVE_WORK_PREFERENCE_GROUPS.forEach(group => {
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
  renderWorkPreferenceOptions("seekerWorkPreferences", "seekerWorkPreference", ACTIVE_WORK_PREFERENCE_GROUPS);
  renderWorkPreferenceOptions("jobWorkPreferences", "jobWorkPreference", ACTIVE_WORK_PREFERENCE_GROUPS);
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

const JOB_EXPIRY_WARNING_DAYS = 3;
const JOB_DURATION_OPTIONS = [7, 14, 30];
const DEFAULT_JOB_DURATION_DAYS = 14;

function isJobExpired(job) {
  const expiresAt = Date.parse(job.expires_at || "");
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
}

function getJobExpiryStatus(job) {
  const expiresAt = Date.parse(job.expires_at || "");
  if (!Number.isFinite(expiresAt)) return null;
  const dateText = new Date(expiresAt).toLocaleDateString("ja-JP");
  if (expiresAt <= Date.now()) {
    return { expired: true, warning: true, text: `掲載期限が切れました（${dateText}）。掲載を延長すると再び公開されます。` };
  }
  const daysLeft = Math.ceil((expiresAt - Date.now()) / 86400000);
  const warning = daysLeft <= JOB_EXPIRY_WARNING_DAYS;
  return {
    expired: false,
    warning,
    text: warning
      ? `あと${daysLeft}日で掲載が終了します（${dateText}まで）`
      : `掲載期限: ${dateText}（あと${daysLeft}日）`
  };
}

function getJobExpiryDateFromDays(days) {
  return new Date(Date.now() + days * 86400000).toISOString();
}

function formatApplicationStatus(status) {
  return { pending: "⏳ 未確認", reviewed: "✅ お仕事確定", dismissed: "➖ 対応不要" }[status] || "⏳ 未確認";
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
    pending: "応募を受け付けました。掲載者とすぐにチャットできます。お仕事の確定前に条件を確認してください。",
    reviewed: "掲載者がお仕事を確定しました。チャットで最終確認できます。",
    dismissed: "募集した方が今回は対応を見送りました。理由は応募したお仕事から確認できます。"
  }[status] || "応募状況を確認できません。";
}

async function uploadImage(fileInput, targetId, statusId) {
  const file = fileInput.files[0];
  const status = document.getElementById(statusId);
  if (!file || !status) return;

  if (!currentUser) {
    alert("写真をアップロードするにはログインが必要です。");
    return;
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 15 * 1024 * 1024) {
    status.innerText = "JPEG・PNG・WebP形式で、15MB以下の画像を選んでください。";
    status.className = "text-[10px] text-red-600";
    fileInput.value = "";
    return;
  }

  status.innerText = "⏳ アップロード中...";
  status.className = "text-[10px] text-blue-600 font-bold animate-pulse";
  const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[file.type];
  const fileId = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const filePath = `${currentUser.id}/${fileId}.${extension}`;

  try {
    const { error } = await supabaseClient.storage
      .from("job-media")
      .upload(filePath, file, { contentType: file.type, upsert: false });
    if (error) throw error;

    const { data: { publicUrl } } = supabaseClient.storage.from("job-media").getPublicUrl(filePath);
    document.getElementById(targetId).value = publicUrl;
    status.innerText = "✅ アップロード完了";
    status.className = "text-[10px] text-green-600 font-bold";
  } catch (error) {
    console.error("画像アップロードエラー:", error);
    status.innerText = `❌ アップロード失敗: ${error.message}`;
    status.className = "text-[10px] text-red-600 font-bold";
  }
}

function escapeHtml(str) {


  if (!str) return '';
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}

const LINE_ICON_PATHS = {
  user: "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z",
  star: "M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z",
  send: "M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5",
  bell: "M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0",
  clipboard: "M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z",
  chat: "M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z",
  building: "M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z",
  sort: "M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5"
};

// <span data-line-icon="名前"> を線画SVGに置き換える（装飾用のため読み上げ対象外）
function hydrateLineIcons(root = document) {
  root.querySelectorAll("[data-line-icon]:empty").forEach(element => {
    const path = LINE_ICON_PATHS[element.dataset.lineIcon];
    if (!path) return;
    element.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="mr-1 inline-block h-5 w-5 align-[-0.2em]"><path d="${path}"/></svg>`;
  });
}
hydrateLineIcons();