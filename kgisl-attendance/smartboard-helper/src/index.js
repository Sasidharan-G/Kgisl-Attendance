// Load smartboard-helper/.env when present so a plain `npm start` is enough.
try { process.loadEnvFile?.(new URL('../.env', import.meta.url)); } catch { /* no .env file */ }

import { loadConfig } from './config.js';
import { createHelperServer } from './server.js';
import { createTransport } from './transport.js';

const config = loadConfig();
const transport = await createTransport(config);
const server = createHelperServer(config, transport);

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') console.error(`[smartboard-helper] port ${config.port} is already in use - the helper is probably already running.`);
  else console.error('[smartboard-helper]', error.message);
  process.exit(1);
});

server.listen(config.port, config.host, () => {
  console.log(`[smartboard-helper] listening on http://${config.host}:${config.port}`);
  console.log(`[smartboard-helper] transport=${config.transport}`);
});

async function shutdown() {
  server.close();
  await transport.close();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
