const express = require("express");
const path = require("path");
const { listTariffSections } = require("./tariff_engine");

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, "public")));

app.get("/activities", (req, res) => {
  const activityType = String(req.query.type || "").trim().toLowerCase();

  const allActivities = listTariffSections().map((section) => ({
    value: String(section.code),
    label: section.title_pl || section.title_de || String(section.code),
    type: String(section.parent_section_id || "").toLowerCase(),
  }));

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
