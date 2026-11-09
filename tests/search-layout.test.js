const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("guide and pilot notices stay accessible before search results without dropping safety advice", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const position = id => {
    const result = html.indexOf(`id="${id}"`);
    assert.notEqual(result, -1, `${id} must exist`);
    return result;
  };
  assert.ok(position("onboardingGuide") < position("jobSearchPanel"));
  assert.ok(position("pilotEmailNotice") < position("employerSeekerSearchResults"));
  assert.match(html, /<summary[^>]*>使い方・お知らせ<\/summary>/);
  assert.ok(position("jobTrustNotice") < position("jobList"));
  assert.match(html, /掲載者の本人確認は行っていません/);
  assert.match(html, /公式LINEからお問い合わせください/);
});
