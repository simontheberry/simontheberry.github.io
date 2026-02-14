'use client';

import { useState, useCallback } from 'react';
import { Search, Loader2, Building2, CheckCircle2, ArrowLeft, ArrowRight } from 'lucide-react';

interface BusinessData {
  name: string;
  abn: string;
  entityName: string;
  entityType: string;
  entityStatus: string;
  website: string;
  industry: string;
  isVerified: boolean;
}

interface AbrResult {
  abn: string;
  entityName: string;
  entityType: string;
  entityStatus: string;
  state: string;
  postcode: string;
}

interface Props {
  value: BusinessData;
  onChange: (data: BusinessData) => void;
  onBack: () => void;
  onNext: () => void;
}

export function BusinessLookup({ value, onChange, onBack, onNext }: Props) {
  const [searchQuery, setSearchQuery] = useState(value.name);
  const [searchResults, setSearchResults] = useState<AbrResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const searchBusiness = useCallback(async () => {
    if (searchQuery.length < 2) return;

    setIsSearching(true);
    setSearchError(null);

    try {
      const params = new URLSearchParams({ name: searchQuery });
      const response = await fetch(`/api/v1/businesses/search?${params}`);
      const data = await response.json();

      if (data.success && data.data?.results) {
        setSearchResults(data.data.results);
      } else {
        setSearchError('No results found. You can enter the details manually below.');
      }
    } catch {
      setSearchError('Search unavailable. Please enter details manually.');
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  function selectResult(result: AbrResult) {
    onChange({
      ...value,
      name: result.entityName,
      abn: result.abn,
      entityName: result.entityName,
      entityType: result.entityType,
      entityStatus: result.entityStatus,
      isVerified: true,
    });
    setSearchResults([]);
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gov-grey-900">
        Business Details
      </h2>
      <p className="mt-1 text-sm text-gov-grey-500">
        Search for the business by name. We will automatically fetch their
        registration details from the Australian Business Register.
      </p>

      {/* Search */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-gov-grey-700 mb-1">
          Business Name
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchBusiness()}
            className="input-field flex-1"
            placeholder="Enter business name..."
          />
          <button
            onClick={searchBusiness}
            disabled={isSearching || searchQuery.length < 2}
            className="btn-primary gap-1.5"
          >
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Search ABR
          </button>
        </div>
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-gov-grey-600 uppercase tracking-wide">
            Select a business
          </p>
          {searchResults.map((result) => (
            <button
              key={result.abn}
              onClick={() => selectResult(result)}
              className="w-full text-left rounded-lg border border-gov-grey-200 p-4 hover:border-gov-blue-300 hover:bg-gov-blue-50/30 transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gov-grey-900">{result.entityName}</p>
                  <p className="text-sm text-gov-grey-500">
                    ABN: {result.abn} &middot; {result.entityType}
                  </p>
                  <p className="text-xs text-gov-grey-400">
                    {result.state} {result.postcode} &middot; {result.entityStatus}
                  </p>
                </div>
                <Building2 className="h-5 w-5 text-gov-grey-300" />
              </div>
            </button>
          ))}
        </div>
      )}

      {searchError && (
        <p className="mt-3 text-sm text-gov-grey-500">{searchError}</p>
      )}

      {/* Verified Business Card */}
      {value.isVerified && (
        <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-5 w-5 text-gov-green" />
            <span className="font-medium text-gov-grey-900">Business Verified</span>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-gov-grey-500">Entity Name</dt>
              <dd className="font-medium">{value.entityName}</dd>
            </div>
            <div>
              <dt className="text-gov-grey-500">ABN</dt>
              <dd className="font-mono">{value.abn}</dd>
            </div>
            <div>
              <dt className="text-gov-grey-500">Type</dt>
              <dd>{value.entityType}</dd>
            </div>
            <div>
              <dt className="text-gov-grey-500">Status</dt>
              <dd>{value.entityStatus}</dd>
            </div>
          </dl>
        </div>
      )}

      {/* Manual Entry Fallback */}
      {!value.isVerified && (
        <div className="mt-6 space-y-4">
          <p className="text-xs text-gov-grey-500">
            Or enter details manually:
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gov-grey-700 mb-1">ABN</label>
              <input
                type="text"
                value={value.abn}
                onChange={(e) => onChange({ ...value, abn: e.target.value })}
                className="input-field"
                placeholder="XX XXX XXX XXX"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gov-grey-700 mb-1">Website</label>
              <input
                type="url"
                value={value.website}
                onChange={(e) => onChange({ ...value, website: e.target.value })}
                className="input-field"
                placeholder="https://..."
              />
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-8 flex justify-between">
        <button onClick={onBack} className="btn-secondary gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!value.name && !searchQuery}
          className="btn-primary gap-2"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
