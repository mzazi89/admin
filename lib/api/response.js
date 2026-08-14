// MZAZI API — response helpers (envelope + rate-limit headers)
import { NextResponse } from 'next/server';
import { CREATOR, SERVICE_NAME, VERSION } from './constants';

export function successResponse(result, extra = {}, headers = {}) {
  return NextResponse.json(
    { status: true, creator: CREATOR, result },
    { headers }
  );
}

export function errorResponse(code, messageOverride, statusCode, headers = {}) {
  const body = {
    status: false,
    creator: CREATOR,
    error: code,
    message: messageOverride,
  };
  return NextResponse.json(body, { status: statusCode, headers });
}

export function rateLimitHeaders(limit, remaining, reset) {
  return {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(reset),
  };
}

export function healthBody() {
  return {
    status: true,
    creator: CREATOR,
    service: SERVICE_NAME,
    version: VERSION,
  };
}
