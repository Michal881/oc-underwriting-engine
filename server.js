const express = require("express");
const path = require("path");
const { loadTariff } = require("./tariff_engine");

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, "public")));

app.get("/activities", (req, res) => {
  const activityType = String(req.query.type || "").trim().toUpperCase();
  const tariff = loadTariff();
  const allActivities = [];

  for (const section of tariff.tariff_sections || []) {
    const sectionId = String(section.section_id || "").trim().toUpperCase();
    const rows = Array.isArray(section.industries_activities_risk_classes)
      ? section.industries_activities_risk_classes
      : [];

    for (const row of rows) {
      const label = String(row.activity_pl || row.activity_de || "").trim();
      if (!label) continue;

      const idCandidate =
        row.risiko_nr || row.wagnis_nr || row.wz_code || `${sectionId}:${label}`;

      allActivities.push({
        value: String(idCandidate),
        label,
        type: sectionId,
      });
    }
  }

  const filteredActivities = activityType
    ? allActivities.filter((activity) => activity.type === activityType)
    : allActivities;

  res.json(filteredActivities.map(({ value, label }) => ({ value, label })));
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
