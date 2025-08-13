// apps/brain-api/battery.js
import express from "express";

const router = express.Router();

// --- constants / simple catalog ---
const WH_PER_MILE = 45; // conservative overhead
const CELL_CATALOG = {
  "18650": { cellAh: 3.5, price: 5.0 }, // rough EVE/Samsung 35E class
  "21700": { cellAh: 5.0, price: 6.0 }, // 50E/50GB class
};
// BMS pricing
const BMS_PRICES = { regular: 100, smart: 200 };

// Voltage → series mapping (3.6V nominal chemistry)
const VOLT_SERIES = {
  36: 10, // 10S ~ 36V
  48: 13, // 13S ~ 46.8V
  60: 16, // 16S ~ 57.6V
  72: 20, // 20S ~ 72V
  84: 23, // 23S ~ 82.8V
  96: 26, // 26S ~ 93.6V
};

// --- helpers ---
function parsePositiveNumber(n, fallback = undefined) {
  const v = typeof n === "number" ? n : parseFloat(String(n || "").replace(/[^\d.]/g, ""));
  return isFinite(v) && v > 0 ? v : fallback;
}

function coerceRangeMiles(input) {
  // Accept "60", "60-84", "60 – 84", " 60 — 84 "
  if (typeof input === "number") return input;
  const s = String(input || "").trim();
  if (!s) return undefined;
  const parts = s.split(/[-–—]/).map((p) => parsePositiveNumber(p));
  const nums = parts.filter((x) => typeof x === "number");
  if (!nums.length) return undefined;
  if (nums.length === 1) return nums[0];
  // if a range, use the lower bound to be conservative
  return Math.min(...nums);
}

function pickSeriesForVoltage(voltage) {
  const v = parsePositiveNumber(voltage);
  if (!v) return undefined;
  if (VOLT_SERIES[v]) return VOLT_SERIES[v];
  // fallback: map to nearest supported voltage
  const candidates = Object.keys(VOLT_SERIES).map(Number);
  let nearest = candidates[0];
  let best = Math.abs(v - nearest);
  for (const c of candidates.slice(1)) {
    const d = Math.abs(v - c);
    if (d < best) {
      best = d;
      nearest = c;
    }
  }
  return VOLT_SERIES[nearest];
}

function roundUp(n, step = 1) {
  return Math.ceil(n / step) * step;
}

// --- core compute ---
function computeQuote({
  voltage,            // e.g., 36|48|60|72|84|96 (can be near these; we snap)
  desiredAh,          // optional; if not provided, inferred from desiredRangeMiles
  desiredRangeMiles,  // optional; if not provided, inferred from desiredAh
  cellFormat,         // "18650" | "21700"
  bmsType,            // "regular" | "smart"
}) {
  // sanitize
  const series = pickSeriesForVoltage(voltage);
  if (!series) return { ok: false, error: "Unsupported or missing voltage." };

  const format = (String(cellFormat || "21700").trim() in CELL_CATALOG)
    ? String(cellFormat).trim()
    : "21700";
  const { cellAh, price: cellPrice } = CELL_CATALOG[format];

  const bms = (String(bmsType || "regular").toLowerCase() === "smart") ? "smart" : "regular";
  const bmsCost = BMS_PRICES[bms];

  // if desiredAh missing but range provided, infer Ah from range & WH_PER_MILE
  let rangeMi = desiredRangeMiles !== undefined ? coerceRangeMiles(desiredRangeMiles) : undefined;
  let ah = parsePositiveNumber(desiredAh);

  let nominalVoltage;
  // derive nominalVoltage from series * 3.6V
  nominalVoltage = series * 3.6;

  if (!ah && rangeMi) {
    const neededWh = rangeMi * WH_PER_MILE;
    ah = neededWh / nominalVoltage;
    // round to a friendly size (e.g., nearest 1Ah)
    ah = Math.max(ah, 5);
    ah = Math.round(ah * 10) / 10;
  } else if (ah && !rangeMi) {
    // estimate range from provided ah
    const packWhTmp = nominalVoltage * ah;
    rangeMi = Math.floor(packWhTmp / WH_PER_MILE);
  } else if (!ah && !rangeMi) {
    return { ok: false, error: "Provide desiredAh or desiredRangeMiles." };
  }

  // Parallel count from cellAh
  const parallel = Math.max(1, Math.ceil(ah / cellAh));
  const totalCells = series * parallel;

  const packWh = nominalVoltage * (parallel * cellAh); // nominal pack Wh using per-cell Ah
  const estRange = Math.floor(packWh / WH_PER_MILE);

  // cost model
  const cellsCost = totalCells * cellPrice;
  const materialsBuffer = Math.round(cellsCost * 0.07); // 7% misc: nickel, insulators, fishpaper, heatshrink
  const labor = 0; // you can add later if desired
  const subtotal = cellsCost + bmsCost + materialsBuffer + labor;

  return {
    ok: true,
    inputs: {
      voltage,
      snappedVoltage: Math.round(nominalVoltage), // for transparency
      desiredAh: ah,
      desiredRangeMiles: rangeMi,
      cellFormat: format,
      bmsType: bms,
    },
    design: {
      series,
      parallel,
      totalCells,
      packWh: Math.round(packWh),
      estRangeMiles: estRange,
    },
    costs: {
      cells: cellsCost,
      bms: bmsCost,
      materialsBuffer,
      labor,
      total: subtotal,
    },
    policy: {
      whPerMile: WH_PER_MILE,
      notes: [
        "Diagnosis & confirmation still required before final invoice.",
        "Deposit required: 65% to order cells and BMS.",
        "Turnaround depends on parts lead times.",
        "1-year workmanship warranty; manufacturer warranty support for cells/BMS.",
      ],
    },
  };
}

// --- routes ---
// sanity check
router.get("/ping", (_req, res) => res.json({ ok: true, feature: "battery" }));

// POST /v1/battery/quote
router.post("/quote", (req, res) => {
  try {
    const {
      voltage,
      desiredAh,
      desiredRangeMiles,
      cellFormat,
      bmsType,
    } = req.body || {};

    const result = computeQuote({
      voltage,
      desiredAh,
      desiredRangeMiles,
      cellFormat,
      bmsType,
    });

    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    console.error("battery/quote error:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;