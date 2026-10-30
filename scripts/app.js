let cachedJobs = [];
let selectedJob = null;
let favoriteJobIds = [];
let seekerProfileData = null;
let accountApplications = [];
let accountApplicationsError = "";
let applicationMessages = [];
let applicationMessagesError = "";
let appNotifications = [];
let appNotificationsError = "";
let seekerContactRequests = [];
let seekerContactRequestsError = "";
let employerContactRequests = [];
let employerContactRequestsError = "";
let accountDataUserId = null;
let loadingAccountUserId = null;
let activeDashboardView = "profile";
let editingJobId = null;
let activeTab = "seeker";
let currentUser = null;
let accountType = null;
let dashboardOpen = false;
let loginNotificationBannerDismissed = false;
let loginPanelOpen = false;
let dashboardReturnPlaceholder = null;
let dashboardNavigationReturnPlaceholder = null;
let loginPanelReturnPlaceholder = null;
let dashboardScrollPosition = 0;
let loginPanelScrollPosition = 0;
let previousBodyOverflow = "";
let loginPanelPreviousBodyOverflow = "";
let accountTypeLoadUserId = null;
let accountTypeLoading = false;
let turnstileToken = null;
let turnstileWidgetId = null;
let turnstileReady = false;
let reportTurnstileToken = null;
let reportTurnstileWidgetId = null;

let displayLimitJobs = 10;

let reviewContext = null; // { applicationId, revieweeId, targetType, existingId }
let blockedUserIds = []; // 自分がブロックしているユーザーID
let avgRatings = {}; // { userId: { avg, count } }
let accountReviews = []; // 自分が書いたレビュー


document.addEventListener("DOMContentLoaded", () => {
  initializeProfileOptionControls();
  document.getElementById("employerDashboardJobFormSlot").append(
    document.getElementById("employerJobForm")
  );
  switchTab("guest");
  fetchJobs();
  initializeEmployerAuth();
  initializeEmployerTurnstile();
});

document.addEventListener("keydown", event => {
  const applicationDetailOverlay = document.getElementById("applicationDetailOverlay");
  const applicationDetailOpen = applicationDetailOverlay && !applicationDetailOverlay.classList.contains("hidden");
  if (event.key === "Escape") {
    if (applicationDetailOpen) closeApplicationNotification();
    else if (!document.getElementById("jobModal").classList.contains("hidden")) closeModal();
    else if (dashboardOpen &&
        !document.getElementById("employerDashboardView-job-editor").classList.contains("hidden")) cancelJobEdit();
    else if (dashboardOpen) closeAccountPanel();
    else if (loginPanelOpen) closeLoginPanel();
    return;
  }
  if (event.key !== "Tab" || (!applicationDetailOpen && !dashboardOpen && !loginPanelOpen)) return;

  const dialog = applicationDetailOpen
    ? applicationDetailOverlay.querySelector("[role='dialog']")
    : document.querySelector(dashboardOpen
      ? "#myPageOverlay [role='dialog']"
      : "#loginOverlay [role='dialog']");
  const focusable = Array.from(dialog.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter(element => element.getClientRects().length > 0);
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});
