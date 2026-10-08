// A passkey-bound student's `deviceId` is "pk:<credentialId>". Clients may never submit that
// prefix themselves: it is derived server-side only after a verified WebAuthn assertion.
export const PASSKEY_DEVICE_PREFIX = 'pk:';

export const passkeyDeviceId = (credentialId: string): string => `${PASSKEY_DEVICE_PREFIX}${credentialId}`;

export const isPasskeyDeviceId = (deviceId: string | null | undefined): boolean =>
  typeof deviceId === 'string' && deviceId.startsWith(PASSKEY_DEVICE_PREFIX);

/** Stable per-student WebAuthn user handle (opaque bytes, never the email). */
export const userHandleFor = (studentId: string) => new TextEncoder().encode(studentId);
