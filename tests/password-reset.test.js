const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function setup({ token = "captcha-token", email = "user@example.test", outcome = {} } = {}) {
  const script = fs.readFileSync(path.join(__dirname, "..", "scripts", "account.js"), "utf8");
  const nodes = {
    employerEmail: { value: email, focus() {} },
    authMessage: { innerText: "", classList: { add() {}, remove() {} } },
    turnstileStatus: { innerText: "", classList: { toggle() {} } }
  };
  const button = { disabled: false };
  const calls = [];
  let resets = 0;
  const context = vm.createContext({
    URLSearchParams,
    document: {
      getElementById: id => nodes[id],
      querySelector: () => button
    },
    window: {
      location: { origin: "https://example.test", pathname: "/index.html" },
      turnstile: { reset: () => { resets++; } }
    },
    turnstileToken: token,
    turnstileWidgetId: "widget",
    supabaseClient: {
      auth: {
        async resetPasswordForEmail(address, options) {
          calls.push({ address, options });
          if (outcome.throwError) throw new Error("network failure");
          return outcome;
        }
      }
    },
    console: { error() {} }
  });
  vm.runInContext(script, context);
  return { context, nodes, button, calls, getResets: () => resets };
}

test("password reset sends CAPTCHA and resets it after success", async () => {
  const state = setup();
  await state.context.sendPasswordReset();
  assert.equal(state.calls.length, 1);
  assert.equal(state.calls[0].address, "user@example.test");
  assert.equal(state.calls[0].options.captchaToken, "captcha-token");
  assert.equal(state.calls[0].options.redirectTo, "https://example.test/index.html");
  assert.equal(state.context.turnstileToken, null);
  assert.equal(state.getResets(), 1);
  assert.equal(state.button.disabled, false);
  assert.match(state.nodes.authMessage.innerText, /送信しました/);
});

test("password reset requires a valid email and CAPTCHA", async () => {
  for (const options of [{ email: "invalid" }, { token: null }]) {
    const state = setup(options);
    await state.context.sendPasswordReset();
    assert.equal(state.calls.length, 0);
    assert.equal(state.getResets(), 0);
    assert.match(state.nodes.authMessage.innerText, /正しく入力|CAPTCHA/);
  }
});

test("password reset reports API and network errors and permits retry", async () => {
  for (const outcome of [{ error: { message: "rejected" } }, { throwError: true }]) {
    const state = setup({ outcome });
    await state.context.sendPasswordReset();
    assert.equal(state.calls.length, 1);
    assert.equal(state.context.turnstileToken, null);
    assert.equal(state.getResets(), 1);
    assert.equal(state.button.disabled, false);
    assert.match(state.nodes.authMessage.innerText, /送れませんでした/);
  }
});

test("recovery event opens the password panel and keeps it visible after account loading", async () => {
  const script = fs.readFileSync(path.join(__dirname, "..", "scripts", "account.js"), "utf8");
  const nodes = new Map();
  function node(id) {
    if (!nodes.has(id)) {
      const classes = new Set(["hidden"]);
      nodes.set(id, {
        classList: {
          add: name => classes.add(name),
          remove: name => classes.delete(name),
          contains: name => classes.has(name),
          toggle(name, force) { if (force) classes.add(name); else classes.delete(name); }
        },
        focus() { this.focused = true; }
      });
    }
    return nodes.get(id);
  }
  let handler;
  const context = vm.createContext({
    URLSearchParams,
    document: { getElementById: node },
    window: { location: { search: "", replace() {} } },
    supabaseClient: {
      auth: {
        onAuthStateChange: callback => { handler = callback; },
        getSession: async () => ({ data: { session: null }, error: null })
      }
    },
    currentUser: null, accountType: null, accountTypeLoading: false, dashboardOpen: false,
    loginPanelOpen: false, passwordRecoveryActive: false, PILOT_MODE: true
  });
  vm.runInContext(script, context);
  context.updateEmployerAuth = session => { context.currentUser = session?.user || null; };
  context.openLoginPanel = () => { context.loginPanelOpen = true; };
  context.updateHeaderAccountButton = () => {};
  context.updateAccountSearchSurface = () => {};
  await context.initializeEmployerAuth();
  handler("PASSWORD_RECOVERY", { user: { id: "user" } });
  assert.equal(context.passwordRecoveryActive, true);
  assert.equal(context.loginPanelOpen, true);
  assert.equal(node("passwordRecoveryPanel").classList.contains("hidden"), false);
  assert.equal(node("newPassword").focused, true);
  context.accountType = "employer";
  context.updateAccountTypeUI();
  assert.equal(node("employerAuthPanel").classList.contains("hidden"), false);
  handler("SIGNED_OUT", null);
  assert.equal(context.passwordRecoveryActive, false);
  assert.equal(node("passwordRecoveryPanel").classList.contains("hidden"), true);
});
