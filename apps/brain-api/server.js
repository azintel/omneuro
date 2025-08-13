import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import bodyParser from 'body-parser';
import docsRoutes from './docs.js';
import sheetsRoutes from './sheets.js';
import googleRoutes from './google.js';
import batteryRoutes from './battery.js';
import adminRoutes from './admin.js'; 

const app = express();

app.use(cors());
app.use(morgan('dev'));
app.use(bodyParser.json({ limit: '2mb' }));
app.use('/v1/google/sheets', sheetsRoutes);
app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/v1/google/docs', docsRoutes);
app.use('/v1/google', googleRoutes);
app.use('/v1/battery', batteryRoutes);
app.use('/v1/admin', adminRoutes);

// single listen only
const PORT = 8081;
app.listen(PORT, () => {
  console.log(`brain-api listening on :${PORT} (pid ${process.pid})`);
});