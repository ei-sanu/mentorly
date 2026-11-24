'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Target, Sliders, RefreshCw } from 'lucide-react';
import { useRoleGuard } from '@/lib/use-role-guard';
import { SectionLanding } from '@/components/dashboard/section-landing';
import { PageLoader } from '@/components/dashboard/page-primitives';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { adminService } from '@/services/api';

// Status polling, same pattern as OnboardingStatusPage: check once on
// mount, then every 60s, plus a manual Refresh. Never poll faster: each
// check costs the backend a full auth round plus an Ollama probe, which
// waits up to the configured timeout (15s) when Ollama is down.
const ENGINE_POLL_MS = 60_000;

// Shape of GET /admin/matching/llm-status (backend/src/admin/
// admin.routes.ts): { success: true, data: { model, baseUrl, enabled,
// reachable, timeoutMs } }. Rendered only from these fields — nothing
// else is displayed (no latency, no last-run: the endpoint reports
// neither).
type LlmStatus = {
  model: string;
  baseUrl?: string;
  enabled: boolean;
  reachable: boolean;
  timeoutMs?: number;
};

// Engine state, derived ONLY from what the endpoint reports. "Active"
// needs both: Ollama reachable AND ranking enabled.
//   active      — reachable && enabled
//   unavailable — endpoint answered, but Ollama is not responding
//   disabled    — Ollama responds, but LLM_RANKING_ENABLED=false
//   error       — the status call itself failed (endpoint missing,
//                 backend down / restart pending); the card says so
//                 instead of guessing.
// Loading (no answer yet) shows "Checking…" — never a fake Active.
type EngineState = 'active' | 'unavailable' | 'disabled' | 'error' | 'checking';

function EngineDot({ state }: { state: EngineState }) {
  if (state === 'active') {
    return (
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60"></span>
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
      </span>
    );
  }
  if (state === 'unavailable') {
    return <span className="h-2.5 w-2.5 rounded-full bg-red-500"></span>;
  }
  if (state === 'disabled') {
    return <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>;
  }
  if (state === 'checking') {
    return (
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neutral-400 opacity-60"></span>
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-neutral-400"></span>
      </span>
    );
  }
  return <span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-neutral-300"></span>;
}

export default function AdminMatchingLanding() {
  const { allowed } = useRoleGuard(['ADMIN']);
  const [llmStatus, setLlmStatus] = useState<LlmStatus | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // One logical engine check. `background` keeps the "Checking…" line
  // off for polls / manual refreshes (only the button spins).
  const checkEngine = useCallback(async (opts?: { background?: boolean }) => {
    if (opts?.background) setRefreshing(true);
    try {
      const res = await adminService.getLlmStatus();
      const s = (res && ((res as any).data || res)) as LlmStatus;
      if (s && typeof s === 'object' && typeof s.model === 'string') {
        setLlmStatus(s);
        setStatusError(false);
        setLastChecked(new Date());
      } else {
        setLlmStatus(null);
        setStatusError(true);
      }
    } catch {
      setLlmStatus(null);
      setStatusError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch ONCE on mount, only once the ADMIN guard has resolved. The
  // ref guard makes this one-shot even under StrictMode's double-invoke
  // (same pattern as OnboardingStatusPage's initial check) — the probe
  // can take up to the 15s Ollama timeout, so it must not double-fire.
  const initialCheckDone = useRef(false);
  useEffect(() => {
    if (!allowed || initialCheckDone.current) return;
    initialCheckDone.current = true;
    checkEngine();
  }, [allowed, checkEngine]);

  // Slow status poll (60s): picks up Ollama coming back (or going down)
  // without a manual refresh, without pressuring the backend.
  useEffect(() => {
    if (!allowed) return;
    const id = setInterval(() => {
      checkEngine({ background: true });
    }, ENGINE_POLL_MS);
    return () => clearInterval(id);
  }, [allowed, checkEngine]);

  if (!allowed) return <PageLoader message="Verifying access…" />;

  const engineState: EngineState = loading
    ? 'checking'
    : statusError || !llmStatus
      ? 'error'
      : !llmStatus.reachable
        ? 'unavailable'
        : !llmStatus.enabled
          ? 'disabled'
          : 'active';

  const engineWord =
    engineState === 'active'
      ? 'Active'
      : engineState === 'unavailable'
        ? 'Unavailable'
        : engineState === 'disabled'
          ? 'Disabled'
          : engineState === 'checking'
            ? 'Checking…'
            : 'Status unavailable';

  return (
    <SectionLanding
      title="AI Matching"
      description="Monitor and configure the AI-powered mentorship matching system."
      icon={Target}
      topContent={
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Mentorly AI Engine</CardTitle>
                <CardDescription>Local Ollama model used to re-rank and explain matches.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <EngineDot state={engineState} />
                <span className="text-sm font-medium text-neutral-900">{engineWord}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-lpu-text-secondary">Checking the AI engine…</p>
            ) : llmStatus ? (
              <div className="space-y-2 text-sm">
                {/* "Mentorly" is the engine's display name only — the model id
                    below is the real OLLAMA_MODEL / endpoint `model` value,
                    unchanged. */}
                <div className="flex items-start justify-between gap-4">
                  <span className="text-gray-700">Model</span>
                  <span className="text-right">
                    <span className="block text-sm font-medium text-neutral-900">Mentorly</span>
                    <span className="block font-mono text-xs text-gray-500">Model: {llmStatus.model}</span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">LLM ranking</span>
                  <Badge variant="outline">{llmStatus.enabled ? 'Enabled' : 'Disabled'}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Ollama</span>
                  <Badge variant="outline">{llmStatus.reachable ? 'Reachable' : 'Unreachable'}</Badge>
                </div>
                {llmStatus.baseUrl && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Server</span>
                    <span className="font-mono text-xs text-gray-500">{llmStatus.baseUrl}</span>
                  </div>
                )}
                {typeof llmStatus.timeoutMs === 'number' && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Timeout</span>
                    <span className="font-mono text-xs text-gray-500">{llmStatus.timeoutMs} ms</span>
                  </div>
                )}
                {engineState === 'unavailable' && (
                  <p className="text-xs text-lpu-text-secondary pt-1">Ollama is not responding — check that `ollama serve` is running.</p>
                )}
                {engineState === 'disabled' && (
                  <p className="text-xs text-lpu-text-secondary pt-1">LLM ranking is switched off (LLM_RANKING_ENABLED=false) — the deterministic scorer runs alone.</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-lpu-text-secondary">LLM status unavailable — the backend may need a restart after deploy.</p>
            )}

            <div className="flex items-center justify-between border-t border-neutral-200 pt-4 mt-4 text-left">
              <div className="text-xs leading-relaxed text-neutral-400">
                {lastChecked && (
                  <p>Last checked {lastChecked.toLocaleTimeString()}</p>
                )}
                <p>Refreshes automatically every minute.</p>
              </div>
              <Button
                onClick={() => checkEngine({ background: true })}
                disabled={refreshing || loading}
                variant="ghost"
                className="h-8 px-2 text-sm font-medium text-neutral-900 hover:bg-neutral-100"
              >
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Checking…' : 'Refresh'}
              </Button>
            </div>
          </CardContent>
        </Card>
      }
      children={[
        {
          title: 'Overview',
          description: 'See how the matching engine is performing across cohorts.',
          href: '/app/admin/matching/overview',
          icon: Target,
        },
        {
          title: 'Configuration',
          description: 'Tune weights, rules, and signals used by the matching algorithm.',
          href: '/app/admin/matching/config',
          icon: Sliders,
        },
      ]}
    />
  );
}
