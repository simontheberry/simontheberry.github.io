// ============================================================================
// Australian Business Register (ABR) Service
// ============================================================================

import { createLogger } from '../../utils/logger';
import { config } from '../../config';

const logger = createLogger('abr-service');

export interface AbrBusinessResult {
  abn: string;
  entityName: string;
  entityType: string;
  entityStatus: string;
  state: string;
  postcode: string;
}

export interface AbrSearchResponse {
  results: AbrBusinessResult[];
  totalResults: number;
}

const ABR_API_BASE = 'https://download.asic.gov.au/abrxmlsearch/ABRXMLSearch.asmx';

/**
 * Search for businesses in the Australian Business Register
 * Supports both ABN (11 digits) and business name searches
 */
export async function searchAbr(query: string): Promise<AbrSearchResponse> {
  const guid = config.ABR_API_GUID;

  if (!guid) {
    logger.warn('ABR_API_GUID not configured - business lookup unavailable');
    return { results: [], totalResults: 0 };
  }

  try {
    // ABR API expects XML for search
    // Support both ABN (11 digits) and name searches
    const isAbr = /^\d{11}$/.test(query);

    let xmlQuery: string;
    if (isAbr) {
      // ABN search
      xmlQuery = `
        <?xml version="1.0" encoding="UTF-8"?>
        <ABRSearchRequest>
          <searchByABN>
            <abn>${query}</abn>
            <includeHistoricalDetails>N</includeHistoricalDetails>
          </searchByABN>
          <authenticationGuid>${guid}</authenticationGuid>
        </ABRSearchRequest>
      `;
    } else {
      // Name search
      xmlQuery = `
        <?xml version="1.0" encoding="UTF-8"?>
        <ABRSearchRequest>
          <searchByName>
            <name>${escapeXml(query)}</name>
            <state>ALL</state>
            <postcode></postcode>
            <includeHistoricalDetails>N</includeHistoricalDetails>
          </searchByName>
          <authenticationGuid>${guid}</authenticationGuid>
        </ABRSearchRequest>
      `;
    }

    const response = await fetch(`${ABR_API_BASE}/SearchByABNv201605`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
      },
      body: xmlQuery,
    });

    if (!response.ok) {
      logger.warn('ABR API request failed', {
        status: response.status,
        query,
      });
      return { results: [], totalResults: 0 };
    }

    const xmlText = await response.text();
    const results = parseAbrResponse(xmlText);

    logger.info('ABR search completed', {
      query,
      resultCount: results.length,
    });

    return {
      results,
      totalResults: results.length,
    };
  } catch (error) {
    logger.error('ABR search error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      query,
    });
    return { results: [], totalResults: 0 };
  }
}

/**
 * Parse ABR XML response and extract business details
 */
function parseAbrResponse(xmlText: string): AbrBusinessResult[] {
  const results: AbrBusinessResult[] = [];

  try {
    // Simple XML parsing for ABR response
    // Look for AbnSearchItem elements
    const itemRegex = /<AbnSearchItem>([\s\S]*?)<\/AbnSearchItem>/g;
    let match;

    while ((match = itemRegex.exec(xmlText)) !== null) {
      const itemXml = match[1];

      const abn = extractXmlValue(itemXml, 'abn');
      const entityName = extractXmlValue(itemXml, 'entityName');
      const entityType = extractXmlValue(itemXml, 'entityType');
      const entityStatus = extractXmlValue(itemXml, 'entityStatus');
      const state = extractXmlValue(itemXml, 'state');
      const postcode = extractXmlValue(itemXml, 'postcode');

      if (abn && entityName) {
        results.push({
          abn,
          entityName,
          entityType,
          entityStatus,
          state,
          postcode,
        });
      }
    }
  } catch (error) {
    logger.error('ABR XML parsing error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  return results;
}

/**
 * Extract value from XML element
 */
function extractXmlValue(xml: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}>([^<]*)</${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Validate ABN format (11 digits)
 */
export function isValidAbr(abn: string): boolean {
  if (!/^\d{11}$/.test(abn)) {
    return false;
  }

  // ABN checksum validation (Luhn algorithm variant)
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  let sum = 0;

  for (let i = 0; i < 11; i++) {
    sum += parseInt(abn[i], 10) * weights[i];
  }

  return sum % 89 === 0;
}
