const { findTariffSectionByCode } = require("./tariff_engine");

function getIndustryQuestionSet(sectionCode) {
  const section = findTariffSectionByCode(sectionCode);

  if (!section) {
    return {
      status: "error",
      message: "Section not found",
      questions: [],
    };
  }

  return {
    status: "ok",
    section,
    questions: [],
  };
}

module.exports = {
  getIndustryQuestionSet,
};
