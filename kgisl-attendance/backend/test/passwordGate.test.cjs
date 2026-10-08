const test = require('node:test');
const assert = require('node:assert/strict');
const { requireAuth, requireAuthAllowPasswordChange, signAccessToken } = require('../dist/middleware/auth.middleware.js');

function run(middleware, token) {
  return new Promise((resolve) => {
    const req = { headers: { authorization: `Bearer ${token}` } };
    middleware(req, {}, (error) => resolve({ error, req }));
  });
}

test('sessions that still use an initial password only reach the change-password route', async () => {
  const gated = signAccessToken({ sub: 'student-1', role: 'STUDENT', mcp: true });

  const blocked = await run(requireAuth('STUDENT'), gated);
  assert.equal(blocked.error?.code, 'PASSWORD_CHANGE_REQUIRED');
  assert.equal(blocked.error?.statusCode ?? blocked.error?.status, 403);

  const allowed = await run(requireAuthAllowPasswordChange('STUDENT'), gated);
  assert.equal(allowed.error, undefined);
  assert.equal(allowed.req.auth.sub, 'student-1');
});

test('normal sessions are unaffected and role checks still apply', async () => {
  const normal = signAccessToken({ sub: 'faculty-1', role: 'FACULTY' });
  assert.equal((await run(requireAuth('FACULTY'), normal)).error, undefined);
  assert.equal((await run(requireAuth('ADMIN'), normal)).error?.code, 'INVALID_JWT');
});
