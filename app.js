const { quoteRisk } = require("./pricing-engine");
const { calculatePremium } = require("./pricing_engine_v2");
const { getIndustryQuestionSet } = require("./industry-question-engine");

function shouldRunExperimentalPricingV2(input = {}) {
  // Experimental pricing path (v2): opt-in only and guarded by required fields.
  return (
    input.usePricingV2 === true &&
    typeof input.sectionCode === "string" &&
    typeof input.activityName === "string" &&
    typeof input.exposure === "number"
  );
}

function runApp(input = {}) {
  const pricingV2 = shouldRunExperimentalPricingV2(input)
    ? calculatePremium({
        sectionCode: input.sectionCode,
        activityName: input.activityName,
        exposure: input.exposure,
      })
    : null;

  return {
    quote: quoteRisk(input),
    // Experimental output is returned alongside legacy pricing, never replacing it.
    pricing_v2: pricingV2,
    industry_questions: getIndustryQuestionSet(input.sectionCode),
  };
}

if (require.main === module) {
  const result = runApp({ sectionCode: "A" });
  console.log(JSON.stringify(result, null, 2));
}

module.exports = {
  runApp,
};
