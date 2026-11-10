/**
 * IPCA-Casa: Assinatura e Verificação de Tokens de Sessão (HMAC-SHA256)
 * Garante autenticidade das sessões via cookie HttpOnly (SameSite=None; Secure) ou Bearer header.
 */
import crypto from 'node:crypto';
import type { Request } from 'express';
import type { UserAccount } from '../types';

export const SESSION_COOKIE_NAME = 'ipca_session';
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

export interface SessionTokenPayload {
  sub: string;
  email: string;
  profileId: string;
  authProvider: 'local' | 'google';
  iat: number;
  exp: number;
}

declare global {
  var _ipcaEphemeralSecret: string | undefined;
}

function getSessionSecret(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured && configured.length >= 16) {
    return configured;
  }
  if (!global._ipcaEphemeralSecret) {
    global._ipcaEphemeralSecret = crypto.randomBytes(32).toString('hex');
  }
  return global._ipcaEphemeralSecret;
}

function toBase64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

export function signSessionToken(user: UserAccount): string {
  const now = Date.now();
  const payload: SessionTokenPayload = {
    sub: user.id,
    email: user.email,
    profileId: user.profileId,
    authProvider: user.authProvider === 'google' ? 'google' : 'local',
    iat: now,
    exp: now + TOKEN_TTL_MS,
  };

  const headerPart = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'IPCA' }));
  const payloadPart = toBase64Url(JSON.stringify(payload));
  const signingInput = `${headerPart}.${payloadPart}`;
  const signature = toBase64Url(
    crypto.createHmac('sha256', getSessionSecret()).update(signingInput).digest()
  );

  return `${signingInput}.${signature}`;
}

export function verifySessionToken(token: string | undefined | null): SessionTokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerPart, payloadPart, signaturePart] = parts;
  const signingInput = `${headerPart}.${payloadPart}`;
  const expectedSig = toBase64Url(
    crypto.createHmac('sha256', getSessionSecret()).update(signingInput).digest()
  );

  const sigBuf = Buffer.from(signaturePart);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const decoded = JSON.parse(fromBase64Url(payloadPart)) as SessionTokenPayload;
    if (!decoded.sub || !decoded.email || typeof decoded.exp !== 'number') {
      return null;
    }
    if (Date.now() > decoded.exp) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = decodeURIComponent(part.slice(0, idx).trim());
    const value = decodeURIComponent(part.slice(idx + 1).trim());
    result[key] = value;
  }
  return result;
}

export function extractRequestToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }

  const cookies = parseCookies(req.headers.cookie);
  if (cookies[SESSION_COOKIE_NAME]) {
    return cookies[SESSION_COOKIE_NAME];
  }

  return null;
}
