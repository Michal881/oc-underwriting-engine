const { quoteRisk } = require("./pricing-engine");
const { getIndustryQuestionSet } = require("./industry-question-engine");

function runApp(input = {}) {
  return {
    quote: quoteRisk(input),
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
