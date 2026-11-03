const ONBOARDING_STORAGE_KEY = "blueMatchingGuideDismissed";

const ONBOARDING_STEPS = {
  seeker: {
    title: "お仕事探しの方へ：応募までの流れ",
    steps: [
      "「新規登録」でお仕事探しアカウントを作り、プロフィールを入力します。",
      "勤務地・給与・資格でお仕事を探し、気になるお仕事は★でお気に入りに入れます。",
      "お仕事詳細から応募します。電話番号は不要で、連絡はサイト内のメッセージで行います。",
      "企業が応募を確認すると、メッセージや面接日時の候補が届きます。"
    ]
  },
  employer: {
    title: "企業・親方の方へ：お仕事掲載の流れ",
    steps: [
      "「新規登録」で企業・親方アカウントを作り、企業プロフィールを登録します。",
      "マイページの「お仕事管理」からお仕事を投稿します。写真は5枚まで登録できます。",
      "応募が届いたら内容を確認し、「確認済み」にするとメッセージや面接日時の調整ができます。",
      "公開を許可したお仕事探しの方は、お仕事探しの方を探すから探せます。"
    ]
  }
};

function renderGuideColumn(kind) {
  const guide = ONBOARDING_STEPS[kind];
  return `
    <div>
      <h3 class="text-sm font-bold text-blue-900">${guide.title}</h3>
      <ol class="mt-2 list-inside list-decimal space-y-1 text-sm leading-6 text-blue-950">
        ${guide.steps.map(step => `<li>${step}</li>`).join("")}
      </ol>
    </div>`;
}

function updateOnboardingGuide() {
  const host = document.getElementById("onboardingGuide");
  if (!host) return;
  let dismissed = false;
  try {
    dismissed = localStorage.getItem(ONBOARDING_STORAGE_KEY) === "1";
  } catch (error) {
    dismissed = false;
  }
  const kinds = accountType === "seeker" || accountType === "employer"
    ? [accountType]
    : ["seeker", "employer"];
  host.classList.toggle("hidden", dismissed);
  if (dismissed) return;
  host.querySelector("[data-guide-body]").innerHTML = kinds.map(renderGuideColumn).join("");
  host.querySelector("[data-guide-body]").className = `mt-3 grid gap-4 ${kinds.length > 1 ? "sm:grid-cols-2" : ""}`;
}

function dismissOnboardingGuide() {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
  } catch (error) {
    // 保存できない環境では、このページ表示中だけ閉じる
  }
  document.getElementById("onboardingGuide")?.classList.add("hidden");
}

(function hookOnboardingGuide() {
  const original = updateAccountSearchSurface;
  updateAccountSearchSurface = function () {
    original.apply(this, arguments);
    updateOnboardingGuide();
  };
  updateOnboardingGuide();
})();
