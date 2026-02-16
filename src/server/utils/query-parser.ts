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
 * Normalize Express query object (which can include ParsedQs nested objects)
 * to plain object (string | undefined) that Zod can safely parse
 */
export function normalizeQuery(query: Record<string, any>): Record<string, string | undefined> {
  const normalized: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(query)) {
    // Handle string, string[], or undefined; ignore nested objects
    if (typeof value === 'string') {
      normalized[key] = value;
    } else if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
      normalized[key] = value[0];
    } else {
      normalized[key] = undefined;
    }
  }
  return normalized;
}
