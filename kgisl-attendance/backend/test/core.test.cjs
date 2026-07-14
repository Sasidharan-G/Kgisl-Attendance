const test = require('node:test');
const assert = require('node:assert/strict');

const { distanceMeters } = require('../dist/utils/geo.js');
const {
  generateNonce,
  generateSecureToken,
  sha256Hex,
  signQrPayload,
  verifyQrSignature,
} = require('../dist/utils/crypto.js');
const { signAccessToken } = require('../dist/middleware/auth.middleware.js');
const jwt = require('jsonwebtoken');

test('distanceMeters returns zero for the same coordinate', () => {
  assert.equal(distanceMeters(11.0834, 76.997, 11.0834, 76.997), 0);
});

test('distanceMeters produces a realistic short campus distance', () => {
  const distance = distanceMeters(11.0834, 76.997, 11.0843, 76.997);
  assert.ok(distance > 95 && distance < 105);
});

test('secure QR primitives have the required entropy and stable hash', () => {
  const first = generateSecureToken();
  const second = generateSecureToken();
  assert.notEqual(first, second);
  assert.ok(first.length >= 40);
  assert.match(generateNonce(), /^[0-9a-f]{32}$/);
  assert.equal(sha256Hex('kgisl').length, 64);
});

test('QR signature accepts original data and rejects tampering', () => {
  const payload = {
    sessionId: '42c1b98c-86a1-47f8-a69f-c826f0e249a1',
    token: generateSecureToken(),
    issuedAt: Date.now(),
    expiresAt: Date.now() + 30_000,
    nonce: generateNonce(),
  };
  const signature = signQrPayload(payload);
  assert.equal(verifyQrSignature(payload, signature), true);
  assert.equal(verifyQrSignature({ ...payload, expiresAt: payload.expiresAt + 1 }, signature), false);
});

test('access token preserves identity and role claims', () => {
  const token = signAccessToken({ sub: 'student-id', role: 'STUDENT' });
  const decoded = jwt.decode(token);
  assert.equal(decoded.sub, 'student-id');
  assert.equal(decoded.role, 'STUDENT');
  assert.ok(decoded.exp > decoded.iat);
});
