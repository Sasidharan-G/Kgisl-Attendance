import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { api } from '../services/api.js';

/** WebAuthn needs HTTPS (or localhost) and a browser that exposes PublicKeyCredential. */
export function passkeySupported() {
  return typeof window !== 'undefined' && window.isSecureContext && typeof window.PublicKeyCredential === 'function';
}

export const getPasskeyStatus = () => api.get('/passkey/status').then((r) => r.data.data);

/** Turns a browser/authenticator failure into a code + message the scan page can show. */
function explain(error) {
  if (error?.name === 'NotAllowedError' || error?.name === 'AbortError') {
    return { code: 'PASSKEY_CANCELLED', message: 'Face ID / Touch ID was cancelled or timed out. Try again.' };
  }
  if (error?.name === 'InvalidStateError') {
    return { code: 'PASSKEY_EXISTS', message: 'A passkey already exists on this device.' };
  }
  return { code: error?.code || 'PASSKEY_ERROR', message: error?.message || 'Passkey verification failed. Try again.' };
}

/** Must be called from a user gesture (a tap), as Safari requires. Binds this device to the account. */
export async function enrollPasskey() {
  try {
    const optionsJSON = (await api.post('/passkey/register/options')).data.data;
    const attestation = await startRegistration({ optionsJSON });
    await api.post('/passkey/register/verify', attestation);
  } catch (error) {
    throw explain(error);
  }
}

/**
 * Prompts Face ID / Touch ID and returns a one-time assertion to send with the scan. Must be called
 * from a user gesture. The server derives the device id from it; the client's own id is not trusted.
 */
export async function getPasskeyAssertion() {
  try {
    const optionsJSON = (await api.post('/passkey/authenticate/options')).data.data;
    return await startAuthentication({ optionsJSON });
  } catch (error) {
    throw explain(error);
  }
}
