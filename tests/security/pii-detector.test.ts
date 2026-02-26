import { describe, it, expect } from 'vitest';
import { maskPii, containsPii, detectPiiTypes, maskObjectPii } from '../../src/server/utils/pii-detector';

describe('PII Detector', () => {
  describe('maskPii', () => {
    it('masks email addresses', () => {
      const input = 'Contact user@example.com for details';
      const result = maskPii(input);
      expect(result).toBe('Contact [EMAIL_REDACTED] for details');
      expect(result).not.toContain('user@example.com');
    });

    it('masks multiple email addresses', () => {
      const input = 'From: alice@test.com To: bob@gov.au';
      const result = maskPii(input);
      expect(result).not.toContain('alice@test.com');
      expect(result).not.toContain('bob@gov.au');
      expect(result).toContain('[EMAIL_REDACTED]');
    });

    it('masks Australian phone numbers', () => {
      const input = 'Call 0412345678 or 02 9876 5432';
      const result = maskPii(input);
      expect(result).not.toContain('0412345678');
      expect(result).toContain('[PHONE_REDACTED]');
    });

    it('masks international phone numbers', () => {
      const input = 'Call +61 412345678';
      const result = maskPii(input);
      expect(result).not.toContain('+61 412345678');
      expect(result).toContain('[PHONE_REDACTED]');
    });

    it('masks credit card numbers', () => {
      const input = 'Card: 4111 2222 3333 4444';
      const result = maskPii(input);
      expect(result).not.toContain('4111 2222 3333 4444');
      expect(result).toContain('[CARD_REDACTED]');
    });

    it('masks credit card numbers with dashes', () => {
      const input = 'Card: 4111-2222-3333-4444';
      const result = maskPii(input);
      expect(result).not.toContain('4111-2222-3333-4444');
      expect(result).toContain('[CARD_REDACTED]');
    });

    it('masks Australian TFN', () => {
      const input = 'TFN is 123 456 789';
      const result = maskPii(input);
      expect(result).not.toContain('123 456 789');
      expect(result).toContain('[TFN_REDACTED]');
    });

    it('masks street addresses', () => {
      const input = 'Lives at 42 Smith Street Melbourne';
      const result = maskPii(input);
      expect(result).not.toContain('42 Smith Street');
      expect(result).toContain('[ADDRESS_REDACTED]');
    });

    it('masks IP addresses', () => {
      const input = 'Request from 192.168.1.100';
      const result = maskPii(input);
      expect(result).not.toContain('192.168.1.100');
      expect(result).toContain('[IP_REDACTED]');
    });

    it('masks JWT tokens', () => {
      const token = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiIxMjMifQ.abc123_signature';
      const input = `Bearer ${token}`;
      const result = maskPii(input);
      expect(result).not.toContain('eyJ');
      expect(result).toContain('[TOKEN_REDACTED]');
    });

    it('masks multiple PII types in one string', () => {
      const input = 'User user@test.com at 192.168.0.1 called 0412345678';
      const result = maskPii(input);
      expect(result).not.toContain('user@test.com');
      expect(result).not.toContain('192.168.0.1');
      expect(result).not.toContain('0412345678');
      expect(result).toContain('[EMAIL_REDACTED]');
      expect(result).toContain('[IP_REDACTED]');
      expect(result).toContain('[PHONE_REDACTED]');
    });

    it('returns unchanged string when no PII present', () => {
      const input = 'Complaint about misleading advertising';
      const result = maskPii(input);
      expect(result).toBe(input);
    });

    it('handles empty string', () => {
      expect(maskPii('')).toBe('');
    });
  });

  describe('containsPii', () => {
    it('returns true when email is present', () => {
      expect(containsPii('Contact user@example.com')).toBe(true);
    });

    it('returns true when IP is present', () => {
      expect(containsPii('From 10.0.0.1')).toBe(true);
    });

    it('returns false when no PII is present', () => {
      expect(containsPii('Normal log message about complaint status')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(containsPii('')).toBe(false);
    });
  });

  describe('detectPiiTypes', () => {
    it('identifies email type', () => {
      const types = detectPiiTypes('user@example.com');
      expect(types).toContain('email');
    });

    it('identifies multiple types', () => {
      const types = detectPiiTypes('user@test.com from 192.168.1.1');
      expect(types).toContain('email');
      expect(types).toContain('ip_address');
    });

    it('returns empty array when no PII', () => {
      const types = detectPiiTypes('clean log message');
      expect(types).toHaveLength(0);
    });

    it('identifies street address type', () => {
      const types = detectPiiTypes('123 Main Road');
      expect(types).toContain('au_postcode_address');
    });
  });

  describe('maskObjectPii', () => {
    it('masks PII in string values of objects', () => {
      const obj = { email: 'user@test.com', action: 'login' };
      const result = maskObjectPii(obj) as Record<string, unknown>;
      expect(result.email).toBe('[EMAIL_REDACTED]');
      expect(result.action).toBe('login');
    });

    it('masks PII in nested objects', () => {
      const obj = { user: { contact: 'user@test.com' }, id: '123' };
      const result = maskObjectPii(obj) as Record<string, unknown>;
      const user = result.user as Record<string, unknown>;
      expect(user.contact).toBe('[EMAIL_REDACTED]');
    });

    it('masks PII in arrays', () => {
      const arr = ['user@test.com', 'clean string'];
      const result = maskObjectPii(arr) as string[];
      expect(result[0]).toBe('[EMAIL_REDACTED]');
      expect(result[1]).toBe('clean string');
    });

    it('handles null and undefined', () => {
      expect(maskObjectPii(null)).toBe(null);
      expect(maskObjectPii(undefined)).toBe(undefined);
    });

    it('handles numbers and booleans unchanged', () => {
      expect(maskObjectPii(42)).toBe(42);
      expect(maskObjectPii(true)).toBe(true);
    });
  });
});
