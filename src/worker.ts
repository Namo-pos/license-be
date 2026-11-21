import { handleAsNodeRequest } from 'cloudflare:node';
import { app } from './app.js';
import { withWorkerDatabase } from './storage/prisma.client.js';

const port = 4000;
app.listen(port);

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return withWorkerDatabase(env.DB, () => handleAsNodeRequest(port, request));
  },
} satisfies ExportedHandler<Env>;
