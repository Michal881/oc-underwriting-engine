const assert = require("assert");
const {
  calculatePremium,
  listPricableActivities,
} = require("./pricing_engine_v2");

const firstPricableActivity = listPricableActivities()[0];

assert.ok(firstPricableActivity, "Expected at least one pricable activity.");

const result = calculatePremium({
  sectionCode: firstPricableActivity.sectionCode,
  activityName: firstPricableActivity.activity,
  exposure: 1000000,
});

assert.strictEqual(result.status, "ok", 'Expected status to be "ok".');
assert.strictEqual(
  typeof result.finalPremium,
  "number",
  "Expected finalPremium to be a number."
);
assert.ok(result.finalPremium > 0, "Expected finalPremium to be positive.");

console.log("Calculation result:");
console.log(JSON.stringify(result, null, 2));
