import { app } from './app.js';
import { config } from './config/env.js';

app.listen(config.port, () => {
  console.log('========================================================');
  console.log(`  🚀 NAMO POS License & Cloudflare Tunnel Service`);
  console.log(`  Listening on: http://localhost:${config.port}`);
  console.log(`  Base Domain:  ${config.baseDomain}`);
  console.log(`  CF Sandbox:   ${config.cfSandbox ? 'ENABLED (Safe Local Mock)' : 'DISABLED (Real Cloudflare API)'}`);
  console.log('========================================================');
});
