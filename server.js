const express = require("express");
const path = require("path");
const { loadTariff } = require("./tariff_engine");

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, "public")));

// Temporary Polish activity catalog fallback.
// Keep this dictionary separate so it can be replaced with extracted tariff data later.
const FALLBACK_ACTIVITY_CATALOG = {
  Produkcja: [
    { code: "prod_spozywcza", label_pl: "Produkcja artykułów spożywczych" },
    { code: "prod_metal", label_pl: "Produkcja wyrobów metalowych" },
    { code: "prod_meble", label_pl: "Produkcja mebli" },
  ],
  Poligrafia: [
    { code: "pol_offset", label_pl: "Druk offsetowy" },
    { code: "pol_cyfrowy", label_pl: "Druk cyfrowy" },
    { code: "pol_introligatornia", label_pl: "Usługi introligatorskie" },
  ],
  "IT / software / hardware": [
    { code: "it_software_house", label_pl: "Tworzenie oprogramowania" },
    { code: "it_serwis", label_pl: "Serwis sprzętu komputerowego" },
    { code: "it_integracje", label_pl: "Integracja systemów IT" },
  ],
  "Handel i usługi": [
    { code: "hu_hurt", label_pl: "Hurtownia towarów" },
    { code: "hu_detal", label_pl: "Sprzedaż detaliczna" },
    { code: "hu_serwis", label_pl: "Usługi serwisowe" },
  ],
  Budownictwo: [
    { code: "bud_ogolnobud", label_pl: "Roboty ogólnobudowlane" },
    { code: "bud_instalacje", label_pl: "Instalacje elektryczne i sanitarne" },
    { code: "bud_wykonczenie", label_pl: "Prace wykończeniowe" },
  ],
  "Hotelarstwo / gastronomia": [
    { code: "hg_hotel", label_pl: "Prowadzenie hotelu lub pensjonatu" },
    { code: "hg_restauracja", label_pl: "Prowadzenie restauracji" },
    { code: "hg_catering", label_pl: "Usługi cateringowe" },
  ],
  "Transport / motoryzacja": [
    { code: "tm_transport", label_pl: "Transport drogowy towarów" },
    { code: "tm_spedycja", label_pl: "Spedycja i logistyka" },
    { code: "tm_warsztat", label_pl: "Warsztat samochodowy" },
  ],
  Rolnictwo: [
    { code: "rol_uprawy", label_pl: "Uprawa roślin" },
    { code: "rol_hodowla", label_pl: "Hodowla zwierząt" },
    { code: "rol_uslugi", label_pl: "Usługi rolnicze" },
  ],
  Inne: [{ code: "inne_pozostale", label_pl: "Pozostała działalność" }],
};

const SECTION_CATEGORY_MAP = {
  A: "Produkcja",
  B: "Poligrafia",
  C: "IT / software / hardware",
  D: "Handel i usługi",
  E: "Budownictwo",
  F: "Hotelarstwo / gastronomia",
  G: "Transport / motoryzacja",
  H: "Rolnictwo",
  I: "Inne",
};

function buildFallbackActivities() {
  return Object.entries(FALLBACK_ACTIVITY_CATALOG).flatMap(([category, items]) =>
    items.map((item) => ({
      id: `${category}:${item.code}`,
      category,
      code: item.code,
      label_pl: item.label_pl,
      label_source: item.label_pl,
      tariff_section: null,
    }))
  );
}

function buildTariffActivities() {
  const tariff = loadTariff();
  const activities = [];

  for (const section of tariff.tariff_sections || []) {
    const sectionId = String(section.section_id || "").trim().toUpperCase();
    if (!sectionId || !Array.isArray(section.industries_activities_risk_classes)) {
      continue;
    }

    const category = SECTION_CATEGORY_MAP[sectionId] || "Inne";

    for (const row of section.industries_activities_risk_classes) {
      const labelPl = String(row.activity_pl || "").trim();
      const labelDe = String(row.activity_de || "").trim();
      const sourceLabel = labelPl || labelDe;
      if (!sourceLabel) continue;

      const code = String(row.wz_code || row.risiko_nr || row.wagnis_nr || sourceLabel)
        .trim()
        .toLowerCase();

      activities.push({
        id: `${category}:${code}`,
        category,
        code,
        label_pl: labelPl || null,
        label_source: sourceLabel,
        tariff_section: sectionId,
      });
    }
  }

  return activities;
}

function buildActivitiesDataset() {
  const fallbackActivities = buildFallbackActivities();
  const tariffActivities = buildTariffActivities();

  const merged = new Map();

  for (const item of [...fallbackActivities, ...tariffActivities]) {
    const key = `${item.category}:${item.code}`;
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, item);
      continue;
    }

    merged.set(key, {
      ...existing,
      label_pl: existing.label_pl || item.label_pl,
      label_source: existing.label_source || item.label_source,
      tariff_section: existing.tariff_section || item.tariff_section,
    });
  }

  return [...merged.values()].sort((a, b) =>
    a.category.localeCompare(b.category, "pl") ||
    (a.label_pl || a.label_source).localeCompare(b.label_pl || b.label_source, "pl")
  );
}

app.get("/activities", (req, res) => {
  const requestedCategory = String(req.query.category || req.query.type || "").trim();
  const activities = buildActivitiesDataset();

  const filteredActivities = requestedCategory
    ? activities.filter(
        (item) =>
          item.category.toLowerCase() === requestedCategory.toLowerCase() ||
          String(item.tariff_section || "").toLowerCase() === requestedCategory.toLowerCase()
      )
    : activities;

  res.json(filteredActivities);
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
