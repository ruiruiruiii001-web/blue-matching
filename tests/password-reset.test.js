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
