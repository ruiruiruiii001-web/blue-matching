const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadAccountScript({ session, search = "?lineLink=resume", signInError = null }) {
  const script = fs.readFileSync(path.join(__dirname, "..", "scripts", "account.js"), "utf8");
  const redirects = [];
  const panelCalls = [];
  const nodes = new Map();
  function getNode(id) {
    if (!nodes.has(id)) {
      nodes.set(id, {
        value: id === "employerEmail" ? "employer@example.test" : "password",
        classList: { add() {}, remove() {}, toggle() {} },
        focus() {}
      });
    }
    return nodes.get(id);
  }
  const context = vm.createContext({
    URLSearchParams,
    document: {
      getElementById: getNode
    },
    window: { location: { search, replace: value => redirects.push(value) } },
    supabaseClient: {
      auth: {
        onAuthStateChange() {},
        async getSession() {
          return { data: { session }, error: null };
        },
        async signInWithPassword() {
          return { error: signInError };
        }
      }
    },
    turnstileToken: "captcha-token",
    turnstileWidgetId: null,
    setTurnstileStatus() {}
  });
  vm.runInContext(script, context);
  context.setAuthMessage = () => {};
  context.resetEmployerTurnstile = () => {};
  context.updateEmployerAuth = () => {};
  context.openAccountPanel = () => panelCalls.push("opened");
  return { context, redirects, panelCalls };
}

test("LINE-link login route opens sign-in when there is no session", async () => {
  const state = loadAccountScript({ session: null });
  await state.context.initializeEmployerAuth();
  assert.deepEqual(state.panelCalls, ["opened"]);
  assert.deepEqual(state.redirects, []);
});

test("LINE-link login route resumes immediately for an existing session", async () => {
  const state = loadAccountScript({ session: { user: { id: "employer" } } });
  await state.context.initializeEmployerAuth();
  assert.deepEqual(state.redirects, ["line-link.html"]);
});

test("successful sign-in returns to LINE linking", async () => {
  const state = loadAccountScript({ session: null });
  await state.context.signInEmployer();
  assert.deepEqual(state.redirects, ["line-link.html"]);
});

test("failed sign-in keeps the user on the login page", async () => {
  const state = loadAccountScript({
    session: null,
    signInError: { message: "Invalid credentials" }
  });
  await state.context.signInEmployer();
  assert.deepEqual(state.redirects, []);
});
