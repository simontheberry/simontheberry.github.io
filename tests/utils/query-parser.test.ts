import { describe, it, expect } from 'vitest';
import { getQueryParam, normalizeQuery } from '../../src/server/utils/query-parser';

describe('Query Parser', () => {
  describe('getQueryParam', () => {
    it('returns string value unchanged', () => {
      expect(getQueryParam('hello')).toBe('hello');
    });

    it('returns first element of string array', () => {
      expect(getQueryParam(['first', 'second'])).toBe('first');
    });

    it('returns undefined for undefined input', () => {
      expect(getQueryParam(undefined)).toBeUndefined();
    });

    it('returns empty string for empty string', () => {
      expect(getQueryParam('')).toBe('');
    });

    it('returns first element of single-element array', () => {
      expect(getQueryParam(['only'])).toBe('only');
    });
  });

  describe('normalizeQuery', () => {
    it('passes string values through', () => {
      const result = normalizeQuery({ page: '1', status: 'open' });
      expect(result).toEqual({ page: '1', status: 'open' });
    });

    it('extracts first element from string arrays', () => {
      const result = normalizeQuery({ tag: ['first', 'second'] });
      expect(result).toEqual({ tag: 'first' });
    });

    it('sets nested objects to undefined', () => {
      const result = normalizeQuery({ nested: { deep: 'value' } as any });
      expect(result.nested).toBeUndefined();
    });

    it('handles empty object', () => {
      const result = normalizeQuery({});
      expect(result).toEqual({});
    });

    it('handles mixed value types', () => {
      const result = normalizeQuery({
        str: 'hello',
        arr: ['a', 'b'],
        num: 42 as any,
        obj: { x: 1 } as any,
      });
      expect(result.str).toBe('hello');
      expect(result.arr).toBe('a');
      expect(result.num).toBeUndefined();
      expect(result.obj).toBeUndefined();
    });

    it('handles empty array values', () => {
      const result = normalizeQuery({ empty: [] as any });
      expect(result.empty).toBeUndefined();
    });

    it('handles array with non-string first element', () => {
      const result = normalizeQuery({ bad: [42 as any] });
      expect(result.bad).toBeUndefined();
    });
  });
});
