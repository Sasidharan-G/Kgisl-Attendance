/**
 * Runs the integration tests with RUN_INTEGRATION=1 on every platform (a plain `VAR=1 node ...` does not work in the
 * Windows shells). DATABASE_URL and REDIS_URL must point at disposable services; see test/integration.test.cjs.
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

for (const name of ['DATABASE_URL', 'REDIS_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'QR_HMAC_SECRET']) {
  if (!process.env[name]) {
    console.error(`${name} must be set for the integration tests (use a throw-away database, never a real one).`);
    process.exit(2);
  }
}

const result = spawnSync(
  process.execPath,
  ['--test', path.join(__dirname, 'integration.test.cjs')],
  { stdio: 'inherit', env: { ...process.env, RUN_INTEGRATION: '1', NODE_ENV: 'test' } }
);
process.exit(result.status ?? 1);
