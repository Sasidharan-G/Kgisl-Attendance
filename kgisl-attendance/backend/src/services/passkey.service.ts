import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { prisma } from '../config/prisma';
import { redis, passkeyAuthChallengeKey, passkeyRegisterChallengeKey } from '../config/redis';
import { allowedOrigins, env } from '../config/env';
import { Errors } from '../utils/AppError';
import { isPasskeyDeviceId, passkeyDeviceId, userHandleFor } from '../utils/passkey';

const REGISTER_CHALLENGE_TTL_S = 300;
const AUTH_CHALLENGE_TTL_S = 180; // Face ID is confirmed at the tap, then the QR is scanned

// Challenges are strictly single-use: read and delete in one atomic step so a captured
// response can never be replayed against the same challenge.
const TAKE_CHALLENGE_SCRIPT = `
local value = redis.call('GET', KEYS[1])
if value then redis.call('DEL', KEYS[1]) end
return value
`;

async function takeChallenge(key: string): Promise<string> {
  const challenge = (await redis.eval(TAKE_CHALLENGE_SCRIPT, 1, key)) as string | null;
  if (!challenge) throw Errors.PASSKEY_CHALLENGE_EXPIRED();
  return challenge;
}

export async function getPasskeyStatus(studentId: string) {
  const [student, count] = await Promise.all([
    prisma.student.findUnique({ where: { id: studentId }, select: { deviceId: true } }),
    prisma.studentPasskey.count({ where: { studentId } }),
  ]);
  if (!student) throw Errors.STUDENT_NOT_FOUND();
  const boundTo = isPasskeyDeviceId(student.deviceId) ? 'passkey' : student.deviceId ? 'device' : 'none';
  return { enrolled: count > 0, boundTo };
}

/** Enrolment is only allowed while the account is unbound, so a passkey can never override an existing binding. */
export async function beginPasskeyRegistration(studentId: string) {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw Errors.STUDENT_NOT_FOUND();
  if (student.deviceId) throw Errors.DEVICE_ALREADY_BOUND();

  const options = await generateRegistrationOptions({
    rpName: env.WEBAUTHN_RP_NAME,
    rpID: env.WEBAUTHN_RP_ID,
    userName: student.email,
    userDisplayName: student.name,
    userID: userHandleFor(student.id),
    attestationType: 'none',
    authenticatorSelection: {
      authenticatorAttachment: 'platform', // Face ID / Touch ID / Windows Hello / Android biometrics
      residentKey: 'preferred',
      userVerification: 'required',
    },
    timeout: 60_000,
  });
  await redis.set(passkeyRegisterChallengeKey(studentId), options.challenge, 'EX', REGISTER_CHALLENGE_TTL_S);
  return options;
}

export async function finishPasskeyRegistration(studentId: string, response: RegistrationResponseJSON) {
  const expectedChallenge = await takeChallenge(passkeyRegisterChallengeKey(studentId));
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: allowedOrigins,
      expectedRPID: env.WEBAUTHN_RP_ID,
      requireUserVerification: true,
    });
  } catch {
    throw Errors.PASSKEY_INVALID();
  }
  if (!verification.verified || !verification.registrationInfo) throw Errors.PASSKEY_INVALID();

  const { credential } = verification.registrationInfo;
  await prisma.$transaction(async (tx) => {
    // Bind only if still unbound; closes the race with a concurrent first scan from another device.
    const bound = await tx.student.updateMany({
      where: { id: studentId, deviceId: null },
      data: { deviceId: passkeyDeviceId(credential.id) },
    });
    if (bound.count === 0) throw Errors.DEVICE_ALREADY_BOUND();
    await tx.studentPasskey.create({
      data: {
        studentId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports ?? [],
      },
    });
  });
  return { credentialId: credential.id };
}

export async function beginPasskeyAuthentication(studentId: string) {
  const passkeys = await prisma.studentPasskey.findMany({ where: { studentId } });
  if (passkeys.length === 0) throw Errors.PASSKEY_NOT_ENROLLED();

  const options = await generateAuthenticationOptions({
    rpID: env.WEBAUTHN_RP_ID,
    allowCredentials: passkeys.map((key) => ({
      id: key.credentialId,
      transports: key.transports as AuthenticatorTransportFuture[],
    })),
    userVerification: 'required',
    timeout: 60_000,
  });
  await redis.set(passkeyAuthChallengeKey(studentId), options.challenge, 'EX', AUTH_CHALLENGE_TTL_S);
  return options;
}

/** Verifies a Face ID / Touch ID assertion and returns the server-derived device id for this student. */
export async function verifyPasskeyAssertion(studentId: string, response: AuthenticationResponseJSON): Promise<string> {
  const expectedChallenge = await takeChallenge(passkeyAuthChallengeKey(studentId));
  const passkey = await prisma.studentPasskey.findUnique({ where: { credentialId: response.id } });
  // A credential that belongs to a different student is treated exactly like an unknown one.
  if (!passkey || passkey.studentId !== studentId) throw Errors.PASSKEY_INVALID();

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: allowedOrigins,
      expectedRPID: env.WEBAUTHN_RP_ID,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: passkey.counter,
        transports: passkey.transports as AuthenticatorTransportFuture[],
      },
      requireUserVerification: true,
    });
  } catch {
    throw Errors.PASSKEY_INVALID();
  }
  if (!verification.verified) throw Errors.PASSKEY_INVALID();

  await prisma.studentPasskey.update({
    where: { id: passkey.id },
    data: { counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() },
  });
  return passkeyDeviceId(passkey.credentialId);
}

/** Passkey-bound accounts must present an assertion; a bare deviceId can never satisfy the binding. */
export async function assertPasskeyNotRequired(studentId: string): Promise<void> {
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { deviceId: true } });
  if (isPasskeyDeviceId(student?.deviceId)) throw Errors.PASSKEY_REQUIRED();
}
