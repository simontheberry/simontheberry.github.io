'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../providers/AuthProvider';
import type { ApiResponse } from '@shared/types/api';

interface UseApiState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for making authenticated GET requests to the API.
 * Automatically includes the auth token and handles loading/error states.
 */
export function useApi<T>(url: string | null): UseApiState<T> & { refetch: () => void } {
  const { token, logout } = useAuth();
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    isLoading: !!url,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!url) {
      setState({ data: null, isLoading: false, error: null });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        headers,
        signal: controller.signal,
      });

      if (response.status === 401) {
        logout();
        return;
      }

      const result: ApiResponse<T> = await response.json();

      if (!controller.signal.aborted) {
        if (result.success) {
          setState({ data: result.data ?? null, isLoading: false, error: null });
        } else {
          setState({ data: null, isLoading: false, error: result.error?.message || 'Request failed' });
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (!controller.signal.aborted) {
        setState({
          data: null,
          isLoading: false,
          error: err instanceof Error ? err.message : 'An error occurred',
        });
      }
    }
  }, [url, token, logout]);

  useEffect(() => {
    fetchData();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchData]);

  return { ...state, refetch: fetchData };
}

/**
 * Helper for making authenticated POST/PATCH/DELETE requests.
 */
export function useApiMutation<TInput, TOutput = unknown>() {
  const { token, logout } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(
    async (url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: TInput): Promise<TOutput | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (response.status === 401) {
          logout();
          return null;
        }

        const result: ApiResponse<TOutput> = await response.json();

        if (result.success) {
          setIsLoading(false);
          return result.data ?? null;
        } else {
          setError(result.error?.message || 'Request failed');
          setIsLoading(false);
          return null;
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setIsLoading(false);
        return null;
      }
    },
    [token, logout],
  );

  return { mutate, isLoading, error };
}
