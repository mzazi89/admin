// MZAZI API — consistent JSON error envelope
// { status: false, creator: 'MZAZI TECH', error: 'CODE', message: '...' }
import { CREATOR } from './constants';

const ERROR_MAP = {
  MISSING_API_KEY: { statusCode: 401, message: 'API key is required.' },
  INVALID_API_KEY: { statusCode: 401, message: 'The provided API key is invalid.' },
  REVOKED_API_KEY: { statusCode: 401, message: 'This API key has been revoked.' },
  EXPIRED_API_KEY: { statusCode: 401, message: 'This API key has expired.' },
  USER_SUSPENDED: { statusCode: 403, message: 'Your account has been suspended.' },
  USER_BANNED: { statusCode: 403, message: 'Your account has been banned.' },
  MISSING_QUERY: { statusCode: 400, message: 'The query parameter is required.' },
  QUERY_TOO_LONG: { statusCode: 400, message: 'The query parameter is too long.' },
  MISSING_PARAMETER: { statusCode: 400, message: 'A required parameter is missing.' },
  INVALID_PARAMETER: { statusCode: 400, message: 'One or more parameters are invalid.' },
  RATE_LIMITED: { statusCode: 429, message: 'Rate limit exceeded. Please try again later.' },
  ENDPOINT_DISABLED: { statusCode: 404, message: 'This endpoint is not available.' },
  ENDPOINT_NOT_FOUND: { statusCode: 404, message: 'The requested endpoint does not exist.' },
  DATABASE_ERROR: { statusCode: 500, message: 'A database error occurred.' },
  PROVIDER_NOT_CONFIGURED: { statusCode: 500, message: 'Provider is not configured. Missing environment variable.' },
  PROVIDER_ERROR: { statusCode: 502, message: 'The upstream provider returned an error.' },
  PROVIDER_TIMEOUT: { statusCode: 504, message: 'The upstream provider timed out.' },
  INTERNAL_ERROR: { statusCode: 500, message: 'An unexpected error occurred. Please try again later.' },
  UNAUTHORIZED: { statusCode: 401, message: 'Authentication required.' },
  FORBIDDEN: { statusCode: 403, message: 'You do not have permission to perform this action.' },
};

export class ApiError extends Error {
  constructor(code, extra = {}) {
    const def = ERROR_MAP[code] || ERROR_MAP.INTERNAL_ERROR;
    super(def.message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = def.statusCode;
    this.message = def.message;
    Object.assign(this, extra);
  }
}

export function apiErrorBody(code, messageOverride) {
  const def = ERROR_MAP[code] || ERROR_MAP.INTERNAL_ERROR;
  return {
    status: false,
    creator: CREATOR,
    error: code,
    message: messageOverride || def.message,
  };
}

export function errorStatus(code) {
  const def = ERROR_MAP[code] || ERROR_MAP.INTERNAL_ERROR;
  return def.statusCode;
}
