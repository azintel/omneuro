// apps/brain-api/battery.js
import express from 'express';
const router = express.Router();

router.get('/ping', (req, res) => res.json({ ok: true, feature: 'battery' }));

export default router;