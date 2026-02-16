/**
 * Safe query parameter extraction
 * Express query params can be strings or string[] (if param passed multiple times)
 * This ensures we always get a single string or undefined
 */
export function getQueryParam(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value[0];
  }
  return undefined;
}

/**
 * Normalize Express query object (string | string[]) to plain object (string | undefined)
 * Zod can then safely parse it
 */
export function normalizeQuery(query: Record<string, string | string[] | undefined>): Record<string, string | undefined> {
  const normalized: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(query)) {
    normalized[key] = getQueryParam(value);
  }
  return normalized;
}
