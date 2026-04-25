const fs = require("fs");
const path = require("path");

const TARIFF_FILE_PATH = path.join(__dirname, "data", "rules", "tariff_rules_raw.json");

let cachedTariff = null;

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  for (const key of Object.keys(value)) {
    deepFreeze(value[key]);
  }

  return value;
}

function loadTariff() {
  if (cachedTariff) {
    return cachedTariff;
  }

  const raw = fs.readFileSync(TARIFF_FILE_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  cachedTariff = deepFreeze(parsed);

  return cachedTariff;
}

function listTariffSections() {
  const tariff = loadTariff();
  const sectionsByCode = new Map();

  for (const section of tariff.tariff_sections) {
    const subsections = Array.isArray(section.subsections) ? section.subsections : [];

    if (subsections.length === 0) {
      sectionsByCode.set(String(section.section_id), {
        code: section.section_id,
        title_de: section.title_de || null,
        title_pl: section.title_pl || null,
        parent_section_id: section.section_id,
      });
      continue;
    }

    for (const subsection of subsections) {
      sectionsByCode.set(String(subsection.code), {
        code: subsection.code,
        title_de: subsection.title_de || null,
        title_pl: subsection.title_pl || null,
        page: subsection.page || null,
        parent_section_id: section.section_id,
      });
    }
  }

  return Array.from(sectionsByCode.values());
}

function findTariffSectionByCode(code) {
  if (!code && code !== 0) {
    return null;
  }

  const target = String(code).trim().toLowerCase();

  for (const section of listTariffSections()) {
    if (String(section.code).trim().toLowerCase() === target) {
      return section;
    }
  }

  return null;
}

function getTariffMetadata() {
  const tariff = loadTariff();

  return {
    source: tariff.source,
    language: tariff.language,
    extraction_status: tariff.extraction_status,
    notes: tariff.notes,
  };
}

function findIndustrySection(tariff, sectionCode) {
  if (!tariff || !Array.isArray(tariff.tariff_sections)) {
    return null;
  }

  for (const section of tariff.tariff_sections) {
    if (!section.subsections) {
      continue;
    }

    for (const sub of section.subsections) {
      if (sub.code === sectionCode) {
        return sub;
      }
    }
  }

  return null;
}

function evaluateCase(input) {
  const tariff = loadTariff();
  const requestedCode = input && input.sectionCode;

  const section = findIndustrySection(tariff, requestedCode);

  if (!section) {
    return {
      status: "error",
      message: "Section not found",
    };
  }

  return {
    status: "ok",
    section: section.title_pl || section.title_de,
    notes: tariff.notes,
  };
}

function printTariffSections() {
  const sections = listTariffSections();

  console.log("Available tariff sections:");
  for (const section of sections) {
    const title = section.title_pl || section.title_de || "(no title)";
    console.log(`- ${section.code}: ${title}`);
  }
}

if (require.main === module) {
  printTariffSections();
}

module.exports = {
  loadTariff,
  listTariffSections,
  findTariffSectionByCode,
  getTariffMetadata,
  // Backward-compatible exports.
  findIndustrySection,
  evaluateCase,
};
