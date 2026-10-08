const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const { isPasskeyDeviceId, passkeyDeviceId } = require('../dist/utils/passkey.js');

const RP_ID = 'attendance.example.edu';
const ORIGIN = 'https://attendance.example.edu';

// ---- a tiny software authenticator (ES256, "none" attestation) -------------------------------
const b64u = (buffer) => Buffer.from(buffer).toString('base64url');
const sha256 = (data) => crypto.createHash('sha256').update(data).digest();

function cborHead(major, value) {
  if (value < 24) return Buffer.from([(major << 5) | value]);
  if (value < 256) return Buffer.from([(major << 5) | 24, value]);
  return Buffer.from([(major << 5) | 25, value >> 8, value & 0xff]);
}
const cborInt = (n) => (n >= 0 ? cborHead(0, n) : cborHead(1, -1 - n));
const cborBytes = (bytes) => Buffer.concat([cborHead(2, bytes.length), Buffer.from(bytes)]);
const cborText = (text) => Buffer.concat([cborHead(3, Buffer.byteLength(text)), Buffer.from(text)]);
const cborMap = (entries) => Buffer.concat([cborHead(5, entries.length), ...entries.flat()]);

const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const jwk = publicKey.export({ format: 'jwk' });
const credentialId = crypto.randomBytes(32);
const counterBytes = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };

function registrationResponse(challenge) {
  const coseKey = cborMap([
    [cborInt(1), cborInt(2)], [cborInt(3), cborInt(-7)], [cborInt(-1), cborInt(1)],
    [cborInt(-2), cborBytes(Buffer.from(jwk.x, 'base64url'))], [cborInt(-3), cborBytes(Buffer.from(jwk.y, 'base64url'))],
  ]);
  const authData = Buffer.concat([
    sha256(RP_ID), Buffer.from([0x45]), counterBytes(0), Buffer.alloc(16),
    Buffer.from([credentialId.length >> 8, credentialId.length & 0xff]), credentialId, coseKey,
  ]);
  const attestationObject = cborMap([
    [cborText('fmt'), cborText('none')], [cborText('attStmt'), cborMap([])], [cborText('authData'), cborBytes(authData)],
  ]);
  const clientDataJSON = Buffer.from(JSON.stringify({ type: 'webauthn.create', challenge, origin: ORIGIN, crossOrigin: false }));
  return {
    id: b64u(credentialId), rawId: b64u(credentialId), type: 'public-key', clientExtensionResults: {},
    response: { clientDataJSON: b64u(clientDataJSON), attestationObject: b64u(attestationObject), transports: ['internal'] },
  };
}

function assertionResponse(challenge, counter, { userVerified = true } = {}) {
  const clientDataJSON = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge, origin: ORIGIN, crossOrigin: false }));
  const authData = Buffer.concat([sha256(RP_ID), Buffer.from([userVerified ? 0x05 : 0x01]), counterBytes(counter)]);
  const signature = crypto.sign('sha256', Buffer.concat([authData, sha256(clientDataJSON)]), privateKey);
  return {
    id: b64u(credentialId), rawId: b64u(credentialId), type: 'public-key', clientExtensionResults: {},
    response: { clientDataJSON: b64u(clientDataJSON), authenticatorData: b64u(authData), signature: b64u(signature) },
  };
}

test('passkey device ids are namespaced so clients cannot spoof them', () => {
  assert.equal(passkeyDeviceId('abc'), 'pk:abc');
  assert.equal(isPasskeyDeviceId('pk:abc'), true);
  assert.equal(isPasskeyDeviceId('3f2a-android-id'), false);
  assert.equal(isPasskeyDeviceId(null), false);
});

test('registration options demand a platform authenticator with user verification', async () => {
  const options = await generateRegistrationOptions({
    rpName: 'KGiSL Attendance', rpID: RP_ID, userName: 's@example.edu', userDisplayName: 'Student A',
    userID: new TextEncoder().encode('student-id'), attestationType: 'none',
    authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'preferred', userVerification: 'required' },
  });
  assert.equal(options.authenticatorSelection.authenticatorAttachment, 'platform');
  assert.equal(options.authenticatorSelection.userVerification, 'required');
  assert.ok(options.challenge.length >= 16);
});

test('passkey enrolment then Face ID assertion verifies end to end and enforces freshness', async () => {
  const regOptions = await generateRegistrationOptions({
    rpName: 'KGiSL Attendance', rpID: RP_ID, userName: 's@example.edu', userID: new TextEncoder().encode('student-id'),
    attestationType: 'none', authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
  });
  const registration = await verifyRegistrationResponse({
    response: registrationResponse(regOptions.challenge), expectedChallenge: regOptions.challenge,
    expectedOrigin: [ORIGIN], expectedRPID: RP_ID, requireUserVerification: true,
  });
  assert.equal(registration.verified, true);
  const { credential } = registration.registrationInfo;
  assert.equal(credential.id, b64u(credentialId));

  const authOptions = await generateAuthenticationOptions({
    rpID: RP_ID, allowCredentials: [{ id: credential.id }], userVerification: 'required',
  });
  const stored = { id: credential.id, publicKey: credential.publicKey, counter: credential.counter };
  const verify = (response, challenge = authOptions.challenge, origin = [ORIGIN], rpID = RP_ID) =>
    verifyAuthenticationResponse({ response, expectedChallenge: challenge, expectedOrigin: origin, expectedRPID: rpID, credential: stored, requireUserVerification: true });

  const ok = await verify(assertionResponse(authOptions.challenge, 1));
  assert.equal(ok.verified, true);
  assert.equal(ok.authenticationInfo.newCounter, 1);

  // Wrong challenge (replay of an older ceremony), wrong site, and a missing biometric are all rejected.
  await assert.rejects(() => verify(assertionResponse(authOptions.challenge, 2), 'a-different-challenge'));
  await assert.rejects(() => verify(assertionResponse(authOptions.challenge, 2), authOptions.challenge, ['https://evil.example']));
  await assert.rejects(() => verify(assertionResponse(authOptions.challenge, 2, { userVerified: false })));
});
