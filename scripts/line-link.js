const LINE_LINK_TOKEN_KEY = "blueMatchingLineLinkToken";

function setLineLinkStatus(message, isError = false) {
  const status = document.getElementById("lineLinkStatus");
  status.textContent = message;
  status.classList.toggle("text-red-700", isError);
  status.classList.toggle("text-gray-700", !isError);
}

async function initializeLineLink() {
  const url = new URL(window.location.href);
  const suppliedToken = url.searchParams.get("linkToken");
  let token = suppliedToken;
  let tokenStored = false;
  if (suppliedToken) {
    url.searchParams.delete("linkToken");
    window.history.replaceState(null, "", url.toString());
    try {
      sessionStorage.setItem(LINE_LINK_TOKEN_KEY, suppliedToken);
      tokenStored = true;
    } catch (error) {
      console.error("LINE連携情報を一時保存できませんでした:", error);
    }
  } else {
    try {
      token = sessionStorage.getItem(LINE_LINK_TOKEN_KEY);
      tokenStored = Boolean(token);
    } catch (error) {
      console.error("LINE連携情報を読み込めませんでした:", error);
    }
  }
  if (!token || !/^[A-Za-z0-9_-]{1,255}$/.test(token)) {
    setLineLinkStatus("LINE公式アカウントに「連携」と送信し、届いたリンクを開いてください。", true);
    return;
  }
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    setLineLinkStatus(`ログイン状態を確認できませんでした: ${error.message}`, true);
    return;
  }
  if (!data.session?.user) {
    if (!tokenStored) {
      setLineLinkStatus("連携情報を保存できませんでした。先にサイトへログインしてから、LINEで「連携」と送り直してください。", true);
    } else {
      setLineLinkStatus("お仕事をお願いする方のアカウントでサイトにログインしてください。ログイン後、自動的にこの連携画面へ戻ります。リンクの有効期間は10分です。");
    }
    const login = document.getElementById("lineLinkLogin");
    login.href = "index.html?lineLink=resume";
    login.classList.remove("hidden");
    login.classList.add("inline-flex");
    return;
  }
  setLineLinkStatus(`ログイン中: ${data.session.user.email || "アカウント"}。このアカウントで連携する場合は下のボタンを押してください。`);
  const button = document.getElementById("lineLinkSubmit");
  button.classList.remove("hidden");
  button.addEventListener("click", async () => {
    button.disabled = true;
    setLineLinkStatus("LINEへ接続しています。");
    const { data: result, error: invokeError } = await supabaseClient.functions.invoke("line-link", {
      body: { action: "start", linkToken: token }
    });
    if (invokeError || !result?.redirectUrl) {
      console.error("LINE連携を開始できませんでした:", invokeError);
      setLineLinkStatus("LINE連携を開始できませんでした。掲載者アカウントでログインし、LINEから新しいリンクを開いてください。", true);
      button.disabled = false;
      return;
    }
    const redirect = new URL(result.redirectUrl);
    if (redirect.origin !== "https://access.line.me" || redirect.pathname !== "/dialog/bot/accountLink") {
      console.error("LINE連携先が不正です");
      setLineLinkStatus("LINE連携先を確認できませんでした。", true);
      button.disabled = false;
      return;
    }
    try {
      sessionStorage.removeItem(LINE_LINK_TOKEN_KEY);
    } catch (error) {
      console.error("LINE連携情報を削除できませんでした:", error);
    }
    window.location.assign(redirect.toString());
  });
}

initializeLineLink().catch(error => {
  console.error("LINE連携画面を読み込めませんでした:", error);
  setLineLinkStatus("LINE連携画面を読み込めませんでした。ページを再読み込みしてください。", true);
});
