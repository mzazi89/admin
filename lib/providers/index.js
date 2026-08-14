// MZAZI API — provider registry
// Each provider module exports: { id, isConfigured, missingEnvVars, call, drillPayload, normalizerFor }
// Endpoints reference providers by name via the endpoint registry (endpoints table).
import * as davidcyril from './davidcyril';
import * as drexapp from './drexapp';

export const providers = {
  davidcyril,
  drexapp,
};

export function getProvider(name) {
  return providers[name] || null;
}

export function providerForEndpoint(endpoint) {
  if (!endpoint || !endpoint.provider) return null;
  return getProvider(endpoint.provider);
}

export function listProviders() {
  return Object.keys(providers).map(k => ({
    id: providers[k].id || k,
    configured: providers[k].isConfigured(),
    missingEnvVars: providers[k].missingEnvVars ? providers[k].missingEnvVars() : [],
  }));
}
