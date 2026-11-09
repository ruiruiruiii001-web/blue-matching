const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("job and people searches precede guide and pilot notices without dropping safety advice", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const position = id => {
    const result = html.indexOf(`id="${id}"`);
    assert.notEqual(result, -1, `${id} must exist`);
    return result;
  };
  for (const id of ["searchKeyword", "seekerSearchKeyword"]) {
    assert.ok(position(id) < position("onboardingGuide"));
    assert.ok(position(id) < position("pilotEmailNotice"));
  }
  assert.ok(position("jobTrustNotice") < position("jobList"));
  assert.match(html, /掲載者の本人確認は行っていません/);
  assert.match(html, /公式LINEからお問い合わせください/);
});
