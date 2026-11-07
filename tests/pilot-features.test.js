const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

function loadScript(filename, globals) {
  const context = vm.createContext(globals);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "scripts", filename), "utf8"), context);
  return context;
}

test("pilot interview view retains only the selected date and no edit controls", () => {
  const context = loadScript("interview-slots.js", {
    PILOT_MODE: true,
    escapeHtml: value => value,
    MutationObserver: class { observe() {} },
    document: { body: {} }
  });
  const box = {};
  context.renderInterviewBox(box, [
    { starts_at: "2030-01-01T10:00:00Z", is_selected: false },
    { starts_at: "2030-01-02T10:00:00Z", is_selected: true }
  ]);
  assert.match(box.innerHTML, /確定済みの作業・相談日時/);
  assert.match(box.innerHTML, /メッセージで相談/);
  assert.doesNotMatch(box.innerHTML, /button|候補日時を追加/);
  context.renderInterviewBox(box, [{ starts_at: "2030-01-01T10:00:00Z", is_selected: false }]);
  assert.equal(box.innerHTML, "");
});

test("LINE prompt appears only for confirmed unlinked users", async () => {
  const classes = new Set(["hidden"]);
  const prompt = { classList: {
    add: name => classes.add(name),
    remove: name => classes.delete(name),
    toggle: (name, state) => state ? classes.add(name) : classes.delete(name)
  } };
  const status = { textContent: "", classList: { remove() {} } };
  let response = { data: { linked: true }, error: null };
  const context = loadScript("line-notifications.js", {
    currentUser: { id: "employer" },
    accountType: "employer",
    supabaseClient: { functions: { invoke: async () => response } },
    document: { getElementById: id => id === "pilotLinePrompt" ? prompt : status },
    console: { error() {} }
  });
  await context.showPilotLinePrompt();
  assert.ok(classes.has("hidden"));
  response = { data: { linked: false }, error: null };
  await context.showPilotLinePrompt();
  assert.ok(!classes.has("hidden"));
  classes.add("hidden");
  response = { data: null, error: new Error("failed") };
  await context.showPilotLinePrompt();
  assert.ok(classes.has("hidden"));
  assert.match(status.textContent, /確認できませんでした/);
});

test("LINE status arriving after account changes does not display a prompt", async () => {
  const classes = new Set(["hidden"]);
  let resolveStatus;
  const context = loadScript("line-notifications.js", {
    currentUser: { id: "first" },
    accountType: "employer",
    supabaseClient: { functions: { invoke: () => new Promise(resolve => { resolveStatus = resolve; }) } },
    document: { getElementById: () => ({ classList: {
      add: name => classes.add(name),
      toggle: (name, state) => state ? classes.add(name) : classes.delete(name)
    } }) }
  });
  const request = context.showPilotLinePrompt();
  vm.runInContext('currentUser = { id: "second" }', context);
  resolveStatus({ data: { linked: false }, error: null });
  await request;
  assert.ok(classes.has("hidden"));
});
