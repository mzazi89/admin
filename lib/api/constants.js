// MZAZI API — platform constants
export const CREATOR = 'MZAZI TECH';
export const SERVICE_NAME = 'MZAZI API';
export const VERSION = '1.0.0';
export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://mzazi.shop';

// Plan definitions (limits are seeded into api_settings and admin-editable;
// these are only the fallback defaults)
export const PLANS = {
  FREE: { label: 'Free', dailyLimit: 100 },
  PREMIUM: { label: 'Premium', dailyLimit: 10000 },
  BUSINESS: { label: 'Business', dailyLimit: 100000 },
  ADMIN: { label: 'Admin', dailyLimit: -1 }, // -1 = unlimited
};

export const ENDPOINT_CATEGORIES = ['DOWNLOAD', 'SEARCH', 'AI', 'SOCIAL', 'MEDIA', 'TOOLS', 'UTILITY'];

// Keys
export const API_KEY_PREFIX = 'mzazi_';
export const API_KEY_LENGTH = 24; // random bytes
export const REQUEST_ID_PREFIX = 'mz_req_';
export const REQUEST_ID_LENGTH = 9; // random bytes

// Limits
export const MAX_QUERY_LENGTH = 300;
export const PROVIDER_TIMEOUT_MS = 15000;
export const MAX_KEYS_PER_USER = 25;
