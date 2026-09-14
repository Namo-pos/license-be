import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { licenseRouter } from './routes/license.routes.js';

const app = express();

app.use(cors());
app.use(express.json());

// Request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'OK',
    service: 'POS-License Server',
    sandboxMode: config.cfSandbox,
    baseDomain: config.baseDomain,
    timestamp: new Date().toISOString(),
  });
});

// Mount routes
app.use('/api/license', licenseRouter);

app.listen(config.port, () => {
  console.log('========================================================');
  console.log(`  🚀 NAMO POS License & Cloudflare Tunnel Service`);
  console.log(`  Listening on: http://localhost:${config.port}`);
  console.log(`  Base Domain:  ${config.baseDomain}`);
  console.log(`  CF Sandbox:   ${config.cfSandbox ? 'ENABLED (Safe Local Mock)' : 'DISABLED (Real Cloudflare API)'}`);
  console.log('========================================================');
});
