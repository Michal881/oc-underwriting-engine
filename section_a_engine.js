const fs = require("fs");
const path = require("path");

const RAW_PATH = path.join(__dirname, "data", "rules", "tariff_rules_raw.json");
const NORMALIZED_PATH = path.join(
  __dirname,
  "data",
  "rules",
  "tariff_rules_normalized.json"
);

let cache = null;

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sectionNotAvailable(message) {
  return {
    decision_status: "unavailable",
    message,
    quote_result: null,
    audit_trace: [
      {
        step: "availability_check",
        detail: message,
      },
    ],
  };
}

function loadSectionAData() {
  if (cache) {
    return cache;
  }

  const raw = loadJson(RAW_PATH);
  const normalized = loadJson(NORMALIZED_PATH);

  const rawSection = (raw.tariff_sections || []).find((section) => section.section_id === "A");
  const normalizedSection = (normalized.sections || []).find((section) => section.code === "A");

  if (!rawSection || !normalizedSection) {
    cache = null;
    return null;
  }

  const rawActivities = (rawSection.industries_activities_risk_classes || []).filter(
    (row) => row.activity_de
  );

  const rows = rawActivities
    .map((rawRow) => {
      const normalizedRow = (normalizedSection.rows || []).find(
        (item) => item.activity_de === rawRow.activity_de
      );

      return {
        id: String(rawRow.risiko_nr || rawRow.wagnis_nr || rawRow.wz_code || rawRow.activity_de)
          .trim()
          .toLowerCase(),
        activity_de: rawRow.activity_de,
        activity_pl: rawRow.activity_pl || null,
        risk_class_erw_prodh: rawRow.risk_class_erw_prodh || null,
        risk_class_rueckruf: rawRow.risk_class_rueckruf || null,
        source_refs: Array.isArray(rawRow.source_refs) ? rawRow.source_refs : [],
        base_rate_per_mille:
          typeof normalizedRow?.base_rate_per_mille === "number"
            ? normalizedRow.base_rate_per_mille
            : null,
        minimum_premium:
          typeof normalizedRow?.minimum_premium === "number" ? normalizedRow.minimum_premium : null,
      };
    })
    .sort((a, b) => a.activity_de.localeCompare(b.activity_de, "de"));

  cache = {
    section_code: "A",
    category: "Produkcja",
    title_de: rawSection.title_de,
    title_pl: rawSection.title_pl,
    rating_basis:
      rawSection.base_rates?.premium_rating_basis_pl ||
      rawSection.base_rates?.premium_rating_basis_de ||
      "not available in extracted data",
    degression_discounts_by_turnover:
      rawSection.base_rates?.degression_discounts_by_turnover || [],
    underwriting_questions: rawSection.underwriting_questions || [],
    conditional_questions: rawSection.conditional_questions || [],
    referral_rules: rawSection.referral_decline_manual_review_rules || [],
    limits: rawSection.limits || {},
    rows,
  };

  return cache;
}

function getSectionAActivities() {
  const section = loadSectionAData();

  if (!section) {
    return [];
  }

  return section.rows.map((row) => ({
    id: row.id,
    category: section.category,
    section_code: section.section_code,
    label: row.activity_pl || row.activity_de,
    activity_de: row.activity_de,
    activity_pl: row.activity_pl,
    risk_class_erw_prodh: row.risk_class_erw_prodh,
    risk_class_rueckruf: row.risk_class_rueckruf,
    base_rate_per_mille: row.base_rate_per_mille,
    minimum_premium: row.minimum_premium,
    source_refs: row.source_refs,
  }));
}

function getSectionAQuestions() {
  const section = loadSectionAData();

  if (!section) {
    return {
      underwriting_questions: [],
      conditional_questions: [],
      referral_triggers: [],
    };
  }

  return {
    underwriting_questions: section.underwriting_questions,
    conditional_questions: section.conditional_questions,
    referral_triggers: section.referral_rules,
  };
}

function listAvailableOptions(section) {
  const limits = section?.limits || {};

  return {
    optional_main_limit_increase: Array.isArray(limits.optional_limit_increase)
      ? limits.optional_limit_increase
      : "not available in extracted data",
    optional_mietsachschaeden_limits: Array.isArray(limits.mietsachschaeden_optional_limits)
      ? limits.mietsachschaeden_optional_limits
      : "not available in extracted data",
    optional_taetigkeitsschaeden_limits: Array.isArray(limits.taetigkeitsschaeden_optional_limits)
      ? limits.taetigkeitsschaeden_optional_limits
      : "not available in extracted data",
  };
}

function normalizeAnswers(answers) {
  if (!answers || typeof answers !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(answers).map(([key, value]) => {
      if (typeof value === "string") {
        return [key, value.trim().toLowerCase()];
      }

      return [key, value];
    })
  );
}

function calculateDegressionDiscount(turnover, discounts = []) {
  const applicable = discounts
    .filter(
      (item) => typeof item.from_turnover_eur === "number" && typeof item.discount_percent === "number"
    )
    .sort((a, b) => a.from_turnover_eur - b.from_turnover_eur);

  let applied = null;
  for (const discount of applicable) {
    if (turnover >= discount.from_turnover_eur) {
      applied = discount;
    }
  }

  if (!applied) {
    return {
      percent: 0,
      amount: 0,
      rule: null,
    };
  }

  return {
    percent: applied.discount_percent,
    amount: 0,
    rule: applied,
  };
}

function calculateOptionSurcharges(inputOptions, section, baseForSurcharge) {
  const options = inputOptions || {};
  const limits = section.limits || {};

  const applied = [];
  let total = 0;
  const manualReviewReasons = [];

  if (options.main_limit_eur) {
    const available = (limits.optional_limit_increase || []).find(
      (item) => item.to_limit_eur === Number(options.main_limit_eur)
    );

    if (!available) {
      manualReviewReasons.push(
        `Requested main limit ${options.main_limit_eur} EUR is not available in extracted data.`
      );
    } else {
      const surcharge = (baseForSurcharge * available.surcharge_percent) / 100;
      total += surcharge;
      applied.push({
        type: "main_limit_increase",
        selected_to_limit_eur: available.to_limit_eur,
        surcharge_percent: available.surcharge_percent,
        surcharge_amount_eur: surcharge,
      });
    }
  }

  if (options.mietsachschaeden_limit_eur) {
    const available = (limits.mietsachschaeden_optional_limits || []).find(
      (item) => item.to_limit_eur === Number(options.mietsachschaeden_limit_eur)
    );

    if (!available) {
      manualReviewReasons.push(
        `Requested mietsachschäden limit ${options.mietsachschaeden_limit_eur} EUR is not available in extracted data.`
      );
    } else {
      total += available.surcharge_eur;
      applied.push({
        type: "mietsachschaeden_limit",
        selected_to_limit_eur: available.to_limit_eur,
        surcharge_amount_eur: available.surcharge_eur,
      });
    }
  }

  if (options.taetigkeitsschaeden_limit_eur) {
    const available = (limits.taetigkeitsschaeden_optional_limits || []).find(
      (item) => item.to_limit_eur === Number(options.taetigkeitsschaeden_limit_eur)
    );

    if (!available) {
      manualReviewReasons.push(
        `Requested tätigkeitsschäden limit ${options.taetigkeitsschaeden_limit_eur} EUR is not available in extracted data.`
      );
    } else {
      manualReviewReasons.push(
        `Tätigkeitsschäden surcharge formula is not fully numeric in extracted data (${available.surcharge}).`
      );
      applied.push({
        type: "taetigkeitsschaeden_limit",
        selected_to_limit_eur: available.to_limit_eur,
        surcharge_amount_eur: "not available in extracted data",
      });
    }
  }

  return {
    total_surcharge_amount_eur: total,
    applied_surcharges: applied,
    manual_review_reasons: manualReviewReasons,
  };
}

function evaluateManualReviewTriggers(answers, optionsManualReasons) {
  const reasons = [...optionsManualReasons];

  if (answers.q_foreign_subsidiaries === "yes") {
    reasons.push("Niederlassungen/Unternehmen im Ausland requires referral (manual review).");
  }

  if (answers.q_limitation_period_extension === "yes") {
    reasons.push(
      "Verlängerung der Verjährungsfrist bei Nacherfüllungsansprüchen über 2 Jahre requires referral."
    );
  }

  if (answers.q_environmental_thresholds === "yes") {
    reasons.push("Environmental threshold exceedance indicates transition to tariff G (manual review).");
  }

  return reasons;
}

function calculateSectionAQuote(input = {}) {
  const section = loadSectionAData();
  if (!section) {
    return sectionNotAvailable("Section A extracted data is not available.");
  }

  const selectedActivityId = String(input.activity_id || "").trim().toLowerCase();
  const turnover = Number(input.turnover_eur);

  const auditTrace = [
    {
      step: "input_received",
      detail: {
        activity_id: selectedActivityId || null,
        turnover_eur: Number.isFinite(turnover) ? turnover : null,
        answers: input.answers || {},
        options: input.selected_options || {},
      },
    },
  ];

  const activity = section.rows.find((row) => row.id === selectedActivityId);
  if (!activity) {
    return {
      decision_status: "unavailable",
      message: "Selected activity is not available in extracted data for Section A.",
      quote_result: null,
      audit_trace: [
        ...auditTrace,
        {
          step: "activity_lookup",
          detail: "No matching activity in Section A extracted rows.",
        },
      ],
    };
  }

  if (!Number.isFinite(turnover) || turnover <= 0) {
    return {
      decision_status: "unavailable",
      message: "Turnover must be a positive number.",
      quote_result: null,
      audit_trace: [
        ...auditTrace,
        {
          step: "input_validation",
          detail: "Turnover is missing or invalid.",
        },
      ],
    };
  }

  if (typeof activity.base_rate_per_mille !== "number") {
    return {
      decision_status: "unavailable",
      message: "Base rate is not available in extracted data for selected activity.",
      quote_result: null,
      audit_trace: [
        ...auditTrace,
        {
          step: "base_rate",
          detail: "base_rate_per_mille is not available in extracted data.",
        },
      ],
    };
  }

  const roundedTurnover = Math.ceil(turnover / 1000) * 1000;
  const basePremium = (roundedTurnover * activity.base_rate_per_mille) / 1000;
  const minimumPremium =
    typeof activity.minimum_premium === "number"
      ? activity.minimum_premium
      : "not available in extracted data";

  auditTrace.push(
    {
      step: "selected_activity",
      detail: {
        id: activity.id,
        activity_de: activity.activity_de,
        activity_pl: activity.activity_pl,
        risk_class_erw_prodh: activity.risk_class_erw_prodh,
      },
    },
    {
      step: "turnover_exposure",
      detail: {
        input_turnover_eur: turnover,
        rounded_turnover_eur: roundedTurnover,
        rule: "Turnover rounded up to full 1,000 EUR from extracted data.",
      },
    },
    {
      step: "base_rate",
      detail: {
        base_rate_per_mille: activity.base_rate_per_mille,
      },
    },
    {
      step: "base_premium",
      detail: {
        formula: "rounded_turnover_eur * base_rate_per_mille / 1000",
        amount_eur: basePremium,
      },
    }
  );

  let premiumAfterMinimum = basePremium;
  if (typeof minimumPremium === "number" && basePremium < minimumPremium) {
    premiumAfterMinimum = minimumPremium;
  }

  auditTrace.push({
    step: "minimum_premium",
    detail: {
      minimum_premium_eur: minimumPremium,
      applied: typeof minimumPremium === "number",
      premium_after_minimum_eur: premiumAfterMinimum,
    },
  });

  const discount = calculateDegressionDiscount(
    roundedTurnover,
    section.degression_discounts_by_turnover
  );
  const discountAmount = (premiumAfterMinimum * discount.percent) / 100;
  const premiumAfterDiscount = premiumAfterMinimum - discountAmount;

  auditTrace.push({
    step: "degression_discount",
    detail: {
      available_discounts: section.degression_discounts_by_turnover,
      applied_discount_percent: discount.percent,
      discount_amount_eur: discountAmount,
      premium_after_discount_eur: premiumAfterDiscount,
      applied_rule: discount.rule,
    },
  });

  const surchargeResult = calculateOptionSurcharges(
    input.selected_options,
    section,
    premiumAfterDiscount
  );

  const premiumAfterSurcharge = premiumAfterDiscount + surchargeResult.total_surcharge_amount_eur;

  auditTrace.push({
    step: "surcharges_options",
    detail: {
      available_options: listAvailableOptions(section),
      selected_options: input.selected_options || {},
      applied_surcharges: surchargeResult.applied_surcharges,
      total_surcharge_amount_eur: surchargeResult.total_surcharge_amount_eur,
      premium_after_surcharge_eur: premiumAfterSurcharge,
    },
  });

  const normalizedAnswers = normalizeAnswers(input.answers);
  const manualReviewReasons = evaluateManualReviewTriggers(
    normalizedAnswers,
    surchargeResult.manual_review_reasons
  );

  const decisionStatus = manualReviewReasons.length ? "manual_review" : "accept";

  auditTrace.push({
    step: "decision",
    detail: {
      decision_status: decisionStatus,
      manual_review_reasons: manualReviewReasons,
    },
  });

  return {
    decision_status: decisionStatus,
    manual_review_reasons: manualReviewReasons,
    quote_result: {
      section_code: section.section_code,
      category: section.category,
      selected_activity: {
        id: activity.id,
        activity_de: activity.activity_de,
        activity_pl: activity.activity_pl,
      },
      turnover_exposure_eur: {
        input: turnover,
        rounded_for_rating: roundedTurnover,
      },
      base_rate_per_mille: activity.base_rate_per_mille,
      base_premium_eur: basePremium,
      minimum_premium_eur: minimumPremium,
      degression_discounts_available: section.degression_discounts_by_turnover,
      degression_discount_applied_percent: discount.percent,
      degression_discount_amount_eur: discountAmount,
      surcharges_options_available: listAvailableOptions(section),
      surcharges_applied: surchargeResult.applied_surcharges,
      total_surcharges_eur: surchargeResult.total_surcharge_amount_eur,
      final_premium_eur: premiumAfterSurcharge,
      rating_basis: section.rating_basis,
    },
    audit_trace: auditTrace,
  };
}

module.exports = {
  getSectionAActivities,
  getSectionAQuestions,
  calculateSectionAQuote,
};
