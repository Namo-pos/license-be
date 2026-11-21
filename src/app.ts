import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { licenseRouter } from './routes/license.routes.js';

export const app = express();

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

