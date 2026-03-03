/**
 * usePublicConfig.ts — React hook for consuming public config.
 *
 * WHY THIS EXISTS:
 * Multiple components (Footer, Social page) need the same config data.
 * This hook encapsulates the fetch → validate → fallback logic and
 * exposes a simple { config, loading } tuple.
 *
 * HOW BACKEND PLUGS IN:
 * No changes needed here — once GET /api/public-config returns valid JSON,
 * the hook will automatically use live data instead of the fallback.
 *
 * LOADING / ERROR UX:
 * - `loading === true` while the fetch is in flight (show skeletons).
 * - `config` is NEVER null — it falls back to DEFAULT_PUBLIC_CONFIG
 *   so callers always have 6 social cards to render.
 */

import { useEffect, useState } from 'react';
import type { PublicConfig } from './publicConfig.types';
import { getPublicConfig, DEFAULT_PUBLIC_CONFIG } from './publicConfig';

interface UsePublicConfigReturn {
  /** Resolved config — always contains valid data (live or fallback). */
  config: PublicConfig;
  /** True while the initial fetch is in progress. */
  loading: boolean;
}

export function usePublicConfig(): UsePublicConfigReturn {
  const [config, setConfig] = useState<PublicConfig>(DEFAULT_PUBLIC_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    getPublicConfig().then((result) => {
      if (cancelled) return;

      // Use live config if valid, otherwise keep the default.
      if (result) {
        setConfig(result);
      }
      // Regardless of success/failure, we're done loading.
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { config, loading };
}
