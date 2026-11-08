const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");

async function submitApplication(pilot, mailError = null) {
  const html = fs.readFileSync(path.join(root, "apply.html"), "utf8");
  const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
  const nodes = new Map();
  let submit;
  let calls = 0;
  let redirected = "";
  const stored = new Map();
  const job = { id: 32, owner_id: "employer", title: "Test", is_closed: false };
  const client = {
    auth: { getSession: async () => ({ data: { session: { user: { id: "seeker" } } }, error: null }) },
    functions: { invoke: async () => { calls++; return { error: mailError }; } },
    from(table) {
      const query = {
        select() { return query; },
        eq() { return query; },
        insert() { return query; },
        async single() { return { data: { id: "application" }, error: null }; },
        async maybeSingle() {
          const data = table === "published_jobs" ? job
            : table === "account_types" ? { account_type: "seeker" }
              : table === "seeker_profiles" ? { name: "Test" } : null;
          return { data, error: null };
        }
      };
      return query;
    }
  };
  const document = {
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, {
        value: "", textContent: "", classList: { add() {}, remove() {}, toggle() {} },
        addEventListener(type, handler) { if (id === "applicationForm" && type === "submit") submit = handler; },
        focus() {}
      });
      return nodes.get(id);
    }
  };
  const context = vm.createContext({
    PILOT_MODE: pilot, document, URL, URLSearchParams, console: { error() {} },
    window: { supabase: { createClient: () => client }, location: {
      search: "?jobId=32", origin: "https://example.test", replace: url => { redirected = url; }
    } },
    sessionStorage: { setItem: (key, value) => stored.set(key, value) },
    getWorkCategoryLabel: () => "", getPaymentMethodLabel: () => "",
    getSuspiciousContentWarnings: () => []
  });
  vm.runInContext(script, context);
  await vm.runInContext("initializeApplication()", context);
  await submit({ preventDefault() {} });
  return { calls, stored, redirected, notice: document.getElementById("applicationNotice").textContent };
}

test("pilot application skips email but preserves successful submission and explains the pause", async () => {
  const result = await submitApplication(true);
  assert.equal(result.calls, 0);
  assert.match(result.redirected, /applicationChat=application/);
  assert.match(result.notice, /通知メールを送信しません/);
});

test("outside pilot application sends email and preserves delivery failures", async () => {
  const result = await submitApplication(false, { message: "delivery failed" });
  assert.equal(result.calls, 1);
  assert.match(result.stored.get("applicationNotificationWarning:application"), /delivery failed/);
  assert.match(result.redirected, /applicationChat=application/);
});

test("pilot status updates skip email, while normal mode calls it and displays failures", async () => {
  const script = fs.readFileSync(path.join(root, "scripts", "account-data.js"), "utf8");
  for (const pilot of [true, false]) {
    let calls = 0;
    const alerts = [];
    const query = {
      update() { return this; }, eq() { return this; }, select() { return this; },
      async maybeSingle() { return { data: { id: "application" }, error: null }; }
    };
    const context = vm.createContext({
      PILOT_MODE: pilot, currentUser: { id: "employer" }, accountType: "employer",
      supabaseClient: { from: () => query },
      sendNotificationEmail: async () => { calls++; return "メール送信失敗"; },
      loadAccountData: async () => {}, refreshApplicationNotificationView() {},
      alert: message => alerts.push(message)
    });
    vm.runInContext(script, context);
    context.loadAccountData = async () => {};
    context.refreshApplicationNotificationView = () => {};
    await context.updateApplicationStatus("application", "reviewed");
    assert.equal(calls, pilot ? 0 : 1);
    assert.deepEqual(alerts, pilot ? [] : ["メール送信失敗"]);
  }
});

test("pilot contact replies skip email, while normal mode reports delivery failures", async () => {
  const script = fs.readFileSync(path.join(root, "scripts", "notifications.js"), "utf8");
  for (const pilot of [true, false]) {
    let calls = 0;
    const status = { innerText: "", classList: { add() {}, remove() {} } };
    const query = {
      update() { return this; }, eq() { return this; }, select() { return this; },
      async maybeSingle() { return { data: { id: "request" }, error: null }; }
    };
    const context = vm.createContext({
      PILOT_MODE: pilot, currentUser: { id: "seeker" }, accountType: "seeker",
      seekerContactRequests: [{ id: "request", seeker_id: "seeker", status: "pending" }],
      appNotifications: [], supabaseClient: { from: () => query },
      document: { getElementById: id => id === "accountDashboardStatus" ? status : { value: "テスト返信" } },
      renderAccountDashboard() {}, console
    });
    vm.runInContext(script, context);
    context.sendNotificationEmail = async () => { calls++; return "メール送信失敗"; };
    await context.respondToContactRequest("request", "responded");
    assert.equal(calls, pilot ? 0 : 1);
    assert.equal(status.innerText, pilot ? "" : "メール送信失敗");
  }
});

test("reviewed notification opens the application for the seeker", () => {
  const script = fs.readFileSync(path.join(root, "scripts", "notifications.js"), "utf8");
  const container = { innerHTML: "" };
  const status = { innerText: "", classList: { toggle() {} } };
  const context = vm.createContext({
    accountType: "seeker", currentUser: { id: "seeker" }, appNotificationsError: "",
    seekerContactRequestsError: "", employerContactRequestsError: "",
    appNotifications: [{ id: "notice", event_type: "application_reviewed", related_id: "application", title: "お仕事が確定しました", created_at: "2030-01-01" }],
    accountApplications: [{ id: "application", job_title: "Test", applicant_id: "seeker" }],
    document: { getElementById: id => id === "container" ? container : status },
    escapeHtml: value => value, formatDashboardDate: value => value
  });
  vm.runInContext(script, context);
  context.renderNotifications("container", "status");
  assert.match(container.innerHTML, /お仕事が確定しました/);
  assert.match(container.innerHTML, /openApplicationNotification\('application', 'notice', this\)/);
  assert.match(container.innerHTML, /Test/);
});
