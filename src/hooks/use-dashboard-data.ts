'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { onDashboardUpdate } from '@/lib/dashboard-socket';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

async function getAuthToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  // Mock-auth dev shortcut — matches the pattern in services/api.ts.
  const mockEmail = localStorage.getItem('mock_user_email');
  if (mockEmail) {
    const activeRole = localStorage.getItem('active_role') || 'ADMIN';
    return `mock_token_${mockEmail}_role${activeRole}`;
  }

  const poll = async (elapsed = 0): Promise<string | null> => {
    const clerk = (window as any).Clerk;
    if (clerk?.session) {
      try {
        const token = await clerk.session.getToken();
        if (token) return token;
      } catch {
        // session exists but token not ready yet — fall through to retry
      }
    }
    if (elapsed >= 3000) return null;
    await new Promise((r) => setTimeout(r, 150));
    return poll(elapsed + 150);
  };

  return poll();
}

async function authedFetch<T>(path: string): Promise<T> {
  const token = await getAuthToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.message || json?.error?.message || `Request failed (${res.status})`);
  }
  return json as T;
}

interface QueryState<T> {
  path: string;
  data: T | null;
  error: string | null;
  at: Date;
}

export interface DashboardQueryState<T> {
  /** Data for the CURRENT path (null while the first load for this path is in flight). */
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refetch: () => void;
}

/**
 * Centralized dashboard data hook (no external data-fetching library installed).
 * - loading / success / error / empty states handled by consumers via `data`/`loading`
 * - `loading` is true only while the first load for the current path is in flight;
 *   refetches keep stale data visible (background refresh) and surface `refreshing`.
 * - optional real-time invalidation via Socket.IO `dashboard:update` events,
 *   filtered to the event types relevant to the caller.
 */
export function useDashboardData<T>(
  path: string | null,
  opts?: { listenFor?: string[] },
): DashboardQueryState<T> {
  const [state, setState] = useState<QueryState<T> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;

    authedFetch<T>(path)
      .then((data) => {
        if (cancelled) return;
        setState({ path, data, error: null, at: new Date() });
        setRefreshing(false);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setState({ path, data: null, error: err.message || 'Failed to load dashboard data.', at: new Date() });
        setRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [path, tick]);

  // Real-time updates — targeted refetch only for relevant event types
  const listenKey = opts?.listenFor?.join('|') ?? '';
  useEffect(() => {
    if (!path || !listenKey) return;
    const relevant = listenKey.split('|');
    return onDashboardUpdate((event) => {
      if (relevant.includes(event.type)) {
        setTick((t) => t + 1);
      }
    });
  }, [path, listenKey]);

  const refetch = useCallback(() => {
    setRefreshing(true);
    setTick((t) => t + 1);
  }, []);

  const matches = !!path && state?.path === path;

  return {
    data: matches ? state!.data : null,
    loading: !!path && !matches,
    refreshing: refreshing && !!path,
    error: matches ? state!.error : null,
    lastUpdated: matches ? state!.at : null,
    refetch,
  };
}
