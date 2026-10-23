'use client';

import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  AlertCircle,
  Play,
  RotateCcw,
  Sparkles,
  ExternalLink,
  ShieldAlert,
  Loader2,
  FileCheck2,
} from 'lucide-react';
import { Header } from '@/components/Header';
import { ConfigPanel } from '@/components/ConfigPanel';
import { ScorecardSummary } from '@/components/ScorecardSummary';
import { ScenarioResultCard } from '@/components/ScenarioResultCard';
import { HistoryDrawer } from '@/components/HistoryDrawer';
import {
  BUILTIN_SCENARIOS,
  DEFAULT_REFERENCE_DOC,
  DEFAULT_SYSTEM_POLICY,
} from '@/lib/scenarios';
import { DEFAULT_MODEL_ID } from '@/lib/inference';
import { Scorecard } from '@/types/scenario';

const STORAGE_KEY = 'truthfence_audit_history_v1';

export default function TruthFenceApp() {
  const [systemPolicy, setSystemPolicy] = useState<string>(DEFAULT_SYSTEM_POLICY);
  const [referenceDoc, setReferenceDoc] = useState<string>(DEFAULT_REFERENCE_DOC);
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<string[]>(
    BUILTIN_SCENARIOS.map((s) => s.id)
  );
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({});
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL_ID);

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [history, setHistory] = useState<Scorecard[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);

  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  // Check backend API key and model status on mount
  useEffect(() => {
    fetch('/api/status')
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.hasApiKey === 'boolean') {
          setHasApiKey(data.hasApiKey);
        }
      })
      .catch(() => {
        setHasApiKey(false);
      });

    // Load browser-local history
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setHistory(parsed);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Save history to localStorage
  const saveToHistory = (newRun: Scorecard) => {
    try {
      const updated = [newRun, ...history].slice(0, 20); // Keep last 20 runs
      setHistory(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage errors
    }
  };

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  };

  const handleResetDefaults = () => {
    setSystemPolicy(DEFAULT_SYSTEM_POLICY);
    setReferenceDoc(DEFAULT_REFERENCE_DOC);
    setSelectedScenarioIds(BUILTIN_SCENARIOS.map((s) => s.id));
    setCustomPrompts({});
    setBannerError(null);
  };

  const handleRunTests = async () => {
    if (selectedScenarioIds.length === 0) return;

    setIsRunning(true);
    setBannerError(null);

    try {
      const res = await fetch('/api/run-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPolicy,
          referenceDoc,
          scenarioIds: selectedScenarioIds,
          customPrompts,
          model: selectedModel,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Test execution failed on server.');
      }

      setScorecard(data.scorecard);
      saveToHistory(data.scorecard);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unknown error during test run';
      setBannerError(message);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-fence-darkest">
      {/* Top Header */}
      <Header
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        isRunning={isRunning}
        onRunTests={handleRunTests}
        selectedScenariosCount={selectedScenarioIds.length}
        hasApiKey={hasApiKey}
        historyCount={history.length}
        onToggleHistory={() => setIsHistoryOpen(true)}
      />

      {/* API Key Missing Notification Banner */}
      {hasApiKey === false && (
        <div className="bg-amber-950/40 border-b border-amber-500/30 px-4 py-2.5 text-xs text-amber-200">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0" />
              <span>
                <strong>GEMINI_API_KEY</strong> is not yet set in environment.
                To perform real inference with Gemma 4, create a{' '}
                <code className="bg-slate-900 px-1.5 py-0.5 rounded text-amber-300 font-mono">
                  .env.local
                </code>{' '}
                file with your Google AI Studio key or configure it in Vercel.
              </span>
            </div>
            <a
              href="https://aistudio.google.com/"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1 font-mono text-[11px] underline text-amber-400 hover:text-amber-300"
            >
              <span>Get Gemini Key</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}

      {/* Error Alert Banner */}
      {bannerError && (
        <div className="bg-rose-950/40 border-b border-rose-500/30 px-4 py-2.5 text-xs text-rose-200">
          <div className="max-w-7xl mx-auto flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-400 flex-shrink-0" />
            <span>
              <strong>Execution Halted:</strong> {bannerError}
            </span>
          </div>
        </div>
      )}

      {/* Main Workspace Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Configuration Drawer (5 cols on lg) */}
        <section className="lg:col-span-5 w-full space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <span>Test Configuration</span>
            </h2>
            <span className="text-[11px] font-mono text-cyan-400">
              Interactive Lab
            </span>
          </div>

          <ConfigPanel
            systemPolicy={systemPolicy}
            setSystemPolicy={setSystemPolicy}
            referenceDoc={referenceDoc}
            setReferenceDoc={setReferenceDoc}
            selectedScenarioIds={selectedScenarioIds}
            setSelectedScenarioIds={setSelectedScenarioIds}
            customPrompts={customPrompts}
            setCustomPrompts={setCustomPrompts}
            onResetDefaults={handleResetDefaults}
          />

          <div className="p-3.5 rounded-lg border border-fence-border/70 bg-fence-dark text-xs space-y-2">
            <div className="flex items-center gap-2 text-cyan-400 font-mono font-semibold">
              <FileCheck2 className="h-4 w-4" />
              <span>Evaluation Methodology</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              TruthFence separates checks into <strong>Deterministic</strong>{' '}
              (exact string token containment, JSON grammar validity, verbatim quotation grounding) and{' '}
              <strong>Heuristic</strong> (semantic boundary refusal patterns). All raw outputs are retained for full transparency.
            </p>
          </div>
        </section>

        {/* Right Column: Execution Output & Scorecard (7 cols on lg) */}
        <section className="lg:col-span-7 w-full space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <span>Workbench Output & Evidence</span>
            </h2>
            {scorecard && (
              <span className="text-[11px] font-mono text-slate-500">
                Run ID: {scorecard.id}
              </span>
            )}
          </div>

          {/* Running State */}
          {isRunning && (
            <div className="rounded-xl border border-cyan-500/40 bg-fence-dark p-8 text-center space-y-4 shadow-xl">
              <Loader2 className="h-10 w-10 text-cyan-400 animate-spin mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-100 font-mono tracking-wide">
                  DISPATCHING ADVERSARIAL AUDIT
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Executing test scenarios against Gemma 4 ({selectedModel}) via Gemini API...
                </p>
              </div>
              <div className="max-w-xs mx-auto h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-cyan-400 rounded-full animate-pulse w-3/4" />
              </div>
            </div>
          )}

          {/* Scorecard State */}
          {!isRunning && scorecard && (
            <div className="space-y-4">
              <ScorecardSummary scorecard={scorecard} />

              <div className="space-y-3">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                  Detailed Results ({scorecard.results.length})
                </h3>
                {scorecard.results.map((result) => (
                  <ScenarioResultCard
                    key={result.scenario.id}
                    result={result}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Initial / Empty State */}
          {!isRunning && !scorecard && (
            <div className="rounded-xl border border-fence-border bg-fence-dark p-8 text-center space-y-4 shadow-lg">
              <div className="h-14 w-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto">
                <ShieldCheck className="h-8 w-8" />
              </div>

              <div className="space-y-2 max-w-md mx-auto">
                <h3 className="text-base font-bold text-slate-100 tracking-tight">
                  Ready to Audit Gemma 4
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Configure your system policy and reference document on the left, then click{' '}
                  <strong className="text-cyan-300">Run Tests</strong> to dispatch the adversarial test suite.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-w-lg mx-auto text-left pt-2">
                <div className="p-3 rounded-lg border border-fence-border/70 bg-fence-surface/50 text-[11px] font-mono space-y-1">
                  <span className="text-rose-400 font-bold block">1. Canary Exfiltration</span>
                  <p className="text-slate-400">Scans for leaked internal credentials.</p>
                </div>
                <div className="p-3 rounded-lg border border-fence-border/70 bg-fence-surface/50 text-[11px] font-mono space-y-1">
                  <span className="text-amber-400 font-bold block">2. Indirect Injection</span>
                  <p className="text-slate-400">Tests attacks embedded in reference context.</p>
                </div>
                <div className="p-3 rounded-lg border border-fence-border/70 bg-fence-surface/50 text-[11px] font-mono space-y-1">
                  <span className="text-cyan-400 font-bold block">3. Evidence Grounding</span>
                  <p className="text-slate-400">Verifies verbatim quotation citations.</p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleRunTests}
                  className="px-5 py-2.5 rounded-md bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider font-mono shadow-lg shadow-cyan-500/20 transition-all inline-flex items-center gap-2"
                >
                  <Play className="h-3.5 w-3.5 fill-slate-950" />
                  <span>Start Audit Run</span>
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* History Slide-out Drawer */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelectRun={(run) => setScorecard(run)}
        onClearHistory={clearHistory}
      />

      {/* Footer */}
      <footer className="border-t border-fence-border/70 bg-fence-dark py-4 text-center text-xs font-mono text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>TruthFence AI &bull; &quot;Don&apos;t trust the response. Test the evidence.&quot;</span>
          <span>Open-source AI Reliability Workbench &bull; Powered by Gemma 4 &amp; Gemini API</span>
        </div>
      </footer>
    </div>
  );
}
