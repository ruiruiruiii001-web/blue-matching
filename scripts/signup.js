let signupTurnstileToken = null;
let signupTurnstileWidgetId = null;
let signupTurnstileReady = false;

function setSignupStatus(message, isError = false) {
  const status = document.getElementById("signupStatus");
  status.innerText = message;
  status.classList.toggle("text-red-700", isError);
  status.classList.toggle("text-gray-600", !isError);
  status.classList.toggle("text-green-700", !isError && Boolean(signupTurnstileToken));
}

function renderSignupTurnstile() {
  if (!signupTurnstileReady || signupTurnstileWidgetId !== null) return;
  const siteKey = document.querySelector('meta[name="cloudflare-turnstile-sitekey"]').content.trim();
  if (!siteKey) {
    setSignupStatus("CAPTCHAの設定を確認できませんでした。ページを再読み込みしてください。", true);
    return;
  }
  signupTurnstileWidgetId = window.turnstile.render("#signupTurnstile", {
    sitekey: siteKey,
    callback: token => {
      signupTurnstileToken = token;
      setSignupStatus("CAPTCHA確認が完了しました。");
    },
    "expired-callback": () => {
      signupTurnstileToken = null;
      setSignupStatus("確認の有効期限が切れました。もう一度確認してください。", true);
    },
    "error-callback": errorCode => {
      signupTurnstileToken = null;
      setSignupStatus(`CAPTCHA確認に失敗しました（エラーコード: ${errorCode}）。もう一度お試しください。`, true);
      return true;
    }
  });
  setSignupStatus("CAPTCHAを確認してから登録してください。");
}

window.onSignupTurnstileLoaded = () => {
  if (!window.turnstile) {
    setSignupStatus("CAPTCHAを読み込めませんでした。ページを再読み込みしてください。", true);
    return;
  }
  signupTurnstileReady = true;
  renderSignupTurnstile();
};

async function submitSignup(event) {
  event.preventDefault();
  const accountType = document.getElementById("signupAccountType").value;
  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value;
  const confirmation = document.getElementById("signupPasswordConfirmation").value;

  if (!["seeker", "employer"].includes(accountType)) {
    setSignupStatus("アカウントの種類を選択してください。", true);
    return;
  }
  if (password.length < 8) {
    setSignupStatus("パスワードは8文字以上で入力してください。", true);
    return;
  }
  if (password !== confirmation) {
    setSignupStatus("パスワードが一致しません。確認用の入力を見直してください。", true);
    document.getElementById("signupPasswordConfirmation").focus();
    return;
  }
  if (!signupTurnstileToken) {
    setSignupStatus("登録の前にCAPTCHA確認を完了してください。", true);
    return;
  }

  const button = document.getElementById("signupSubmit");
  button.disabled = true;
  button.innerText = "登録中...";
  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        captchaToken: signupTurnstileToken,
        data: { account_type: accountType }
      }
    });
    if (error) {
      signupTurnstileToken = null;
      if (window.turnstile && signupTurnstileWidgetId !== null) {
        window.turnstile.reset(signupTurnstileWidgetId);
      }
      setSignupStatus(`新規登録に失敗しました: ${error.message}`, true);
      return;
    }

    document.getElementById("signupPassword").value = "";
    document.getElementById("signupPasswordConfirmation").value = "";
    if (!data.session) {
      setSignupStatus("登録を受け付けました。確認メールが届いた場合は、メール内のリンクを開いてからログインしてください。");
    } else {
      setSignupStatus("アカウントを作成しました。ログイン後の画面へ移動します。");
      window.setTimeout(() => window.location.assign("index.html"), 1000);
    }
  } finally {
    button.disabled = false;
    button.innerText = "アカウントを作成";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const siteKey = document.querySelector('meta[name="cloudflare-turnstile-sitekey"]').content.trim();
  if (!siteKey) {
    setSignupStatus("新規登録の安全対策を準備中です。設定完了までお待ちください。", true);
    return;
  }
  document.getElementById("signupForm").addEventListener("submit", submitSignup);
  const script = document.createElement("script");
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onSignupTurnstileLoaded&render=explicit";
  script.async = true;
  script.defer = true;
  script.onerror = () => setSignupStatus("CAPTCHAを読み込めませんでした。ページを再読み込みしてください。", true);
  document.head.appendChild(script);
});
