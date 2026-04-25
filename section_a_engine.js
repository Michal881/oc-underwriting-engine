const fs = require("fs");
const path = require("path");

const RAW_PATH = path.join(__dirname, "data", "rules", "tariff_rules_raw.json");
const NORMALIZED_PATH = path.join(
  __dirname,
  "data",
  "rules",
  "tariff_rules_normalized.json"
);

const QUESTION_GROUPS = {
  business: "Dane działalności",
  product_liability: "Produkt i odpowiedzialność za produkt",
  elevated_risk: "Ryzyka podwyższone",
  export_territory: "Eksport / terytorium",
  quality_claims: "Jakość i szkody",
  tariff_manual: "Pytania taryfowe / manual review",
};

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

function isPlasticTankActivity(activity = {}) {
  const label = `${activity.activity_pl || ""} ${activity.activity_de || ""}`.toLowerCase();
  return /(zbiornik|tank|silos|kontener|kunststoff|plast)/.test(label);
}

function extractedTariffQuestions(rawSection) {
  const baseQuestions = [
    {
      id: "q_foreign_subsidiaries",
      label_pl: "Czy przedsiębiorstwo posiada oddziały lub spółki zależne za granicą?",
      help_text_pl: "Pytanie taryfowe oznaczone w materiale źródłowym jako wymagające zapytania do underwritera.",
      input_type: "boolean",
      required: true,
      source: "extracted_tariff",
      affects: "referral",
      referral_trigger:
        "Oddziały/spółki za granicą wymagają ręcznej oceny underwritera (manual review).",
      group: QUESTION_GROUPS.export_territory,
    },
    {
      id: "q_limitation_period_extension",
      label_pl:
        "Czy wymagane jest wydłużenie okresu przedawnienia roszczeń z tytułu wad produktu powyżej 2 lat?",
      help_text_pl: "Wydłużenie ponad 2 lata jest wskazane w taryfie jako przypadek do zapytania.",
      input_type: "boolean",
      required: true,
      source: "extracted_tariff",
      affects: "referral",
      referral_trigger: "Wydłużenie okresu przedawnienia > 2 lata wymaga manual review.",
      group: QUESTION_GROUPS.tariff_manual,
    },
    {
      id: "q_environmental_thresholds",
      label_pl:
        "Czy działalność przekracza standardowe progi ryzyk środowiskowych (np. ilości magazynowanych substancji)?",
      help_text_pl:
        "Przekroczenie progów może oznaczać konieczność przeniesienia do innej taryfy (sekcja środowiskowa).",
      input_type: "boolean",
      required: true,
      source: "extracted_tariff",
      affects: "referral",
      referral_trigger: "Przekroczenie progów środowiskowych wymaga manual review.",
      group: QUESTION_GROUPS.elevated_risk,
    },
    {
      id: "q_vehicle_count",
      label_pl: "Ile pojazdów mechanicznych jest użytkowanych na terenie zakładu?",
      help_text_pl:
        "Liczba pojazdów wpływa na taryfowe dopłaty stopniowane. Podaj liczbę całkowitą.",
      input_type: "number",
      required: true,
      source: "extracted_tariff",
      affects: "information_only",
      group: QUESTION_GROUPS.business,
    },
    {
      id: "q_multiple_business_types",
      label_pl: "Czy przedsiębiorstwo prowadzi więcej niż jeden rodzaj działalności produkcyjnej?",
      help_text_pl:
        "Jeżeli tak, poszczególne rodzaje działalności powinny być oceniane oddzielnie wg odpowiednich pozycji taryfy.",
      input_type: "boolean",
      required: true,
      source: "extracted_tariff",
      affects: "referral",
      referral_trigger:
        "Wiele rodzajów działalności wymaga podziału kalkulacji i często manual review.",
      group: QUESTION_GROUPS.tariff_manual,
    },
    {
      id: "q_end_product_manufacturer",
      label_pl: "Czy firma jest wyłącznie producentem wyrobów końcowych (bez produkcji komponentów)?",
      help_text_pl:
        "W taryfie występuje możliwość redukcji stawek kalkulacyjnych dla wybranych producentów końcowych – decyzja manualna.",
      input_type: "boolean",
      required: true,
      source: "extracted_tariff",
      affects: "referral",
      referral_trigger: "Potencjalna redukcja stawek dla producenta końcowego wymaga manual review.",
      group: QUESTION_GROUPS.tariff_manual,
    },
  ];

  return baseQuestions.map((question) => {
    const rawQuestion = (rawSection.underwriting_questions || []).find((item) => item.id === question.id);
    return {
      ...question,
      source_refs: rawQuestion?.source_refs || [],
    };
  });
}

function underwritingEnrichmentQuestions(activity) {
  const enrichment = [
    {
      id: "q_product_types",
      label_pl: "Jakie grupy produktów są wytwarzane?",
      help_text_pl: "Wskaż główne grupy produktowe; można wybrać wiele odpowiedzi.",
      input_type: "multi_select",
      options: ["Zbiorniki/silosy/kontenery", "Komponenty techniczne", "Wyroby końcowe", "Inne"],
      required: true,
      source: "underwriting_enrichment",
      affects: "information_only",
      group: QUESTION_GROUPS.product_liability,
    },
    {
      id: "q_components_or_final",
      label_pl: "Czy wytwarzane produkty to głównie komponenty, wyroby końcowe, czy oba typy?",
      help_text_pl: "Ta informacja wspiera ocenę odpowiedzialności po dostawie produktu.",
      input_type: "single_select",
      options: ["Głównie komponenty", "Głównie wyroby końcowe", "Oba"],
      required: true,
      source: "underwriting_enrichment",
      affects: "information_only",
      group: QUESTION_GROUPS.product_liability,
    },
    {
      id: "q_used_in_construction",
      label_pl: "Czy produkty są stosowane w budownictwie?",
      help_text_pl: "Zastosowanie budowlane zwykle zwiększa wrażliwość na szkody seryjne i regresy.",
      input_type: "boolean",
      required: true,
      source: "underwriting_enrichment",
      affects: "referral",
      referral_trigger: "Zastosowanie produktów w budownictwie – zweryfikuj zakres odpowiedzialności produktu.",
      group: QUESTION_GROUPS.elevated_risk,
    },
    {
      id: "q_safety_critical_use",
      label_pl: "Czy produkty są używane w zastosowaniach krytycznych dla bezpieczeństwa?",
      help_text_pl:
        "Np. branża medyczna, motoryzacyjna, energetyczna, infrastruktura krytyczna.",
      input_type: "boolean",
      required: true,
      source: "underwriting_enrichment",
      affects: "referral",
      referral_trigger: "Produkty w zastosowaniach safety-critical wymagają manual review.",
      group: QUESTION_GROUPS.elevated_risk,
    },
    {
      id: "q_exports",
      label_pl: "Czy produkty są eksportowane?",
      help_text_pl: "W przypadku eksportu wskaż główne rynki sprzedaży.",
      input_type: "boolean",
      required: true,
      source: "underwriting_enrichment",
      affects: "information_only",
      group: QUESTION_GROUPS.export_territory,
    },
    {
      id: "q_export_regions",
      label_pl: "Na jakie rynki trafia eksport?",
      help_text_pl: "Możesz zaznaczyć wiele obszarów.",
      input_type: "multi_select",
      options: ["UE", "Poza UE", "USA/Kanada", "Globalnie"],
      required: false,
      source: "underwriting_enrichment",
      affects: "referral",
      referral_trigger: "Eksport poza UE/USA-Kanada może wymagać rozszerzonej oceny jurysdykcji.",
      group: QUESTION_GROUPS.export_territory,
    },
    {
      id: "q_custom_or_serial",
      label_pl: "Czy produkcja jest głównie jednostkowa (custom-made) czy seryjna?",
      help_text_pl: "Produkcja seryjna może zwiększać ryzyko szkód masowych/seryjnych.",
      input_type: "single_select",
      options: ["Głównie jednostkowa", "Głównie seryjna", "Mieszana"],
      required: true,
      source: "underwriting_enrichment",
      affects: "information_only",
      group: QUESTION_GROUPS.product_liability,
    },
    {
      id: "q_bodily_property_damage_after_delivery",
      label_pl:
        "Czy wada produktu po dostawie może spowodować szkodę osobową lub rzeczową u odbiorcy końcowego?",
      help_text_pl: "Kluczowe pytanie underwritingowe dla odpowiedzialności za produkt.",
      input_type: "boolean",
      required: true,
      source: "underwriting_enrichment",
      affects: "referral",
      referral_trigger:
        "Deklarowane istotne szkody osobowe/rzeczowe po dostawie wymagają manual review.",
      group: QUESTION_GROUPS.product_liability,
    },
    {
      id: "q_quality_control_process",
      label_pl: "Jak opiszesz proces kontroli jakości i testów?",
      help_text_pl: "Podaj normy, częstotliwość testów i etap kontroli (wejściowa/międzyoperacyjna/końcowa).",
      input_type: "text",
      required: true,
      source: "underwriting_enrichment",
      affects: "information_only",
      group: QUESTION_GROUPS.quality_claims,
    },
    {
      id: "q_product_recall_exposure",
      label_pl: "Czy istnieje podwyższone narażenie na koszty wycofania produktu (recall)?",
      help_text_pl: "Ocena potrzebna do decyzji o ewentualnych osobnych klauzulach/polisach recall.",
      input_type: "boolean",
      required: true,
      source: "underwriting_enrichment",
      affects: "referral",
      referral_trigger: "Podwyższone ryzyko recall – przekaż do manual review.",
      group: QUESTION_GROUPS.quality_claims,
    },
    {
      id: "q_turnover_split",
      label_pl: "Podaj podział obrotu rocznego wg głównych grup produktów (opcjonalnie).",
      help_text_pl: "Np. 'zbiorniki 60%, komponenty 40%'.",
      input_type: "text",
      required: false,
      source: "underwriting_enrichment",
      affects: "information_only",
      group: QUESTION_GROUPS.quality_claims,
    },
  ];

  if (isPlasticTankActivity(activity)) {
    enrichment.push(
      {
        id: "q_tank_substances",
        label_pl: "Jakie substancje są przechowywane w zbiornikach/silosach/kontenerach?",
        help_text_pl: "Wskaż media (np. woda, chemikalia, paliwa, substancje spożywcze).",
        input_type: "text",
        required: true,
        source: "underwriting_enrichment",
        affects: "information_only",
        group: QUESTION_GROUPS.product_liability,
      },
      {
        id: "q_tank_capacity_range",
        label_pl: "Jaki jest typowy zakres pojemności/objętości produktów?",
        help_text_pl: "Wybierz najwyższy typowy przedział.",
        input_type: "single_select",
        options: ["do 1 m³", "1–10 m³", "10–50 m³", "powyżej 50 m³"],
        required: true,
        source: "underwriting_enrichment",
        affects: "information_only",
        group: QUESTION_GROUPS.product_liability,
      },
      {
        id: "q_tank_hazardous_substances",
        label_pl: "Czy produkty służą do magazynowania substancji niebezpiecznych?",
        help_text_pl: "Dotyczy substancji stwarzających ryzyko pożaru, wybuchu, skażenia lub toksyczności.",
        input_type: "boolean",
        required: true,
        source: "underwriting_enrichment",
        affects: "referral",
        referral_trigger: "Magazynowanie substancji niebezpiecznych – manual review.",
        group: QUESTION_GROUPS.elevated_risk,
      },
      {
        id: "q_tank_underground_aboveground",
        label_pl: "Czy produkty są instalowane podziemnie, naziemnie czy w obu wariantach?",
        help_text_pl: "Warunki montażu wpływają na charakter szkód i regresów.",
        input_type: "single_select",
        options: ["Wyłącznie naziemnie", "Wyłącznie podziemnie", "Oba warianty"],
        required: true,
        source: "underwriting_enrichment",
        affects: "information_only",
        group: QUESTION_GROUPS.elevated_risk,
      },
      {
        id: "q_tank_installation_by_insured",
        label_pl: "Czy montaż/instalacja produktów jest wykonywana przez ubezpieczonego?",
        help_text_pl: "Własny montaż zwykle rozszerza odpowiedzialność i zwiększa potrzebę analizy zakresu.",
        input_type: "boolean",
        required: true,
        source: "underwriting_enrichment",
        affects: "referral",
        referral_trigger: "Montaż realizowany przez ubezpieczonego – manual review.",
        group: QUESTION_GROUPS.elevated_risk,
      },
      {
        id: "q_tank_leakage_environment",
        label_pl: "Czy w razie awarii możliwy jest wyciek i szkoda środowiskowa?",
        help_text_pl: "Dotyczy szkód w gruncie, wodzie, instalacjach i mieniu osób trzecich.",
        input_type: "boolean",
        required: true,
        source: "underwriting_enrichment",
        affects: "referral",
        referral_trigger: "Potencjał szkody środowiskowej wskazuje na konieczność manual review.",
        group: QUESTION_GROUPS.elevated_risk,
      },
      {
        id: "q_tank_pressure_or_certification",
        label_pl: "Czy produkty są zbiornikami ciśnieniowymi lub podlegają obowiązkowej certyfikacji?",
        help_text_pl: "Np. wymagania UDT, PED, normy branżowe i atesty.",
        input_type: "boolean",
        required: true,
        source: "underwriting_enrichment",
        affects: "referral",
        referral_trigger: "Zbiorniki ciśnieniowe/certyfikowane wymagają manual review.",
        group: QUESTION_GROUPS.elevated_risk,
      }
    );
  }

  return enrichment;
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
    referral_rules: rawSection.referral_decline_manual_review_rules || [],
    limits: rawSection.limits || {},
    raw_section: rawSection,
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

function buildQuestionSections(questions) {
  const order = Object.values(QUESTION_GROUPS);
  return order
    .map((groupName) => ({
      name: groupName,
      questions: questions.filter((question) => question.group === groupName),
    }))
    .filter((section) => section.questions.length > 0);
}

function getSectionAQuestions(activityId) {
  const section = loadSectionAData();

  if (!section) {
    return {
      sections: [],
      questionnaire_schema: [],
      referral_triggers: [],
    };
  }

  const activity = section.rows.find((row) => row.id === String(activityId || "").trim().toLowerCase()) || {};
  const questionnaireSchema = [
    ...extractedTariffQuestions(section.raw_section),
    ...underwritingEnrichmentQuestions(activity),
  ];

  return {
    sections: buildQuestionSections(questionnaireSchema),
    questionnaire_schema: questionnaireSchema,
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

function evaluateManualReviewTriggers(answers, optionsManualReasons, activity) {
  const reasons = [...optionsManualReasons];
  const questionnaire = getSectionAQuestions(activity?.id).questionnaire_schema;

  questionnaire.forEach((question) => {
    if (!question.referral_trigger || question.affects !== "referral") {
      return;
    }

    const answer = answers[question.id];

    if (answer === "yes") {
      reasons.push(question.referral_trigger);
    }

    if (
      question.id === "q_export_regions" &&
      (answer || []).some &&
      Array.isArray(answer) &&
      answer.some((region) => ["Poza UE", "USA/Kanada", "Globalnie"].includes(region))
    ) {
      reasons.push(question.referral_trigger);
    }
  });

  return Array.from(new Set(reasons));
}

function splitAnswersByImpact(answers, activity) {
  const schema = getSectionAQuestions(activity?.id).questionnaire_schema;
  const premiumAffectingTariffRules = [];
  const manualReviewTriggers = [];
  const informationOnlyAnswers = [];

  schema.forEach((question) => {
    const answer = answers[question.id];
    if (typeof answer === "undefined" || answer === "") {
      return;
    }

    const dto = {
      id: question.id,
      label_pl: question.label_pl,
      answer,
      source: question.source,
    };

    if (question.source === "extracted_tariff" && question.id === "q_vehicle_count") {
      premiumAffectingTariffRules.push({
        ...dto,
        note: "W taryfie wskazano dopłaty zależne od liczby pojazdów; szczegółowa formuła poza MVP.",
      });
      return;
    }

    if (question.affects === "referral") {
      manualReviewTriggers.push(dto);
      return;
    }

    informationOnlyAnswers.push(dto);
  });

  return {
    premium_affecting_tariff_rules: premiumAffectingTariffRules,
    manual_review_underwriting_answers: manualReviewTriggers,
    information_only_underwriting_answers: informationOnlyAnswers,
  };
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
    surchargeResult.manual_review_reasons,
    activity
  );

  const decisionStatus = manualReviewReasons.length ? "manual_review" : "accept";
  const answerBreakdown = splitAnswersByImpact(normalizedAnswers, activity);

  auditTrace.push({
    step: "decision",
    detail: {
      decision_status: decisionStatus,
      manual_review_reasons: manualReviewReasons,
      answer_breakdown: answerBreakdown,
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
      underwriting_output: answerBreakdown,
    },
    audit_trace: auditTrace,
  };
}

module.exports = {
  getSectionAActivities,
  getSectionAQuestions,
  calculateSectionAQuote,
};
