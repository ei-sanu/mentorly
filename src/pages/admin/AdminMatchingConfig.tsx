'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sliders, RefreshCw, AlertCircle, Save, RotateCcw } from 'lucide-react';
import { adminService } from '@/services/api';
import { useRoleGuard } from '@/lib/use-role-guard';
import { PageHeader, PageLoader } from '@/components/dashboard/page-primitives';

const DEFAULT_WEIGHTS = {
  semanticSimilarity: 35,
  careerGoal: 20,
  expertise: 15,
  industry: 10,
  targetRole: 10,
  availability: 10,
};

const LABELS: Record<string, string> = {
  semanticSimilarity: 'Semantic Similarity (AI)',
  careerGoal: 'Career Goal Match',
  expertise: 'Expertise Match',
  industry: 'Industry Match',
  targetRole: 'Target Role Match',
  availability: 'Availability Match',
};

export default function AdminMatchingConfigPage() {
  const { allowed } = useRoleGuard(['ADMIN']);
  const [weights, setWeights] = useState<Record<string, number>>(DEFAULT_WEIGHTS);
  const [original, setOriginal] = useState<Record<string, number>>(DEFAULT_WEIGHTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getMatchingConfig();
      const w = (data && (data.value || data.weights || data)) as Record<string, number>;
      if (w && typeof w === 'object') {
        const merged = { ...DEFAULT_WEIGHTS, ...w };
        setWeights(merged);
        setOriginal(merged);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load matching configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allowed) load();
  }, [allowed]);

  if (!allowed) return <PageLoader message="Verifying access…" />;

  const total = Object.values(weights).reduce((acc, v) => acc + (Number(v) || 0), 0);
  const dirty = JSON.stringify(weights) !== JSON.stringify(original);

  const handleChange = (key: string, value: string) => {
    const n = parseInt(value, 10);
    setWeights((prev) => ({ ...prev, [key]: isNaN(n) ? 0 : Math.max(0, Math.min(100, n)) }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      await adminService.updateMatchingConfig(weights);
      setOriginal(weights);
      setSuccess('Matching configuration saved successfully.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save configuration.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => setWeights(original);
  const handleDefaults = () => setWeights(DEFAULT_WEIGHTS);

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="AI Matching Configuration"
        description="Tune the weight of each signal in the mentor–mentee matching engine."
        icon={Sliders}
        actions={
          <>
            <Button variant="outline" onClick={load} size="sm" className="rounded-xl">
              <RefreshCw className="h-4 w-4 mr-2" /> Reload
            </Button>
            <Button onClick={handleSave} disabled={!dirty || saving} className="bg-lpu-orange hover:bg-lpu-orange/95 text-white rounded-xl" size="sm">
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </>
        }
      />

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {success && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-emerald-700">
              <span className="text-sm">{success}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <PageLoader message="Loading configuration…" />
      ) : (
        <Card>
          <CardHeader className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
            <div>
              <CardTitle>Match Weights</CardTitle>
              <CardDescription>Total weight: {total} (100 recommended)</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleReset} disabled={!dirty} className="rounded-xl">
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset
              </Button>
              <Button variant="outline" size="sm" onClick={handleDefaults} className="rounded-xl">
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Restore Defaults
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.keys(weights).map((key) => (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">{LABELS[key] || key}</label>
                  <Badge variant="outline" className="font-mono">{weights[key]}</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={weights[key]}
                    onChange={(e) => handleChange(key, e.target.value)}
                    className="flex-1 accent-lpu-orange"
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={weights[key]}
                    onChange={(e) => handleChange(key, e.target.value)}
                    className="w-20 h-9 px-3 rounded-lg border border-lpu-border text-sm focus:ring-2 focus:ring-lpu-orange focus:outline-none"
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
