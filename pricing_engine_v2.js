const fs = require("fs");

function loadTariff() {
  const raw = fs.readFileSync(
    "data/rules/tariff_rules_normalized.json",
    "utf-8"
  );
  return JSON.parse(raw);
}

function calculateFirstAvailableCase(exposure) {
  const tariff = loadTariff();

  for (const section of tariff.sections) {
    for (const row of section.rows) {
      if (row.base_rate_per_mille) {
        const basePremium =
          (exposure * row.base_rate_per_mille) / 1000;

        let finalPremium = basePremium;

        if (
          row.minimum_premium &&
          finalPremium < row.minimum_premium
        ) {
          finalPremium = row.minimum_premium;
        }

        return {
          status: "ok",
          section: section.title_pl || section.title_de,
          activity: row.activity_pl || row.activity_de,
          exposure,
          base_rate_per_mille: row.base_rate_per_mille,
          basePremium,
          finalPremium,
        };
      }
    }
  }

  return {
    status: "manual",
    message: "No pricing data found",
  };
}

// TEST
const result = calculateFirstAvailableCase(1000000);

console.log(JSON.stringify(result, null, 2));