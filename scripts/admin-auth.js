let adminTurnstileToken = null;
let adminTurnstileWidgetId = null;
let adminTurnstileStarted = false;

function setAdminTurnstileStatus(message, isError = false) {
  const status = document.getElementById("adminTurnstileStatus");
  status.textContent = message;
  status.classList.toggle("text-red-700", isError);
  status.classList.toggle("text-gray-600", !isError);
}

function initializeAdminTurnstile() {
  if (adminTurnstileStarted) return;
  const siteKey = document.querySelector('meta[name="cloudflare-turnstile-sitekey"]').content.trim();
  if (!siteKey) {
    setAdminTurnstileStatus("CAPTCHAの設定を確認できませんでした。管理者にお問い合わせください。", true);
    return;
  }
  adminTurnstileStarted = true;
  setAdminTurnstileStatus("CAPTCHA確認画面を読み込んでいます。");
  const script = document.createElement("script");
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onAdminTurnstileLoaded&render=explicit";
  script.async = true;
  script.defer = true;
  script.onerror = () => setAdminTurnstileStatus("CAPTCHAを読み込めませんでした。ページを再読み込みしてください。", true);
  document.head.appendChild(script);
}

window.onAdminTurnstileLoaded = () => {
  if (!window.turnstile) {
    setAdminTurnstileStatus("CAPTCHAを読み込めませんでした。ページを再読み込みしてください。", true);
    return;
  }
  const siteKey = document.querySelector('meta[name="cloudflare-turnstile-sitekey"]').content.trim();
  adminTurnstileWidgetId = window.turnstile.render("#adminTurnstile", {
    sitekey: siteKey,
    callback: token => {
      adminTurnstileToken = token;
      setAdminTurnstileStatus("CAPTCHA確認が完了しました。");
    },
    "expired-callback": () => {
      adminTurnstileToken = null;
      setAdminTurnstileStatus("確認の有効期限が切れました。もう一度確認してください。", true);
    },
    "error-callback": errorCode => {
      adminTurnstileToken = null;
      setAdminTurnstileStatus(`CAPTCHA確認に失敗しました（エラーコード: ${errorCode}）。もう一度お試しください。`, true);
      return true;
    }
  });
  setAdminTurnstileStatus("CAPTCHAを確認してからログインしてください。");
};

async function submitAdminLogin(event) {
  event.preventDefault();
  if (!adminTurnstileToken) {
    setAdminStatus("ログインの前にCAPTCHA確認を完了してください。", true);
    return;
  }
  const button = document.getElementById("adminLoginSubmit");
  if (button.disabled) return;
  button.disabled = true;
  setAdminStatus("ログインしています…");
  try {
    const { error } = await supabaseClient.auth.signInWithPassword({
      email: document.getElementById("adminEmail").value.trim(),
      password: document.getElementById("adminPassword").value,
      options: { captchaToken: adminTurnstileToken }
    });
    if (error) {
      console.error("運営ログインエラー:", error);
      if (error.code === "invalid_credentials") {
        setAdminStatus("ログインできませんでした。メールアドレスとパスワードを確認してください。", true);
      } else if (error.code === "captcha_failed" || /captcha/i.test(error.message)) {
        setAdminStatus("CAPTCHAの確認に失敗しました。もう一度確認してください。", true);
      } else {
        setAdminStatus("ログインできませんでした。時間をおいてもう一度お試しください。", true);
      }
      return;
    }
    document.getElementById("adminPassword").value = "";
    await initializeAdmin();
  } catch (error) {
    console.error("運営ログイン処理エラー:", error);
    setAdminStatus("ログイン処理に失敗しました。通信状態を確認してもう一度お試しください。", true);
  } finally {
    adminTurnstileToken = null;
    if (adminTurnstileWidgetId !== null && window.turnstile) {
      window.turnstile.reset(adminTurnstileWidgetId);
    }
    button.disabled = false;
  }
}
