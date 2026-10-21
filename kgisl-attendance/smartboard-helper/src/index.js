import { fileURLToPath } from 'node:url';
import { applyEnv, ensureEnvFile, readEnvFile } from './envFile.js';
import { loadConfig } from './config.js';
import { createHelperServer } from './server.js';
import { createTransport } from './transport.js';

// Zero-config start: `.env` is created on first run (secret key, USB serial, auto port, allowed sites).
const envPath = fileURLToPath(new URL('../.env', import.meta.url));
const virtual = process.argv.includes('--virtual') || process.env.NODE_ENV === 'test';
try {
  applyEnv(virtual ? readEnvFile(envPath) : ensureEnvFile(envPath));
} catch (error) {
  console.warn(`[smartboard-helper] could not prepare .env: ${error.message}`);
}

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
  if (config.transport === 'serial') console.log('[smartboard-helper] plug the ESP32 into any USB port: it is detected automatically.');
});

async function shutdown() {
  server.close();
  transport.stopMonitor?.();
  await transport.close();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
