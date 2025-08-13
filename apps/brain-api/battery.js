import express from 'express';

const router = express.Router();

// --- config you gave me ---
const WH_PER_MILE = 45;
const CELL = {
  "18650": { ah: 3.5, v: 3.7, price: 5 },
  "21700": { ah: 5.0, v: 3.7, price: 6 },
};
const BMS_COST = { regular: 100, smart: 200 };

// Parse range like 60, "60", "60 mi", "60-84", "60–84" (en dash), "60 to 84"
function normalizeRangeMiles(input) {
  if (typeof input === 'number') return input;
  if (!input) return NaN;
  const s = String(input).toLowerCase().replace(/[^\d.\-\–\sto]/g, ''); // strip units
  // split on -, –, or 'to'
  const parts = s.split(/\s*(?:\-|–|to)\s*/).filter(Boolean);
  const nums = parts.map(p => parseFloat(p)).filter(n => Number.isFinite(n));
  if (nums.length === 1) return nums[0];
  if (nums.length >= 2) return (nums[0] + nums[1]) / 2;
  return NaN;
}

// Map a target voltage to a sensible S using nominal 3.7V/cell
function seriesFromVoltage(targetVoltage) {
  const s = Math.max(1, Math.round((+targetVoltage || 0) / 3.7));
  return s;
}

// Quote endpoint
router.post('/quote', (req, res) => {
  try {
    const {
      vehicleType = 'pev',
      desiredRangeMiles,
      targetVoltage,
      cellType = '21700',
      smartBMS = false,
      notes = ''
    } = req.body || {};

    // sanitize inputs
    const miles = normalizeRangeMiles(desiredRangeMiles);
    if (!Number.isFinite(miles) || miles <= 0) {
      return res.status(400).json({ ok: false, error: 'Invalid desiredRangeMiles' });
    }
    const S = seriesFromVoltage(targetVoltage);
    if (!Number.isFinite(S) || S <= 0) {
      return res.status(400).json({ ok: false, error: 'Invalid targetVoltage' });
    }
    const cell = CELL[String(cellType).toLowerCase()];
    if (!cell) {
      return res.status(400).json({ ok: false, error: 'cellType must be "18650" or "21700"' });
    }

    // calculations
    const packWhNeeded = miles * WH_PER_MILE;                          // total energy target
    const cellWh = cell.ah * cell.v;                                   // Wh per cell
    const P = Math.max(1, Math.ceil(packWhNeeded / (S * cellWh)));     // parallel strings
    const totalCells = S * P;
    const cellsCost = totalCells * cell.price;
    const bmsType = smartBMS ? 'smart' : 'regular';
    const bmsCost = BMS_COST[bmsType];

    const estTotal = cellsCost + bmsCost; // (no labor/case/wiring included yet)

    // helpful derived voltages
    const nominalV = +(S * 3.7).toFixed(1);
    const fullV = +(S * 4.2).toFixed(1);

    res.json({
      ok: true,
      summary: {
        vehicleType,
        requested: { desiredRangeMiles, targetVoltage, cellType, smartBMS, notes },
        normalized: { miles, series: S, cellWh: +cellWh.toFixed(2) }
      },
      design: {
        S, P,
        nominalVoltage: nominalV,
        fullVoltage: fullV,
        totalCells,
        approxPackWh: +(S * P * cellWh).toFixed(0)
      },
      pricing: {
        cellType,
        pricePerCell: cell.price,
        cellsCost,
        bmsType,
        bmsCost,
        estimatedSubtotal: estTotal
      },
      policy: {
        depositRequiredPercent: 65,
        warranty: "1 year workmanship; manufacturer warranty support for cells and BMS."
      }
    });
  } catch (err) {
    console.error('quote error', err);
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

// simple ping
router.get('/ping', (_req, res) => res.json({ ok: true, feature: 'battery' }));

export default router;