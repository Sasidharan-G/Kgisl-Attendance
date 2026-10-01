import { loadConfig } from './config.js';
import { createHelperServer } from './server.js';
import { createTransport } from './transport.js';

const config = loadConfig();
const transport = await createTransport(config);
const server = createHelperServer(config, transport);

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
