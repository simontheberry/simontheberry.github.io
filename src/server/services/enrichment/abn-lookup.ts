// ============================================================================
// ABN Lookup Service
// Australian Business Register (ABR) integration
// ============================================================================

import { config } from '../../config';
import { createLogger } from '../../utils/logger';

const logger = createLogger('abn-lookup');

export interface AbnLookupResult {
  abn: string;
  entityName: string;
  entityType: string;
  entityStatus: string;
  entityStatusCode: string;
  isCurrentIndicator: boolean;
  businessNames: string[];
  state: string;
  postcode: string;
}

export interface AbnSearchResult {
  results: AbnLookupResult[];
  totalResults: number;
}

/**
 * ABN Lookup Service
 *
 * Integrates with the Australian Business Register (ABR) XML Search API.
 * Provides business entity lookup by ABN or name search.
 *
 * API Documentation: https://abr.business.gov.au/Documentation/WebServiceResponse
 *
 * Usage:
 *   const service = new AbnLookupService();
 *   const result = await service.lookupByAbn('12345678901');
 *   const results = await service.searchByName('Acme Corp');
 */
export class AbnLookupService {
  private guid: string;
  private baseUrl: string;

  constructor() {
    this.guid = config.ABR_API_GUID || '';
    this.baseUrl = config.ABR_API_URL;
  }

  /**
   * Look up a business by ABN.
   * Returns structured business entity details.
   */
  async lookupByAbn(abn: string): Promise<AbnLookupResult | null> {
    const cleanAbn = abn.replace(/\s/g, '');

    if (!this.isValidAbn(cleanAbn)) {
      throw new Error(`Invalid ABN format: ${abn}`);
    }

    try {
      // Use the ABR JSON API endpoint
      const url = new URL('https://abr.business.gov.au/json/AbnDetails.aspx');
      url.searchParams.set('abn', cleanAbn);
      url.searchParams.set('callback', '');
      url.searchParams.set('guid', this.guid);

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`ABR API returned ${response.status}`);
      }

      const text = await response.text();
      // ABR returns JSONP — strip callback wrapper
      const jsonStr = text.replace(/^callback\(/, '').replace(/\)$/, '');
      const data = JSON.parse(jsonStr);

      if (data.Message) {
        logger.warn('ABR API message', { message: data.Message, abn: cleanAbn });
        return null;
      }

      return this.mapAbrResponse(data);
    } catch (error) {
      logger.error('ABN lookup failed', { abn: cleanAbn, error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Search for businesses by name.
   * Returns a list of matching entities.
   */
  async searchByName(name: string, maxResults = 10): Promise<AbnSearchResult> {
    try {
      const url = new URL('https://abr.business.gov.au/json/MatchingNames.aspx');
      url.searchParams.set('name', name);
      url.searchParams.set('maxResults', String(maxResults));
      url.searchParams.set('callback', '');
      url.searchParams.set('guid', this.guid);

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`ABR API returned ${response.status}`);
      }

      const text = await response.text();
      const jsonStr = text.replace(/^callback\(/, '').replace(/\)$/, '');
      const data = JSON.parse(jsonStr);

      if (!data.Names || !Array.isArray(data.Names)) {
        return { results: [], totalResults: 0 };
      }

      const results: AbnLookupResult[] = data.Names.map((entry: Record<string, unknown>) => ({
        abn: entry.Abn as string || '',
        entityName: entry.Name as string || '',
        entityType: entry.Type as string || '',
        entityStatus: entry.IsCurrentIndicator === 'Y' ? 'Active' : 'Cancelled',
        entityStatusCode: entry.IsCurrentIndicator as string || '',
        isCurrentIndicator: entry.IsCurrentIndicator === 'Y',
        businessNames: [],
        state: entry.State as string || '',
        postcode: entry.Postcode as string || '',
      }));

      return {
        results,
        totalResults: results.length,
      };
    } catch (error) {
      logger.error('ABN name search failed', { name, error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Validate ABN format using the standard ABN checksum algorithm.
   */
  isValidAbn(abn: string): boolean {
    if (!/^\d{11}$/.test(abn)) return false;

    const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
    const digits = abn.split('').map(Number);

    // Subtract 1 from first digit
    digits[0] -= 1;

    const sum = digits.reduce((acc, digit, i) => acc + digit * weights[i], 0);
    return sum % 89 === 0;
  }

  private mapAbrResponse(data: Record<string, unknown>): AbnLookupResult {
    return {
      abn: data.Abn as string || '',
      entityName: data.EntityName as string || '',
      entityType: data.EntityTypeName as string || '',
      entityStatus: data.AbnStatus as string || '',
      entityStatusCode: data.AbnStatusEffectiveFrom as string || '',
      isCurrentIndicator: data.AbnStatus === 'Active',
      businessNames: Array.isArray(data.BusinessName)
        ? (data.BusinessName as string[])
        : data.BusinessName
          ? [data.BusinessName as string]
          : [],
      state: data.AddressState as string || '',
      postcode: data.AddressPostcode as string || '',
    };
  }
}
