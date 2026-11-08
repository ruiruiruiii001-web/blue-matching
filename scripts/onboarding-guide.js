const ONBOARDING_STORAGE_KEY = "blueMatchingGuideDismissed";

const ONBOARDING_STEPS = {
  seeker: {
    title: "お仕事を探す方へ：仕事確定までの流れ",
    steps: [
      "「新規登録」で「お仕事を探す方」アカウントを作ります。確認メールが届いたら、リンクを開いてログインします。",
      "マイページで希望する仕事や勤務地などを登録します。",
      PILOT_MODE ? "勤務地・給与・資格でお仕事を探します。" : "勤務地・給与・資格でお仕事を探し、気になるお仕事は★でお気に入りに入れます。",
      "お仕事詳細から応募します。電話番号は不要で、連絡はサイト内のメッセージで行います。",
      "応募後すぐに掲載者とチャットできます。条件を確認し、掲載者がお仕事を確定するまで作業を始めないでください。"
    ]
  },
  employer: {
    title: "お仕事をお願いする方へ：募集の流れ",
    steps: [
      "「新規登録」で「お仕事をお願いする方」アカウントを作ります。確認メールが届いたら、リンクを開いてログインします。",
      "マイページで掲載者プロフィールを登録し、「募集の管理」からお仕事を投稿します。写真は5枚まで登録できます。",
      "新しい募集は運営の審査後に公開されます。審査結果はマイページの「募集の管理」で確認できます。",
      "応募が届いたらチャットで条件を確認し、「お仕事を確定する」か、理由を添えて「対応不要」にします。",
      PILOT_MODE ? "プロフィール公開に同意した方は、「働ける人を探す」から探せます。" : "プロフィール公開に同意した方は、「働ける人を探す」から探せます。今日働ける方で絞り込むこともできます。"
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

function renderOnboardingGuide(host) {
  const kinds = accountType === "seeker" || accountType === "employer"
    ? [accountType]
    : ["seeker", "employer"];
  host.querySelector("[data-guide-body]").innerHTML = kinds.map(renderGuideColumn).join("");
  host.querySelector("[data-guide-body]").className = `mt-3 grid gap-4 ${kinds.length > 1 ? "sm:grid-cols-2" : ""}`;
}

function updateOnboardingGuide() {
  const host = document.getElementById("onboardingGuide");
  if (!host) return;
  const reopenButton = document.getElementById("showOnboardingGuide");
  let dismissed = false;
  try {
    dismissed = localStorage.getItem(ONBOARDING_STORAGE_KEY) === "1";
  } catch (error) {
    dismissed = false;
  }
  host.classList.toggle("hidden", dismissed);
  reopenButton.classList.toggle("hidden", !dismissed);
  if (dismissed) return;
  renderOnboardingGuide(host);
}

function dismissOnboardingGuide() {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
  } catch (error) {
    // 保存できない環境では、このページ表示中だけ閉じる
  }
  document.getElementById("onboardingGuide")?.classList.add("hidden");
  document.getElementById("showOnboardingGuide")?.classList.remove("hidden");
}

function showOnboardingGuide() {
  try {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
  } catch (error) {
    console.error("案内の表示設定を保存できませんでした:", error);
  }
  const host = document.getElementById("onboardingGuide");
  renderOnboardingGuide(host);
  host.classList.remove("hidden");
  document.getElementById("showOnboardingGuide").classList.add("hidden");
}

(function hookOnboardingGuide() {
  const original = updateAccountSearchSurface;
  updateAccountSearchSurface = function () {
    original.apply(this, arguments);
    updateOnboardingGuide();
  };
  updateOnboardingGuide();
})();
