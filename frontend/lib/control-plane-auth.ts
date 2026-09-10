import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';

export const CONTROL_PLANE_COOKIE = 'trace_control_plane';
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

type ControlPlaneToken = { exp: number };

function secret(): string {
  return process.env.TRACE_CONTROL_PLANE_SECRET || process.env.TRACE_SESSION_SECRET || 'trace-control-plane-dev-secret';
}

function sign(body: string): string {
  return createHmac('sha256', secret()).update(body).digest('base64url');
}

export function isControlPlaneConfigured(): boolean {
  return Boolean(process.env.TRACE_CONTROL_PLANE_PASSWORD?.trim());
}

export function verifyControlPlanePassword(password: string): boolean {
  const configured = process.env.TRACE_CONTROL_PLANE_PASSWORD;
  if (!configured || !password) return false;
  const expected = Buffer.from(configured);
  const actual = Buffer.from(password);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createControlPlaneToken(now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ exp: Math.floor(now / 1000) + MAX_AGE_SECONDS })).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function verifyControlPlaneToken(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const [body, signature] = token.split('.');
    if (!body || !signature || sign(body) !== signature) return false;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as ControlPlaneToken;
    return typeof payload.exp === 'number' && payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function isControlPlaneRequestAuthenticated(request: NextRequest): boolean {
  return verifyControlPlaneToken(request.cookies.get(CONTROL_PLANE_COOKIE)?.value);
}
