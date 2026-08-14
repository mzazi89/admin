// MZAZI API — shared endpoint pipeline
// request → registry → params → auth → rate limit → cache → provider
//        → normalize → log → usage → JSON response
import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { ApiError, apiErrorBody, errorStatus } from './errors';
import { authenticate } from './auth';
import { checkAndIncrement, finalizeUsage } from './rate-limit';
import { logRequest, newRequestId } from './logger';
import { corsHeaders, handleOptions, mergeHeaders } from './cors';
import { rateLimitHeaders, successResponse } from './response';
import { getEndpoint } from './endpoints';
import { getProvider } from '../providers';
import { cacheGet, cacheSet } from './cache';
import { getClientIp, getUserAgent, parseJsonBody } from './utils';
import { MAX_QUERY_LENGTH } from './constants';

const sql = neon(process.env.DATABASE_URL);

function isDatabaseError(e) {
  return e && typeof e.code === 'string' && /^(42|53|23|08|3D|57|40)/.test(e.code);
}

// Collect + validate parameters from the endpoint registry definition
async function collectParams(request, endpoint, method) {
  let params = {};
  const def = endpoint.parameters && typeof endpoint.parameters === 'object'
    ? endpoint.parameters
    : { required: [], optional: [] };
  const required = Array.isArray(def.required) ? def.required : [];
  const optional = Array.isArray(def.optional) ? def.optional : [];

  if (method === 'POST') {
    try {
      params = await parseJsonBody(request);
    } catch (e) {
      if (e.code === 'PAYLOAD_TOO_LARGE') {
        const err = new ApiError('INVALID_PARAMETER');
        err.message = 'Request body is too large.';
        throw err;
      }
      throw new ApiError('INVALID_PARAMETER');
    }
    if (!params || typeof params !== 'object') params = {};
  } else {
    const url = new URL(request.url);
    for (const p of [...required, ...optional]) {
      const v = url.searchParams.get(p.name || p);
      if (v !== null && v !== '') params[p.name || p] = v;
    }
  }

  for (const p of required) {
    const name = p.name || p;
    const value = params[name];
    if (value === undefined || value === null || value === '') {
      if (name === 'query') throw new ApiError('MISSING_QUERY');
      const err = new ApiError('MISSING_PARAMETER');
      err.message = `The "${name}" parameter is required.`;
      throw err;
    }
    if (typeof value === 'string' && value.length > MAX_QUERY_LENGTH) {
      const err = new ApiError('INVALID_PARAMETER');
      err.message = `The "${name}" parameter is too long.`;
      throw err;
    }
  }

  return params;
}

// Daily per-endpoint rollup (analytics)
async function finalizeEndpointUsage(endpointPath, category, { success, providerFailure, responseTimeMs }) {
  try {
    const date = new Date().toISOString().slice(0, 10);
    await sql`
      INSERT INTO endpoint_usage (endpoint, category, date, requests, success, failed, provider_failures, total_response_time_ms)
      VALUES (${endpointPath}, ${category || null}, ${date}::date, 1, ${success ? 1 : 0}, ${success ? 0 : 1}, ${providerFailure ? 1 : 0}, ${Math.round(responseTimeMs)})
      ON CONFLICT (endpoint, date)
      DO UPDATE SET
        requests = endpoint_usage.requests + 1,
        success = endpoint_usage.success + ${success ? 1 : 0},
        failed = endpoint_usage.failed + ${success ? 0 : 1},
        provider_failures = endpoint_usage.provider_failures + ${providerFailure ? 1 : 0},
        total_response_time_ms = endpoint_usage.total_response_time_ms + ${Math.round(responseTimeMs)}
    `;
  } catch {
    // analytics must never break responses
  }
}

export async function runEndpoint(request, endpointPath, method = 'GET') {
  const started = Date.now();
  const requestId = newRequestId();
  const cors = corsHeaders(request);
  const ip = getClientIp(request);
  const ua = getUserAgent(request);

  let endpoint = null;
  let identity = null;
  let rateInfo = null;
  let statusCode = 500;
  let errorCode = null;
  let providerName = null;
  let providerFailure = false;

  const buildErrorHeaders = () => {
    const extra = rateInfo && rateInfo.limit >= 0
      ? rateLimitHeaders(rateInfo.limit, rateInfo.remaining, rateInfo.reset)
      : {};
    return mergeHeaders(cors, extra);
  };

  try {
    // 1. Registry
    endpoint = await getEndpoint(endpointPath);
    if (!endpoint) throw new ApiError('ENDPOINT_NOT_FOUND');
    if (!endpoint.is_active) throw new ApiError('ENDPOINT_DISABLED');

    // 2. Params (validated against registry definition)
    const params = await collectParams(request, endpoint, method);

    // 3. Authentication (MZAZI API key — required on all data endpoints)
    identity = await authenticate(request);

    // 4. Rate limit
    rateInfo = await checkAndIncrement(identity.key.id, identity.user.id, identity.key.plan);

    // 5. Cache (GET, cacheable categories)
    let result = null;
    let fromCache = false;
    if (method === 'GET') {
      result = cacheGet(endpointPath, params, endpoint.category);
      fromCache = result !== null;
    }

    if (!fromCache) {
      // 6. Provider adapter
      providerName = endpoint.provider || null;
      const provider = getProvider(providerName);
      if (!provider || !provider.isConfigured()) throw new ApiError('PROVIDER_NOT_CONFIGURED');

      const { data } = await provider.call(endpoint.upstream, params, method);
      const drill = provider.drillPayload ? provider.drillPayload(data) : data;
      const normalizer = provider.normalizerFor ? provider.normalizerFor(endpoint.category) : (p) => p;
      result = normalizer(drill);

      if (method === 'GET') cacheSet(endpointPath, params, endpoint.category, result);
    }

    statusCode = 200;

    return successResponse(result, {}, mergeHeaders(cors, rateLimitHeaders(rateInfo.limit, rateInfo.remaining, rateInfo.reset)));
  } catch (e) {
    const err = e instanceof ApiError
      ? e
      : isDatabaseError(e)
        ? new ApiError('DATABASE_ERROR')
        : new ApiError('INTERNAL_ERROR');
    statusCode = err.statusCode;
    errorCode = err.code;
    providerFailure = ['PROVIDER_ERROR', 'PROVIDER_TIMEOUT', 'PROVIDER_NOT_CONFIGURED'].includes(err.code);

    if (!(e instanceof ApiError)) {
      console.error(`[mzazi-api] ${requestId} unhandled:`, e.message);
    }

    return NextResponse.json(apiErrorBody(err.code, err.message), {
      status: errorStatus(err.code),
      headers: buildErrorHeaders(),
    });
  } finally {
    const responseTimeMs = Date.now() - started;
    logRequest({
      requestId,
      userId: identity?.user?.id ?? null,
      apiKeyId: identity?.key?.id ?? null,
      endpoint: endpointPath,
      category: endpoint?.category ?? null,
      method,
      statusCode,
      responseTimeMs,
      provider: providerName,
      ip,
      userAgent: ua,
      errorCode,
    });
    if (identity && rateInfo) {
      finalizeUsage(identity.key.id, identity.user.id, {
        success: statusCode === 200,
        providerFailure,
        responseTimeMs,
      });
      finalizeEndpointUsage(endpointPath, endpoint?.category, {
        success: statusCode === 200,
        providerFailure,
        responseTimeMs,
      });
    }
  }
}
