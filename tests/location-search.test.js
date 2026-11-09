const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const root = path.join(__dirname, "..");
const context = vm.createContext({
  PILOT_MODE: true,
  document: { querySelectorAll: () => [] }
});

for (const filename of ["scripts/shared.js", "scripts/listings.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, filename), "utf8"), context);
}

test("local choices cover Machida and the eight selected neighboring cities", () => {
  const groups = vm.runInContext("LOCAL_LOCATION_OPTIONS", context);
  assert.deepEqual(Array.from(groups, group => group.city), [
    "町田市", "相模原市", "大和市", "座間市", "横浜市", "川崎市", "多摩市", "稲城市", "八王子市"
  ]);
  assert.ok(groups.every(group => group.areas.length > 1));
  assert.ok(groups[0].areas.includes("鶴川"));
  assert.equal(
    context.getLocationMatchScore("東京都 町田市 鶴川", "東京都 町田市 鶴川"),
    2
  );
  assert.equal(
    context.getLocationMatchScore("東京都 町田市 鶴川", "東京都 町田市"),
    2
  );
});

test("location filters match city-wide and specific areas without mixing neighboring areas", () => {
  const matches = context.jobMatchesLocationFilter;
  assert.equal(matches("東京都 町田市 鶴川", "東京都 町田市"), true);
  assert.equal(matches("東京都 町田市", "東京都 町田市 鶴川"), true);
  assert.equal(matches("町田市 鶴川", "東京都 町田市"), true);
  assert.equal(matches("東京都 町田市 鶴川", "東京都 町田市 成瀬"), false);
  assert.equal(matches("東京都 稲城市 稲城長沼", "東京都 稲城市 稲城"), false);
  assert.equal(matches("神奈川県 横浜市 緑区", "神奈川県 相模原市 緑区"), false);
  assert.equal(matches("東京都", "東京都 町田市 鶴川"), true);
  assert.equal(matches("大阪府 大阪市", "大阪府 大阪市"), true);
  assert.equal(matches("東京都 町田市 鶴川、神奈川県 大和市 中央林間", "神奈川県 大和市"), true);
});

test("editing either form preserves previously saved and unlisted locations", () => {
  for (const [name, other, containerId] of [
    ["seekerLocationPrefecture", "seekerLocation", "seekerLocationPrefectureOptions"],
    ["jobLocationPrefecture", "jobLocation", "jobLocationPrefectureOptions"]
  ]) {
    const inputs = [
      { value: "東京都 町田市 鶴川" },
      { value: "神奈川県 横浜市 緑区" }
    ];
    const field = { value: "" };
    const container = {
      querySelectorAll: selector => selector === "details" ? [] : inputs
    };
    const sandbox = vm.createContext({
      document: {
        getElementById: id => id === containerId ? container : field,
        querySelectorAll: selector => selector.includes(":checked") ? inputs.filter(input => input.checked) : []
      }
    });
    vm.runInContext(fs.readFileSync(path.join(root, "scripts", "shared.js"), "utf8"), sandbox);
    vm.runInContext("updateSelectionDetails = () => {}", sandbox);
    const saved = "東京都 町田市 鶴川、神奈川県 横浜市 緑区、大阪府 大阪市、東京都 町田市 森野";
    sandbox.setLocationPreferences(saved, name, other, containerId, name);
    assert.equal(field.value, "大阪府 大阪市、東京都 町田市 森野");
    assert.equal(sandbox.getLocationPreferencesFromForm(name, other), saved);
  }
});
