import { prisma } from '../config/prisma';
import {
  acousticClaimKey,
  acousticSessionKey,
  acousticTokenKey,
  redis,
} from '../config/redis';
import { env } from '../config/env';
import {
  acousticTokenDigest,
  generateAcousticToken,
  generateUuidV4,
  normalizeAcousticToken,
} from '../utils/crypto';
import { Errors } from '../utils/AppError';

interface AcousticSessionState {
  sessionId: string;
  tokenDigest: string;
  generationId: string;
  issuedAt: number;
  expiresAt: number;
}

interface AcousticReverseState {
  sessionId: string;
  generationId: string;
  issuedAt: number;
  expiresAt: number;
}

export interface AcousticTokenIssue {
  token: string;
  generationId: string;
  issuedAt: number;
  expiresAt: number;
  refreshAfterMs: number;
}

export interface ResolvedAcousticToken extends AcousticReverseState {
  tokenDigest: string;
}

const TOKEN_KEY_PREFIX = 'attendance:acoustic:token:';
const MAX_COLLISION_RETRIES = 5;

// Reserving the reverse lookup and swapping the session pointer in one Lua
// script prevents two app instances from publishing different live tokens.
const ROTATE_TOKEN_SCRIPT = `
if redis.call('EXISTS', KEYS[2]) == 1 then
  return 0
end
local oldRaw = redis.call('GET', KEYS[1])
if oldRaw then
  local old = cjson.decode(oldRaw)
  redis.call('DEL', ARGV[4] .. old.tokenDigest)
end
redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[3])
redis.call('SET', KEYS[2], ARGV[2], 'PX', ARGV[3])
return 1
`;

const REVOKE_TOKEN_SCRIPT = `
local currentRaw = redis.call('GET', KEYS[1])
if not currentRaw then
  return 0
end
local current = cjson.decode(currentRaw)
redis.call('DEL', ARGV[1] .. current.tokenDigest)
redis.call('DEL', KEYS[1])
return 1
`;

// Re-checks both token directions and establishes a per-student claim in one
// atomic operation. Rotation/revocation cannot slip between validation and claim.
const CLAIM_TOKEN_SCRIPT = `
local reverseRaw = redis.call('GET', KEYS[1])
local sessionRaw = redis.call('GET', KEYS[2])
if not reverseRaw or not sessionRaw then
  return 0
end
local reverse = cjson.decode(reverseRaw)
local session = cjson.decode(sessionRaw)
if session.tokenDigest ~= ARGV[1]
  or session.sessionId ~= ARGV[2]
  or reverse.sessionId ~= ARGV[2]
  or reverse.generationId ~= session.generationId
  or tonumber(session.expiresAt) < tonumber(ARGV[3]) then
  return 0
end
local claimed = redis.call('SET', KEYS[3], session.generationId, 'NX', 'PX', ARGV[4])
if claimed then
  return 1
end
return 0
`;

export async function issueAcousticToken(
  sessionId: string,
  facultyId: string
): Promise<AcousticTokenIssue> {
  const session = await prisma.attendanceSession.findUnique({ where: { sessionId } });
  if (!session) throw Errors.SESSION_NOT_FOUND();
  if (session.facultyId !== facultyId) throw Errors.SESSION_ACCESS_DENIED();
  if (session.status !== 'ACTIVE') throw Errors.SESSION_NOT_ACTIVE();

  const ttlMs = env.ACOUSTIC_TOKEN_TTL_SECONDS * 1000;
  for (let attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt += 1) {
    const token = generateAcousticToken();
    const tokenDigest = acousticTokenDigest(token);
    const issuedAt = Date.now();
    const expiresAt = issuedAt + ttlMs;
    const generationId = generateUuidV4();
    const sessionState: AcousticSessionState = {
      sessionId,
      tokenDigest,
      generationId,
      issuedAt,
      expiresAt,
    };
    const reverseState: AcousticReverseState = { sessionId, generationId, issuedAt, expiresAt };

    const rotated = await redis.eval(
      ROTATE_TOKEN_SCRIPT,
      2,
      acousticSessionKey(sessionId),
      acousticTokenKey(tokenDigest),
      JSON.stringify(sessionState),
      JSON.stringify(reverseState),
      ttlMs.toString(),
      TOKEN_KEY_PREFIX
    );

    if (rotated === 1) {
      return {
        token,
        generationId,
        issuedAt,
        expiresAt,
        refreshAfterMs: Math.max(1000, ttlMs - 5000),
      };
    }
  }

  throw Errors.ACOUSTIC_TOKEN_ISSUE_FAILED();
}

export async function revokeAcousticToken(sessionId: string): Promise<boolean> {
  const revoked = await redis.eval(
    REVOKE_TOKEN_SCRIPT,
    1,
    acousticSessionKey(sessionId),
    TOKEN_KEY_PREFIX
  );
  return revoked === 1;
}

export async function stopAcousticToken(sessionId: string, facultyId: string): Promise<boolean> {
  const session = await prisma.attendanceSession.findUnique({ where: { sessionId } });
  if (!session) throw Errors.SESSION_NOT_FOUND();
  if (session.facultyId !== facultyId) throw Errors.SESSION_ACCESS_DENIED();
  return revokeAcousticToken(sessionId);
}

export async function resolveAcousticToken(token: string): Promise<ResolvedAcousticToken> {
  const normalized = normalizeAcousticToken(token);
  const tokenDigest = acousticTokenDigest(normalized);
  const raw = await redis.get(acousticTokenKey(tokenDigest));
  if (!raw) throw Errors.ACOUSTIC_TOKEN_INVALID();

  try {
    const state = JSON.parse(raw) as AcousticReverseState;
    if (
      typeof state.sessionId !== 'string' ||
      typeof state.generationId !== 'string' ||
      !Number.isFinite(state.issuedAt) ||
      !Number.isFinite(state.expiresAt) ||
      Date.now() > state.expiresAt
    ) {
      throw Errors.ACOUSTIC_TOKEN_INVALID();
    }
    return { ...state, tokenDigest };
  } catch {
    throw Errors.ACOUSTIC_TOKEN_INVALID();
  }
}

export async function claimAcousticToken(
  token: ResolvedAcousticToken,
  studentId: string
): Promise<boolean> {
  const now = Date.now();
  const remainingMs = Math.max(1000, token.expiresAt - now);
  const claimed = await redis.eval(
    CLAIM_TOKEN_SCRIPT,
    3,
    acousticTokenKey(token.tokenDigest),
    acousticSessionKey(token.sessionId),
    acousticClaimKey(token.sessionId, studentId),
    token.tokenDigest,
    token.sessionId,
    now.toString(),
    remainingMs.toString()
  );
  return claimed === 1;
}
