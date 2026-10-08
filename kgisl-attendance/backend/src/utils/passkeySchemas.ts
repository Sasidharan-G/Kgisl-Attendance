import { z } from 'zod';

const base64url = z.string().min(1).max(4096).regex(/^[A-Za-z0-9_-]+$/);

// Mirrors the WebAuthn JSON shapes. Unknown extension keys are tolerated (passthrough) because
// authenticators differ, but the fields the verifier relies on are validated and size-bounded.
export const registrationResponseSchema = z.object({
  id: base64url,
  rawId: base64url,
  type: z.literal('public-key'),
  authenticatorAttachment: z.string().optional(),
  clientExtensionResults: z.record(z.unknown()).default({}),
  response: z.object({
    clientDataJSON: base64url,
    attestationObject: base64url,
    transports: z.array(z.string()).optional(),
    authenticatorData: base64url.optional(),
    publicKey: base64url.optional(),
    publicKeyAlgorithm: z.number().optional(),
  }).passthrough(),
}).passthrough();

export const authenticationResponseSchema = z.object({
  id: base64url,
  rawId: base64url,
  type: z.literal('public-key'),
  authenticatorAttachment: z.string().optional(),
  clientExtensionResults: z.record(z.unknown()).default({}),
  response: z.object({
    clientDataJSON: base64url,
    authenticatorData: base64url,
    signature: base64url,
    userHandle: base64url.optional(),
  }).passthrough(),
}).passthrough();
