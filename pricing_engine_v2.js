const fs = require("fs");
const path = require("path");

function loadNormalizedTariff() {
  const raw = fs.readFileSync(
    path.join(__dirname, "data/rules/tariff_rules_normalized.json"),
    "utf-8"
  );

  return JSON.parse(raw);
}

function listPricableActivities() {
  const tariff = loadNormalizedTariff();
  const activities = [];

  for (const section of tariff.sections || []) {
    for (const row of section.rows || []) {
      if (typeof row.base_rate_per_mille === "number") {
        activities.push({
          sectionCode: section.code,
          section: section.title_pl || section.title_de || null,
          activity: row.activity_pl || row.activity_de || null,
          risk_class: row.risk_class || null,
          base_rate_per_mille: row.base_rate_per_mille,
          minimum_premium:
            typeof row.minimum_premium === "number"
              ? row.minimum_premium
              : null,
          source_reference: row.source_reference || null,
          notes: Array.isArray(row.notes) ? row.notes : [],
        });
      }
    }
  }

  return activities;
}

function findActivityByExactName(activityName) {
  const tariff = loadNormalizedTariff();

  for (const section of tariff.sections || []) {
    for (const row of section.rows || []) {
      if (
        row.activity_de === activityName ||
        row.activity_pl === activityName
      ) {
        return {
          sectionCode: section.code,
          section: section.title_pl || section.title_de || null,
          activity: row.activity_pl || row.activity_de || null,
          risk_class: row.risk_class || null,
          base_rate_per_mille:
            typeof row.base_rate_per_mille === "number"
              ? row.base_rate_per_mille
              : null,
          minimum_premium:
            typeof row.minimum_premium === "number"
              ? row.minimum_premium
              : null,
          source_reference: row.source_reference || null,
          notes: Array.isArray(row.notes) ? row.notes : [],
        };
      }
    }
  }

  return null;
}

function calculatePremium(input) {
  const tariff = loadNormalizedTariff();
  const sectionCode = input?.sectionCode;
  const activityName = input?.activityName;
  const exposure = input?.exposure;

  if (!sectionCode || !activityName || typeof exposure !== "number") {
    return {
      status: "error",
      section: null,
      activity: activityName || null,
      risk_class: null,
      exposure: typeof exposure === "number" ? exposure : null,
      base_rate_per_mille: null,
      basePremium: null,
      minimum_premium: null,
      finalPremium: null,
      calculationExplanation:
        "Input must include sectionCode (string), activityName (string), and exposure (number).",
      source_reference: null,
      notes: [],
    };
  }

  const section = (tariff.sections || []).find(
    (item) => item.code === sectionCode
  );

  if (!section) {
    return {
      status: "error",
      section: sectionCode,
      activity: activityName,
      risk_class: null,
      exposure,
      base_rate_per_mille: null,
      basePremium: null,
      minimum_premium: null,
      finalPremium: null,
      calculationExplanation: `Section ${sectionCode} was not found in normalized tariff rules.`,
      source_reference: null,
      notes: [],
    };
  }

  const row = (section.rows || []).find(
    (item) =>
      item.activity_de === activityName ||
      item.activity_pl === activityName
  );

  if (!row) {
    return {
      status: "error",
      section: section.title_pl || section.title_de || sectionCode,
      activity: activityName,
      risk_class: null,
      exposure,
      base_rate_per_mille: null,
      basePremium: null,
      minimum_premium: null,
      finalPremium: null,
      calculationExplanation:
        "Activity was not found in the selected section.",
      source_reference: null,
      notes: [],
    };
  }

  if (typeof row.base_rate_per_mille !== "number") {
    return {
      status: "manual",
      section: section.title_pl || section.title_de || sectionCode,
      activity: row.activity_pl || row.activity_de || activityName,
      risk_class: row.risk_class || null,
      exposure,
      base_rate_per_mille: null,
      basePremium: null,
      minimum_premium:
        typeof row.minimum_premium === "number"
          ? row.minimum_premium
          : null,
      finalPremium: null,
      calculationExplanation:
        "No base_rate_per_mille found for this activity. Manual underwriting is required.",
      source_reference: row.source_reference || null,
      notes: Array.isArray(row.notes) ? row.notes : [],
    };
  }

  const basePremium = (exposure * row.base_rate_per_mille) / 1000;
  const minimumPremium =
    typeof row.minimum_premium === "number"
      ? row.minimum_premium
      : null;

  const finalPremium =
    minimumPremium !== null && basePremium < minimumPremium
      ? minimumPremium
      : basePremium;

  return {
    status: "ok",
    section: section.title_pl || section.title_de || sectionCode,
    activity: row.activity_pl || row.activity_de || activityName,
    risk_class: row.risk_class || null,
    exposure,
    base_rate_per_mille: row.base_rate_per_mille,
    basePremium,
    minimum_premium: minimumPremium,
    finalPremium,
    calculationExplanation:
      minimumPremium !== null && basePremium < minimumPremium
        ? "Base premium is below minimum premium, so minimum premium is applied."
        : "Base premium is calculated directly from exposure and base rate.",
    source_reference: row.source_reference || null,
    notes: Array.isArray(row.notes) ? row.notes : [],
  };
}

module.exports = {
  loadNormalizedTariff,
  listPricableActivities,
  findActivityByExactName,
  calculatePremium,
};

if (require.main === module) {
  const firstPricable = listPricableActivities()[0];

  const result = firstPricable
    ? calculatePremium({
        sectionCode: firstPricable.sectionCode,
        activityName: firstPricable.activity,
        exposure: 1000000,
      })
    : {
        status: "manual",
        section: null,
        activity: null,
        risk_class: null,
        exposure: 1000000,
        base_rate_per_mille: null,
        basePremium: null,
        minimum_premium: null,
        finalPremium: null,
        calculationExplanation:
          "No pricable activity with base_rate_per_mille was found.",
        source_reference: null,
        notes: [],
      };

  console.log(JSON.stringify(result, null, 2));
}
