function initializeEmployerTurnstile() {
  const siteKey = document.querySelector('meta[name="cloudflare-turnstile-sitekey"]').content.trim();
  if (!siteKey) return;

  setTurnstileStatus("CAPTCHA確認画面を読み込んでいます。");
  const script = document.createElement("script");
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoaded&render=explicit";
  script.async = true;
  script.defer = true;
  script.onerror = () => setTurnstileStatus("CAPTCHAを読み込めませんでした。ページを再読み込みしてください。", true);
  document.head.appendChild(script);
}

function onTurnstileLoaded() {
  const siteKey = document.querySelector('meta[name="cloudflare-turnstile-sitekey"]').content.trim();
  if (!siteKey || !window.turnstile) {
    setTurnstileStatus("CAPTCHAの設定を確認できませんでした。ページを再読み込みしてください。", true);
    return;
  }

  turnstileReady = true;
  if (loginPanelOpen) {
    renderEmployerTurnstile();
  } else {
    setTurnstileStatus("ログイン画面を開くとCAPTCHAを表示します。");
  }
}

function renderEmployerTurnstile() {
  if (!turnstileReady || turnstileWidgetId !== null || !loginPanelOpen) return;
  const container = document.getElementById("employerTurnstile");
  if (!container || !container.getClientRects().length) return;
  const siteKey = document.querySelector('meta[name="cloudflare-turnstile-sitekey"]').content.trim();
  turnstileWidgetId = window.turnstile.render("#employerTurnstile", {
    sitekey: siteKey,
    callback: token => {
      turnstileToken = token;
      setTurnstileStatus("CAPTCHA確認が完了しました。");
    },
    "expired-callback": () => {
      turnstileToken = null;
      setTurnstileStatus("確認の有効期限が切れました。もう一度確認してください。", true);
    },
    "error-callback": errorCode => {
      turnstileToken = null;
      setTurnstileStatus(`CAPTCHA確認に失敗しました（エラーコード: ${errorCode}）。もう一度お試しください。`, true);
      return true;
    }
  });
  setTurnstileStatus("CAPTCHAを確認してからログインしてください。");
}

function setTurnstileStatus(message, isError = false) {
  const element = document.getElementById("turnstileStatus");
  element.innerText = message;
  element.classList.toggle("text-red-600", isError);
  element.classList.toggle("text-gray-500", !isError);
  element.classList.toggle("text-green-700", !isError && Boolean(turnstileToken));
}

function resetEmployerTurnstile(message = "CAPTCHAをもう一度確認してください。") {
  turnstileToken = null;
  if (turnstileWidgetId !== null && window.turnstile) {
    window.turnstile.reset(turnstileWidgetId);
  }
  setTurnstileStatus(message);
}

async function initializeEmployerAuth() {
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    updateEmployerAuth(session);
    if (_event === "PASSWORD_RECOVERY") {
      document.getElementById("passwordRecoveryPanel").classList.remove("hidden");
      document.getElementById("newPassword").focus();
    }
  });
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    setAuthMessage(`ログイン状態の確認に失敗しました: ${error.message}`, true);
    return;
  }
  updateEmployerAuth(data.session);
}

function updateEmployerAuth(session) {
  const previousUserId = currentUser?.id || null;
  currentUser = session?.user || null;
  document.getElementById("employerLoggedOut").classList.toggle("hidden", Boolean(currentUser));
  const loggedInPanel = document.getElementById("employerLoggedIn");
  loggedInPanel.classList.toggle("hidden", !currentUser);
  loggedInPanel.classList.toggle("flex", Boolean(currentUser));
  document.getElementById("employerAccountEmail").innerText = currentUser?.email || "";
  if (previousUserId !== (currentUser?.id || null)) {
    if (dashboardOpen) closeAccountPanel();
    if (loginPanelOpen) closeLoginPanel(false);
    accountType = null;
    resetEmployerSeekerSearch();
    dashboardOpen = false;
    loginNotificationBannerDismissed = false;
    document.getElementById("loginNotificationBanner").classList.add("hidden");
    accountTypeLoadUserId = null;
    accountTypeLoading = Boolean(currentUser);
    accountDataUserId = null;
    loadingAccountUserId = null;
    favoriteJobIds = [];
    seekerProfileData = null;
    accountApplications = [];
    accountApplicationsError = "";
    applicationMessages = [];
    applicationMessagesError = "";
    appNotifications = [];
    appNotificationsError = "";
    seekerContactRequests = [];
    seekerContactRequestsError = "";
    employerContactRequests = [];
    employerContactRequestsError = "";
    activeDashboardView = "profile";
    showDashboardView(activeDashboardView);
    clearSeekerProfileForm();
    if (currentUser) {
      switchTab("employer");
      const user = currentUser;
      setTimeout(() => loadAccountType(user), 0);
    } else switchTab("guest");
  }
  if (!currentUser &&
      !document.getElementById("employerDashboardView-job-editor").classList.contains("hidden")) {
    cancelJobEdit();
  }
  updateHeaderAccountButton();
  updateAccountTypeUI();
  renderJobList();
  renderEmployerDashboard();
  if (currentUser && accountType && accountDataUserId !== currentUser.id) {
    const user = currentUser;
    setTimeout(() => loadAccountData(user), 0);
  } else {
    renderAccountDashboard();
  }
}

function updateAccountTypeUI() {
  const hasUser = Boolean(currentUser);
  const isEmployer = accountType === "employer";
  const isSeeker = accountType === "seeker";
  updateHeaderAccountButton();
  document.getElementById("employerAuthPanel").classList.toggle("hidden", hasUser && Boolean(accountType));
  document.getElementById("accountTypeSetup").classList.toggle("hidden", !hasUser || Boolean(accountType) || accountTypeLoading);
  document.getElementById("employerDashboard").classList.toggle("hidden", !hasUser || !isEmployer || !dashboardOpen);
  document.getElementById("accountTypeMismatch").classList.toggle("hidden", !hasUser || !accountType || isEmployer);
  document.getElementById("seekerDashboard").classList.toggle("hidden", !hasUser || !isSeeker || !dashboardOpen);
  document.getElementById("seekerAccountPrompt").classList.toggle("hidden", hasUser && isSeeker);
  document.getElementById("seekerAccountPromptText").innerText = hasUser
    ? "求職者プロフィールは求職者アカウントで利用できます。"
    : "プロフィール・お気に入り・応募履歴をアカウントに保存するにはログインしてください。";
  updateAccountSearchSurface();
}

function updateHeaderAccountButton() {
  const button = document.getElementById("headerAccountButton");
  if (!button) return;
  button.innerText = !currentUser
    ? "ログイン"
    : accountType === "employer" || accountType === "seeker"
      ? "マイページ"
      : "アカウント設定";
  button.setAttribute("aria-expanded", String(Boolean(dashboardOpen || loginPanelOpen)));
}

function openAccountPanel() {
  if (currentUser?.id && (accountType === "seeker" || accountType === "employer")) {
    if (dashboardOpen) {
      closeAccountPanel();
      return;
    }
    dashboardOpen = true;
    switchTab(accountType);
    updateAccountTypeUI();
    const dashboard = document.getElementById(accountType === "seeker" ? "seekerDashboard" : "employerDashboard");
    const navigation = document.getElementById(accountType === "seeker" ? "dashboardNavigation" : "employerDashboardNavigation");
    dashboardReturnPlaceholder = document.createComment("my-page-return-point");
    dashboard.parentNode.insertBefore(dashboardReturnPlaceholder, dashboard);
    document.getElementById("myPageOverlayContent").append(dashboard);
    dashboardNavigationReturnPlaceholder = document.createComment("my-page-navigation-return-point");
    navigation.parentNode.insertBefore(dashboardNavigationReturnPlaceholder, navigation);
    const navigationSlot = document.getElementById("myPageNavigationSlot");
    navigationSlot.append(navigation);
    navigationSlot.classList.remove("hidden");
    if (accountType === "employer") showEmployerDashboardView("jobs");
    document.getElementById("myPageLogoutStatus").classList.add("hidden");
    document.getElementById("myPageLogoutStatus").innerText = "";
    updateMyPageAccountInfo();
    dashboardScrollPosition = window.scrollY;
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const overlay = document.getElementById("myPageOverlay");
    overlay.classList.remove("hidden");
    overlay.classList.add("flex");
    document.getElementById("myPageOverlayClose").focus();
    return;
  }
  if (!currentUser) {
    openLoginPanel();
    return;
  }
  switchTab("employer");
  const target = document.getElementById("accountTypeSetup");
  target.scrollIntoView({ behavior: "smooth" });
}

function openAccountNotifications() {
  if (!dashboardOpen) openAccountPanel();
  if (accountType === "seeker") showDashboardView("notifications");
  else if (accountType === "employer") showEmployerDashboardView("messages");
}

function openLoginPanel(toggle = true) {
  if (loginPanelOpen) {
    if (toggle) closeLoginPanel();
    return;
  }
  const authPanel = document.getElementById("employerAuthPanel");
  loginPanelReturnPlaceholder = document.createComment("login-panel-return-point");
  authPanel.parentNode.insertBefore(loginPanelReturnPlaceholder, authPanel);
  document.getElementById("loginOverlayContent").append(authPanel);
  loginPanelOpen = true;
  loginPanelScrollPosition = window.scrollY;
  loginPanelPreviousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  const overlay = document.getElementById("loginOverlay");
  overlay.classList.remove("hidden");
  overlay.classList.add("flex");
  updateHeaderAccountButton();
  renderEmployerTurnstile();
  document.getElementById("employerEmail").focus();
}

function closeLoginPanel(returnFocus = true) {
  if (!loginPanelOpen) return;
  const authPanel = document.getElementById("employerAuthPanel");
  if (loginPanelReturnPlaceholder?.parentNode) {
    loginPanelReturnPlaceholder.replaceWith(authPanel);
  }
  loginPanelReturnPlaceholder = null;
  loginPanelOpen = false;
  const overlay = document.getElementById("loginOverlay");
  overlay.classList.add("hidden");
  overlay.classList.remove("flex");
  document.body.style.overflow = loginPanelPreviousBodyOverflow;
  window.scrollTo({ top: loginPanelScrollPosition, behavior: "instant" });
  updateHeaderAccountButton();
  if (returnFocus) document.getElementById("headerAccountButton").focus();
}

function handleLoginOverlayClick(event) {
  if (event.target === document.getElementById("loginOverlay")) closeLoginPanel();
}

function closeAccountPanel() {
  if (!dashboardOpen) return;
  const dashboard = document.getElementById("seekerDashboard").parentNode === document.getElementById("myPageOverlayContent")
    ? document.getElementById("seekerDashboard")
    : document.getElementById("employerDashboard");
  if (dashboardNavigationReturnPlaceholder?.parentNode) {
    dashboardNavigationReturnPlaceholder.replaceWith(
      document.getElementById(accountType === "seeker" ? "dashboardNavigation" : "employerDashboardNavigation")
    );
  }
  dashboardNavigationReturnPlaceholder = null;
  document.getElementById("myPageNavigationSlot").classList.add("hidden");
  if (dashboardReturnPlaceholder?.parentNode) {
    dashboardReturnPlaceholder.replaceWith(dashboard);
  }
  dashboardReturnPlaceholder = null;
  dashboardOpen = false;
  const overlay = document.getElementById("myPageOverlay");
  overlay.classList.add("hidden");
  overlay.classList.remove("flex");
  document.body.style.overflow = previousBodyOverflow;
  window.scrollTo({ top: dashboardScrollPosition, behavior: "instant" });
  updateAccountTypeUI();
  document.getElementById("headerAccountButton").focus();
}

function handleMyPageOverlayClick(event) {
  if (event.target === document.getElementById("myPageOverlay")) closeAccountPanel();
}

function updateMyPageAccountInfo() {
  const accountTypeLabel = accountType === "seeker" ? "求職者" : accountType === "employer" ? "企業・親方" : "";
  document.getElementById("myPageAccountInfo").innerText = currentUser?.email
    ? `${currentUser.email} ・ ${accountTypeLabel}アカウント`
    : `${accountTypeLabel}アカウント`;
}

function promptLogin(message) {
  if (currentUser) return;
  setAuthMessage(message);
  openLoginPanel(false);
}

async function loadAccountType(user) {
  if (!user || currentUser?.id !== user.id || accountTypeLoadUserId === user.id) return;
  accountTypeLoadUserId = user.id;
  accountTypeLoading = true;
  updateAccountTypeUI();
  const { data, error } = await supabaseClient
    .from("account_types")
    .select("account_type")
    .eq("user_id", user.id)
    .maybeSingle();
  if (currentUser?.id !== user.id) {
    if (accountTypeLoadUserId === user.id) accountTypeLoadUserId = null;
    return;
  }
  if (error) {
    accountTypeLoadUserId = null;
    accountTypeLoading = false;
    updateAccountTypeUI();
    setAuthMessage(`アカウント種類を確認できませんでした。新しいSQL移行が必要です: ${error.message}`, true);
    console.error("アカウント種類読み込みエラー:", error);
    return;
  }

  const storedType = data?.account_type;
  const metadataType = user.user_metadata?.account_type;
  if (storedType === "seeker" || storedType === "employer") {
    accountType = storedType;
  } else if (metadataType === "seeker" || metadataType === "employer") {
    const { error: insertError } = await supabaseClient
      .from("account_types")
      .insert({ user_id: user.id, account_type: metadataType });
    if (insertError) {
      accountTypeLoadUserId = null;
      accountTypeLoading = false;
      updateAccountTypeUI();
      setAuthMessage(`アカウント種類を保存できませんでした: ${insertError.message}`, true);
      console.error("アカウント種類保存エラー:", insertError);
      return;
    }
    accountType = metadataType;
  }
  accountTypeLoadUserId = null;
  accountTypeLoading = false;
  updateAccountTypeUI();
  if (accountType) switchTab(accountType);
  renderEmployerDashboard();
  if (accountType && accountDataUserId !== user.id) loadAccountData(user);
  if (accountType === "employer") loadPublicSeekerProfiles(user);
}

async function saveAccountType() {
  const selectedType = document.getElementById("existingAccountType").value;
  if (!currentUser || accountTypeLoading || !["seeker", "employer"].includes(selectedType)) {
    setAuthMessage("アカウントの種類を選択してください。", true);
    return;
  }
  const { error } = await supabaseClient
    .from("account_types")
    .insert({ user_id: currentUser.id, account_type: selectedType });
  if (error) {
    setAuthMessage(`アカウント種類を保存できませんでした: ${error.message}`, true);
    console.error("アカウント種類保存エラー:", error);
    return;
  }
  accountType = selectedType;
  document.getElementById("existingAccountType").value = "";
  setAuthMessage("アカウント種類を登録しました。");
  updateAccountTypeUI();
  switchTab(accountType);
  renderEmployerDashboard();
  loadAccountData(currentUser);
  if (accountType === "employer") loadPublicSeekerProfiles(currentUser);
}

function setAuthMessage(message, isError = false) {
  const element = document.getElementById("authMessage");
  element.innerText = message;
  element.classList.remove("hidden", "text-red-600", "text-green-700");
  element.classList.add(isError ? "text-red-600" : "text-green-700");
}

function showPasswordResetRequest() {
  const email = document.getElementById("employerEmail").value.trim();
  document.getElementById("passwordResetRequestPanel").classList.remove("hidden");
  if (!email) {
    document.getElementById("employerEmail").focus();
    setAuthMessage("登録したメールアドレスを入力してから、再設定メールを送ってください。", true);
    return;
  }
  setAuthMessage("登録したメールアドレスを確認し、「再設定メールを送る」を押してください。");
}

function hidePasswordResetRequest() {
  document.getElementById("passwordResetRequestPanel").classList.add("hidden");
}

async function sendPasswordReset() {
  const email = document.getElementById("employerEmail").value.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setAuthMessage("登録したメールアドレスを正しく入力してください。", true);
    document.getElementById("employerEmail").focus();
    return;
  }

  const button = document.querySelector("#passwordResetRequestPanel button[onclick='sendPasswordReset()']");
  button.disabled = true;
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}${window.location.pathname}`
  });
  button.disabled = false;
  if (error) {
    setAuthMessage(`再設定メールを送れませんでした: ${error.message}`, true);
    return;
  }
  setAuthMessage("再設定メールを送信しました。受信箱と迷惑メールを確認し、メール内のリンクを開いてください。");
}

async function saveNewPassword() {
  const password = document.getElementById("newPassword").value;
  const confirmation = document.getElementById("confirmNewPassword").value;
  if (password.length < 8) {
    setAuthMessage("新しいパスワードは8文字以上で入力してください。", true);
    return;
  }
  if (password !== confirmation) {
    setAuthMessage("2つのパスワードが一致しません。もう一度確認してください。", true);
    return;
  }

  const { error } = await supabaseClient.auth.updateUser({ password });
  if (error) {
    setAuthMessage(`パスワードを更新できませんでした: ${error.message}`, true);
    return;
  }
  document.getElementById("passwordRecoveryPanel").classList.add("hidden");
  document.getElementById("newPassword").value = "";
  document.getElementById("confirmNewPassword").value = "";
  setAuthMessage("パスワードを変更しました。このままログインして利用できます。");
}

async function signInEmployer() {
  const email = document.getElementById("employerEmail").value.trim();
  const password = document.getElementById("employerPassword").value;
  if (!email || !password) {
    setAuthMessage("メールアドレスとパスワードを入力してください。", true);
    return;
  }
  if (!turnstileToken) {
    setAuthMessage("ログインの前にCAPTCHA確認を完了してください。", true);
    return;
  }

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken: turnstileToken }
  });
  resetEmployerTurnstile();
  if (error) {
    setAuthMessage(`ログインに失敗しました: ${error.message}`, true);
    return;
  }
  setAuthMessage("ログインしました。");
}

async function signOutEmployer() {
  const button = document.getElementById("myPageLogoutButton");
  const logoutStatus = document.getElementById("myPageLogoutStatus");
  button.disabled = true;
  button.innerText = "ログアウト中…";
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      setAuthMessage(`ログアウトに失敗しました: ${error.message}`, true);
      logoutStatus.innerText = `ログアウトに失敗しました: ${error.message}`;
      logoutStatus.classList.remove("hidden");
      return;
    }
    setAuthMessage("ログアウトしました。");
  } finally {
    button.disabled = false;
    button.innerText = "ログアウト";
  }
}

function switchTab(tab) {
  if (currentUser && (accountType === "seeker" || accountType === "employer")) {
    tab = accountType;
  }
  activeTab = tab;
  const employerSection = document.getElementById("employerSection");
  const seekerSection = document.getElementById("seekerSection");
  const jobListSection = document.getElementById("jobListSection");
  const jobSearchPanel = document.getElementById("jobSearchPanel");
  const jobSearchTitle = document.getElementById("jobSearchTitle");
  const jobSearchDescription = document.getElementById("jobSearchDescription");
  const jobList = document.getElementById("jobList");
  const jobCount = document.getElementById("jobCount");
  const tabEmployerBtn = document.getElementById("tabEmployerBtn");
  const tabSeekerBtn = document.getElementById("tabSeekerBtn");
  const isSeekerTab = tab === "seeker";
  jobSearchTitle.innerText = isSeekerTab ? "おすすめ求人を条件で絞り込む" : "求人を検索・絞り込み";
  jobSearchDescription.innerText = isSeekerTab
    ? "プロフィールに登録した希望条件を参考に、おすすめ順で表示しています。条件を選ぶと求人をさらに絞り込めます。"
    : "キーワードや条件を指定して、希望に合う求人を探せます。";

  if (tab === "guest") {
    employerSection.classList.add("hidden");
    seekerSection.classList.add("hidden");
    jobListSection.classList.add("order-first", "md:col-span-2");
    jobSearchPanel.classList.remove("hidden");
    jobList.classList.remove("hidden");
    jobCount.classList.remove("hidden");
    document.getElementById("jobListTitle").innerText = "現場求人一覧";
    document.getElementById("jobListDescription").classList.add("hidden");
    updateAccountSearchSurface();
    renderJobList();
    return;
  }

  if (tab === 'employer') {
    document.getElementById("jobSort").value = "newest";
    employerSection.classList.remove("hidden");
    seekerSection.classList.add("hidden");
    jobListSection.classList.remove("order-first", "md:col-span-2");
    tabEmployerBtn.className = "flex-1 py-3.5 font-bold text-sm md:text-base border-b-2 border-blue-600 text-blue-600 focus:outline-none transition";
    tabSeekerBtn.className = "flex-1 py-3.5 font-bold text-sm md:text-base border-b-2 border-transparent text-gray-500 hover:text-blue-600 focus:outline-none transition";
    jobSearchPanel.classList.remove("hidden");
    jobList.classList.remove("hidden");
    jobCount.classList.remove("hidden");
    document.getElementById("jobListTitle").innerText = "現場求人一覧";
    document.getElementById("jobListDescription").classList.add("hidden");
  } else {
    document.getElementById("jobSort").value = "recommended";
    employerSection.classList.add("hidden");
    seekerSection.classList.remove("hidden");
    jobListSection.classList.add("order-first", "md:col-span-2");
    jobSearchPanel.classList.remove("hidden");
    jobList.classList.remove("hidden");
    jobCount.classList.remove("hidden");
    tabSeekerBtn.className = "flex-1 py-3.5 font-bold text-sm md:text-base border-b-2 border-blue-600 text-blue-600 focus:outline-none transition";
    tabEmployerBtn.className = "flex-1 py-3.5 font-bold text-sm md:text-base border-b-2 border-transparent text-gray-500 hover:text-blue-600 focus:outline-none transition";
    document.getElementById("jobListTitle").innerText = "希望に合う求人を探す";
    document.getElementById("jobListDescription").classList.remove("hidden");
  }
  renderJobList();
  updateAccountSearchSurface();
}
