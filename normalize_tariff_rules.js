const fs = require('fs');
const path = require('path');

const rawPath = path.join(__dirname, 'data', 'rules', 'tariff_rules_raw.json');
const normalizedPath = path.join(__dirname, 'data', 'rules', 'tariff_rules_normalized.json');

function toNumberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalize() {
  const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
  const sectionA = (raw.tariff_sections || []).find((section) => section.section_id === 'A');

  const uncertainItems = [];
  const rows = [];

  if (!sectionA) {
    uncertainItems.push({
      item: 'Tarifabschnitt A nicht gefunden.',
      reason: 'Ohne Abschnitt A konnten keine klaren Prämienzeilen normalisiert werden.'
    });
  }

  const activities = sectionA?.industries_activities_risk_classes || [];
  const sampleRows = sectionA?.base_rates?.sample_tariff_table_rows || [];

  const activityByDe = new Map(
    activities
      .filter((entry) => entry.activity_de)
      .map((entry) => [entry.activity_de, entry])
  );

  for (const sample of sampleRows) {
    const activityMeta = activityByDe.get(sample.activity_de);

    if (!activityMeta) {
      uncertainItems.push({
        item: `Keine Aktivitätsmetadaten für Tarifzeile '${sample.activity_de}'.`,
        reason: 'Risikoklasse konnte nicht eindeutig aus den extrahierten Aktivitätsdaten zugeordnet werden.',
        source_reference: 'A.base_rates.sample_tariff_table_rows'
      });
    }

    if (sample && typeof sample.praemiensatz_per_mille !== 'number') {
      uncertainItems.push({
        item: `Uneindeutiger Prämiensatz für '${sample.activity_de}'.`,
        reason: 'Prämiensatz ist nicht als numerischer Wert extrahiert worden.',
        source_reference: 'A.base_rates.sample_tariff_table_rows'
      });
    }

    if (sample && typeof sample.mindestpraemie_eur !== 'number') {
      uncertainItems.push({
        item: `Uneindeutige Mindestprämie für '${sample.activity_de}'.`,
        reason: 'Mindestprämie ist nicht als numerischer Wert extrahiert worden.',
        source_reference: 'A.base_rates.sample_tariff_table_rows'
      });
    }

    rows.push({
      activity_de: sample.activity_de || null,
      activity_pl: null,
      risk_class: activityMeta?.risk_class_erw_prodh || null,
      base_rate_per_mille: toNumberOrNull(sample.praemiensatz_per_mille),
      minimum_premium: toNumberOrNull(sample.mindestpraemie_eur),
      deductible: null,
      limits: [],
      source_reference: activityMeta?.source_refs?.[0] || 'PAGE 4, Tabelle Chemie',
      notes: [
        'RK Rückruf ist separat extrahiert und nicht in diesem normalisierten Basis-Prämiensatz enthalten.'
      ]
    });
  }

  const globalLimits = [];
  const limits = sectionA?.limits;
  if (limits?.main_limit) {
    globalLimits.push({
      type_de: limits.main_limit.scope || 'Hauptdeckung',
      amount_per_claim_eur: toNumberOrNull(limits.main_limit.per_claim_eur),
      annual_aggregate_eur: toNumberOrNull(limits.main_limit.annual_aggregate_eur),
      source_reference: 'A.limits.main_limit'
    });
  }

  for (const sublimit of limits?.sublimits_per_claim_eur || []) {
    globalLimits.push({
      type_de: sublimit.type_de || null,
      amount_per_claim_eur: toNumberOrNull(sublimit.amount_eur),
      annual_aggregate_eur: null,
      annual_maximization: sublimit.annual_maximization || null,
      source_reference: 'A.limits.sublimits_per_claim_eur'
    });
  }

  const globalDeductibles = [];
  for (const ded of sectionA?.deductibles || []) {
    globalDeductibles.push({
      type_de: ded.type_de || null,
      deductible_eur: toNumberOrNull(ded.deductible_eur),
      deductible_percent: toNumberOrNull(ded.deductible_percent),
      min_eur: toNumberOrNull(ded.min_eur),
      max_eur: toNumberOrNull(ded.max_eur),
      source_reference: 'A.deductibles'
    });
  }

  const normalized = {
    source: 'data/rules/tariff_rules_raw.json',
    status: 'normalized_unverified',
    sections: [
      {
        code: sectionA?.section_id || 'A',
        title_de: sectionA?.title_de || null,
        title_pl: sectionA?.title_pl || null,
        rating_basis: sectionA?.base_rates?.premium_rating_basis_de || null,
        rows
      }
    ],
    global_limits: globalLimits,
    global_deductibles: globalDeductibles,
    uncertain_items: [
      ...(raw.uncertain_items || []),
      {
        item: 'Nur klar numerisch extrahierte Beispiel-Prämienzeilen wurden normalisiert.',
        reason: 'Der verfügbare Tarifausschnitt enthält keine vollständige Gesamt-Prämientabelle für alle Aktivitäten.',
        source_reference: 'A.base_rates.sample_tariff_table_rows'
      },
      {
        item: 'Polnische Aktivitätsbezeichnungen wurden nicht ergänzt.',
        reason: 'Im Quellmaterial liegen für die konkreten Aktivitätszeilen keine eindeutigen activity_pl-Werte vor.',
        source_reference: 'A.industries_activities_risk_classes'
      },
      ...uncertainItems
    ]
  };

  fs.writeFileSync(normalizedPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
}

normalize();
