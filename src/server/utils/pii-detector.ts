// ============================================================================
// PII Detection & Masking Utility
// Detects and masks personally identifiable information in strings.
// Used by the logging pipeline to ensure zero PII in log output.
// ============================================================================

const PII_PATTERNS: Array<{ name: string; pattern: RegExp; replacement: string }> = [
  {
    name: 'email',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: '[EMAIL_REDACTED]',
  },
  {
    name: 'phone_au',
    pattern: /(?:\+61|0)[2-478][\s-]?\d{4}[\s-]?\d{4}/g,
    replacement: '[PHONE_REDACTED]',
  },
  {
    name: 'phone_international',
    pattern: /\+\d{1,3}[\s-]?\d{6,14}/g,
    replacement: '[PHONE_REDACTED]',
  },
  {
    name: 'credit_card',
    pattern: /\b(?:\d{4}[\s-]?){3}\d{4}\b/g,
    replacement: '[CARD_REDACTED]',
  },
  {
    name: 'au_tfn',
    pattern: /\b\d{3}[\s-]?\d{3}[\s-]?\d{3}\b/g,
    replacement: '[TFN_REDACTED]',
  },
  {
    name: 'au_medicare',
    pattern: /\b\d{4}[\s-]?\d{5}[\s-]?\d{1}\b/g,
    replacement: '[MEDICARE_REDACTED]',
  },
  {
    name: 'au_postcode_address',
    pattern: /\d{1,5}\s+\w+\s+(?:street|st|road|rd|avenue|ave|drive|dr|boulevard|blvd|lane|ln|court|ct|place|pl|crescent|cres)\b/gi,
    replacement: '[ADDRESS_REDACTED]',
  },
  {
    name: 'ip_address',
    pattern: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
    replacement: '[IP_REDACTED]',
  },
  {
    name: 'jwt_token',
    pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
    replacement: '[TOKEN_REDACTED]',
  },
];

export function maskPii(input: string): string {
  let masked = input;
  for (const { pattern, replacement } of PII_PATTERNS) {
    masked = masked.replace(pattern, replacement);
  }
  return masked;
}

export function containsPii(input: string): boolean {
  for (const { pattern } of PII_PATTERNS) {
    // Reset regex state for global patterns
    pattern.lastIndex = 0;
    if (pattern.test(input)) {
      return true;
    }
  }
  return false;
}

export function detectPiiTypes(input: string): string[] {
  const detected: string[] = [];
  for (const { name, pattern } of PII_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(input)) {
      detected.push(name);
    }
  }
  return detected;
}

export function maskObjectPii(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return maskPii(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(maskObjectPii);
  }
  if (obj !== null && typeof obj === 'object') {
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      masked[key] = maskObjectPii(value);
    }
    return masked;
  }
  return obj;
}
