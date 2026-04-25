const express = require("express");
const path = require("path");
const {
  getSectionAActivities,
  getSectionAQuestions,
  calculateSectionAQuote,
} = require("./section_a_engine");

const app = express();
const PORT = 3000;

const ENABLE_DEMO_ACTIVITY_CATALOG = process.env.ENABLE_DEMO_ACTIVITY_CATALOG === "true";

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/section-a/activities", (_req, res) => {
  res.json({
    category: "Produkcja",
    section_code: "A",
    activities: getSectionAActivities(),
    note: "Section A extracted data is the canonical source.",
  });
});

app.get("/api/section-a/questions", (req, res) => {
  res.json({
    section_code: "A",
    category: "Produkcja",
    ...getSectionAQuestions(req.query.activity_id),
  });
});

app.post("/api/section-a/quote", (req, res) => {
  const quote = calculateSectionAQuote(req.body || {});
  res.json({
    section_code: "A",
    category: "Produkcja",
    activities: getSectionAActivities(),
    questions: getSectionAQuestions((req.body || {}).activity_id),
    ...quote,
  });
});

app.get("/activities", (_req, res) => {
  if (!ENABLE_DEMO_ACTIVITY_CATALOG) {
    return res.json({
      feature_flag: "ENABLE_DEMO_ACTIVITY_CATALOG",
      enabled: false,
      message: "Demo catalog is disabled by default. Use /api/section-a/activities.",
      activities: [],
    });
  }

  return res.json({
    feature_flag: "ENABLE_DEMO_ACTIVITY_CATALOG",
    enabled: true,
    activities: [
      {
        id: "demo:disabled",
        category: "Demo",
        label: "Demo catalog intentionally hidden behind feature flag",
      },
    ],
  });
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
