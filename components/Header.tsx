'use client';

import React from 'react';
import {
  ShieldCheck,
  Cpu,
  History,
  Play,
  Loader2,
  KeyRound,
  AlertTriangle,
} from 'lucide-react';
import { SUPPORTED_MODELS } from '@/lib/inference';

interface HeaderProps {
  selectedModel: string;
  onSelectModel: (model: string) => void;
  isRunning: boolean;
  onRunTests: () => void;
  selectedScenariosCount: number;
  hasApiKey: boolean | null;
  historyCount: number;
  onToggleHistory: () => void;
}

export function Header({
  selectedModel,
  onSelectModel,
  isRunning,
  onRunTests,
  selectedScenariosCount,
  hasApiKey,
  historyCount,
  onToggleHistory,
}: HeaderProps) {
  return (
    <header className="border-b border-fence-border bg-fence-dark/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Brand & Tagline */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-sm shadow-cyan-500/20">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                TruthFence AI
              </h1>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                Workbench v1.0
              </span>
            </div>
            <p className="text-xs text-slate-400 italic tracking-wide">
              &quot;Don&apos;t trust the response. Test the evidence.&quot;
            </p>
          </div>
        </div>

        {/* Controls & Status Bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* API Key Status Indicator */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-mono transition-colors ${
              hasApiKey === true
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : hasApiKey === false
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                  : 'border-slate-700 bg-slate-800 text-slate-400'
            }`}
            title={
              hasApiKey === true
                ? 'GEMINI_API_KEY is configured in the environment'
                : 'GEMINI_API_KEY is missing. Add it to .env.local'
            }
          >
            {hasApiKey === true ? (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="hidden sm:inline">Gemini API:</span> Connected
              </>
            ) : hasApiKey === false ? (
              <>
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                <span className="hidden sm:inline">Gemini API:</span> Key Required
              </>
            ) : (
              <>
                <KeyRound className="h-3.5 w-3.5" />
                <span>Checking...</span>
              </>
            )}
          </div>

          {/* Model Selector */}
          <div className="flex items-center gap-1.5 bg-fence-surface border border-fence-border rounded-md px-2.5 py-1.5 text-xs">
            <Cpu className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
            <label htmlFor="model-select" className="text-slate-400 font-mono hidden sm:inline">
              Model:
            </label>
            <select
              id="model-select"
              value={selectedModel}
              onChange={(e) => onSelectModel(e.target.value)}
              className="bg-transparent text-slate-200 font-mono text-xs focus:outline-none cursor-pointer"
            >
              {SUPPORTED_MODELS.map((m) => (
                <option key={m.id} value={m.id} className="bg-fence-dark text-slate-200">
                  {m.id} {m.default ? '(Gemma 4 Default)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* History Toggle */}
          <button
            type="button"
            onClick={onToggleHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-fence-border bg-fence-surface hover:bg-slate-800 text-slate-300 text-xs font-mono transition-colors"
            aria-label="View test history"
          >
            <History className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            <span className="hidden sm:inline">History</span>
            {historyCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 font-bold text-[10px]">
                {historyCount}
              </span>
            )}
          </button>

          {/* Run Tests Primary Action */}
          <button
            type="button"
            onClick={onRunTests}
            disabled={isRunning || selectedScenariosCount === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-xs tracking-wider uppercase transition-all shadow-md shadow-cyan-500/20"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Auditing Gemma 4...</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-slate-950" aria-hidden="true" />
                <span>
                  Run Tests ({selectedScenariosCount})
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
