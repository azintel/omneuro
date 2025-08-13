import express from 'express';
const router = express.Router();

router.get('/ping', (req, res) => {
  res.json({ ok: true, feature: 'battery' });
});

// example: quote endpoint (already added in your last push—keep your logic if you have it)
router.post('/quote', (req, res) => {
  res.json({ ok: true, note: 'stub - implement quote logic' });
});

export default router;