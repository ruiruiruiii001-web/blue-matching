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

test("Machida suggestions support broad and neighborhood-level preferences", () => {
  const areas = vm.runInContext("MACHIDA_AREA_OPTIONS", context);
  assert.deepEqual(Array.from(areas), [
    "町田市",
    "町田市 町田駅周辺",
    "町田市 鶴川",
    "町田市 玉川学園",
    "町田市 成瀬",
    "町田市 南町田",
    "町田市 忠生",
    "町田市 相原"
  ]);
  assert.equal(
    context.getLocationMatchScore("東京都 町田市 鶴川", "東京都 町田市 鶴川"),
    2
  );
  assert.equal(
    context.getLocationMatchScore("東京都 町田市 鶴川", "東京都 町田市"),
    2
  );
});
