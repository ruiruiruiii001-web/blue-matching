const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createGuide(accountType, pilot = true) {
  const storage = new Map();
  const body = {};
  function element() {
    const classes = new Set(["hidden"]);
    return {
      classList: {
        add: name => classes.add(name),
        remove: name => classes.delete(name),
        toggle: (name, state) => state ? classes.add(name) : classes.delete(name),
        contains: name => classes.has(name)
      }
    };
  }
  const host = { ...element(), querySelector: () => body };
  const button = element();
  const context = vm.createContext({
    accountType, PILOT_MODE: pilot, console,
    document: { getElementById: id => id === "onboardingGuide" ? host : button },
    localStorage: {
      getItem: key => storage.get(key),
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key)
    },
    updateAccountSearchSurface() {}
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "scripts", "onboarding-guide.js"), "utf8"), context);
  return { context, host, button, body };
}

test("guide shows each role's actual registration and job workflow", () => {
  const guest = createGuide(null);
  assert.match(guest.body.innerHTML, /お仕事を探す方へ：仕事確定までの流れ/);
  assert.match(guest.body.innerHTML, /確認メール/);
  assert.match(guest.body.innerHTML, /確定するまで作業を始めない/);
  assert.match(guest.body.innerHTML, /運営の審査後に公開/);
  assert.match(guest.body.innerHTML, /募集の管理/);
  assert.doesNotMatch(guest.body.innerHTML, /今日働ける方で絞り込む/);
  const seeker = createGuide("seeker");
  assert.doesNotMatch(seeker.body.innerHTML, /お仕事をお願いする方へ/);
  const employer = createGuide("employer", false);
  assert.doesNotMatch(employer.body.innerHTML, /お仕事を探す方へ/);
  assert.match(employer.body.innerHTML, /今日働ける方で絞り込む/);
});

test("dismissed guide can be reopened and remains available across updates", () => {
  const guide = createGuide("seeker");
  guide.context.dismissOnboardingGuide();
  assert.equal(guide.host.classList.contains("hidden"), true);
  assert.equal(guide.button.classList.contains("hidden"), false);
  guide.context.updateOnboardingGuide();
  assert.equal(guide.host.classList.contains("hidden"), true);
  guide.context.showOnboardingGuide();
  assert.equal(guide.host.classList.contains("hidden"), false);
  assert.equal(guide.button.classList.contains("hidden"), true);
  guide.context.updateOnboardingGuide();
  assert.equal(guide.host.classList.contains("hidden"), false);
});
