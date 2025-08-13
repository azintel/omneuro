import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import bodyParser from 'body-parser';

import googleRoutes from './google.js';
import batteryRoutes from './battery.js';

const app = express();

app.use(cors());
app.use(morgan('dev'));
app.use(bodyParser.json({ limit: '2mb' }));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/v1/google', googleRoutes);
app.use('/v1/battery', batteryRoutes);

// single listen only
const PORT = 8081;
app.listen(PORT, () => {
  console.log(`brain-api listening on :${PORT} (pid ${process.pid})`);
});