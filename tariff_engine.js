const fs = require("fs");

function loadTariff() {
  const raw = fs.readFileSync("data/rules/tariff_rules_raw.json", "utf-8");
  return JSON.parse(raw);
}

function findIndustrySection(tariff, sectionCode) {
  for (const section of tariff.tariff_sections) {
    if (!section.subsections) continue;

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

  const section = findIndustrySection(tariff, input.sectionCode);

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

// TEST
const result = evaluateCase({
  sectionCode: "A",
});

console.log(result);