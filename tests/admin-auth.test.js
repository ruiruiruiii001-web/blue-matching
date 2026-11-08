const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function setup(outcome = {}) {
  const nodes = {
    adminEmail: { value: " admin@example.test " },
    adminPassword: { value: "password" },
    adminLoginSubmit: { disabled: false },
    adminTurnstileStatus: { textContent: "", classList: { toggle() {} } }
  };
  const calls = [];
  const messages = [];
  let widget;
  let resetCount = 0;
  let initialized = 0;
  const window = {
    turnstile: {
      render(selector, options) { widget = options; return "widget"; },
      reset(id) { assert.equal(id, "widget"); resetCount++; }
    }
  };
  const context = vm.createContext({
    window,
    document: {
      getElementById: id => nodes[id],
      querySelector: () => ({ content: "site-key" }),
      createElement: () => ({}),
      head: { appendChild() {} }
    },
    supabaseClient: {
      auth: {
        async signInWithPassword(input) {
          calls.push(input);
          if (outcome.throwError) throw new Error("offline");
          return outcome;
        }
      }
    },
    setAdminStatus: (message, isError) => messages.push({ message, isError }),
    initializeAdmin: async () => { initialized++; },
    console: { error() {} }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "scripts", "admin-auth.js"), "utf8"), context);
  context.initializeAdminTurnstile();
  window.onAdminTurnstileLoaded();
  return { context, nodes, calls, messages, widget, resetCount: () => resetCount, initialized: () => initialized };
}

async function submit(state) {
  await state.context.submitAdminLogin({ preventDefault() {} });
}

test("admin login requires CAPTCHA and forwards a verified token", async () => {
  const state = setup();
  await submit(state);
  assert.equal(state.calls.length, 0);
  assert.match(state.messages.at(-1).message, /CAPTCHA/);
  state.widget.callback("test-token");
  await submit(state);
  assert.equal(state.calls[0].email, "admin@example.test");
  assert.equal(state.calls[0].options.captchaToken, "test-token");
  assert.equal(state.nodes.adminPassword.value, "");
  assert.equal(state.resetCount(), 1);
  assert.equal(state.initialized(), 1);
  assert.equal(state.nodes.adminLoginSubmit.disabled, false);
  await submit(state);
  assert.equal(state.calls.length, 1);
});

test("expired and failed CAPTCHA cannot be submitted", async () => {
  for (const callback of ["expired-callback", "error-callback"]) {
    const state = setup();
    state.widget.callback("test-token");
    state.widget[callback]("test-error");
    await submit(state);
    assert.equal(state.calls.length, 0);
    assert.match(state.nodes.adminTurnstileStatus.textContent, /期限|失敗/);
  }
});

test("login failures show appropriate errors and reset CAPTCHA for retry", async () => {
  for (const [outcome, expected] of [
    [{ error: { code: "invalid_credentials", message: "Invalid login credentials" } }, /パスワード/],
    [{ error: { code: "captcha_failed", message: "captcha" } }, /CAPTCHA/],
    [{ error: { message: "other failure" } }, /時間をおいて/],
    [{ throwError: true }, /通信状態/]
  ]) {
    const state = setup(outcome);
    state.widget.callback("test-token");
    await submit(state);
    assert.match(state.messages.at(-1).message, expected);
    assert.equal(state.resetCount(), 1);
    assert.equal(state.initialized(), 0);
    assert.equal(state.nodes.adminLoginSubmit.disabled, false);
    await submit(state);
    assert.equal(state.calls.length, 1);
  }
});
