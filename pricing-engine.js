const { getTariffMetadata } = require("./tariff_engine");

function quoteRisk(input = {}) {
  return {
    status: "ok",
    engine: "legacy",
    // Read-only tariff metadata is available for diagnostics/auditing.
    tariff_metadata: getTariffMetadata(),
    request: input,
  };
}

module.exports = {
  quoteRisk,
};
