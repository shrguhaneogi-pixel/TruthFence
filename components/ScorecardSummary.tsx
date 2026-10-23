'use client';

import React from 'react';
import {
  CheckCircle2,
  XCircle,
  FileDown,
  Layers,
  Sparkles,
  Clock,
  Cpu,
} from 'lucide-react';
import { Scorecard } from '@/types/scenario';
import {
  exportScorecardAsJson,
  exportScorecardAsMarkdown,
} from '@/lib/export';

interface ScorecardSummaryProps {
  scorecard: Scorecard;
}

export function ScorecardSummary({ scorecard }: ScorecardSummaryProps) {
  const isAllPassed = scorecard.passedCount === scorecard.totalScenarios;

  return (
    <div className="bg-fence-dark border border-fence-border rounded-xl p-5 shadow-lg shadow-black/40 space-y-4">
      {/* Top Banner: Verdict & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-fence-border/70">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight text-white">
              Adversarial Audit Scorecard
            </h2>
            <span
              className={`text-xs font-mono font-bold px-2 py-0.5 rounded border uppercase flex items-center gap-1 ${
                isAllPassed
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
              }`}
            >
              {isAllPassed ? (
                <>
                  <CheckCircle2 className="h-3 w-3" />
                  <span>ALL CHECKS PASSED</span>
                </>
              ) : (
                <>
                  <XCircle className="h-3 w-3" />
                  <span>VULNERABILITIES DETECTED</span>
                </>
              )}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-slate-400 mt-1">
            <span className="flex items-center gap-1">
              <Cpu className="h-3.5 w-3.5 text-cyan-400" />
              <span>{scorecard.model}</span>
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-slate-500" />
              <span>{new Date(scorecard.timestamp).toLocaleTimeString()}</span>
            </span>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportScorecardAsJson(scorecard)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-fence-border bg-fence-surface hover:bg-slate-800 text-slate-300 text-xs font-mono transition-colors"
            title="Download audit results as JSON"
          >
            <FileDown className="h-3.5 w-3.5 text-cyan-400" />
            <span>Export JSON</span>
          </button>
          <button
            type="button"
            onClick={() => exportScorecardAsMarkdown(scorecard)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-mono transition-colors"
            title="Download audit report as Markdown"
          >
            <FileDown className="h-3.5 w-3.5 text-cyan-400" />
            <span>Export Markdown</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Pass Rate */}
        <div className="p-3.5 rounded-lg bg-fence-surface/70 border border-fence-border flex flex-col justify-between">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
            Overall Pass Rate
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span
              className={`text-2xl font-bold font-mono ${
                scorecard.passRate >= 80
                  ? 'text-emerald-400'
                  : scorecard.passRate >= 50
                    ? 'text-amber-400'
                    : 'text-rose-400'
              }`}
            >
              {scorecard.passRate}%
            </span>
            <span className="text-xs font-mono text-slate-500">
              ({scorecard.passedCount}/{scorecard.totalScenarios})
            </span>
          </div>
        </div>

        {/* Passed & Failed Count */}
        <div className="p-3.5 rounded-lg bg-fence-surface/70 border border-fence-border flex flex-col justify-between">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
            Checks Passed / Failed
          </span>
          <div className="flex items-center gap-3 mt-1 font-mono text-xs">
            <span className="flex items-center gap-1 text-emerald-400 font-bold">
              <CheckCircle2 className="h-4 w-4" />
              <span>{scorecard.passedCount} Passed</span>
            </span>
            <span className="flex items-center gap-1 text-rose-400 font-bold">
              <XCircle className="h-4 w-4" />
              <span>{scorecard.failedCount} Failed</span>
            </span>
          </div>
        </div>

        {/* Deterministic Checks */}
        <div className="p-3.5 rounded-lg bg-fence-surface/70 border border-fence-border flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
              Deterministic
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded border border-cyan-500/30 text-cyan-300 bg-cyan-500/10">
              EXACT
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-1 font-mono">
            <span className="text-xl font-bold text-slate-200">
              {scorecard.deterministicPassed} / {scorecard.deterministicTotal}
            </span>
            <span className="text-xs text-slate-500">passed</span>
          </div>
        </div>

        {/* Heuristic Checks */}
        <div className="p-3.5 rounded-lg bg-fence-surface/70 border border-fence-border flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
              Heuristic
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded border border-purple-500/30 text-purple-300 bg-purple-500/10">
              HEURISTIC
            </span>
          </div>
          <div className="flex items-baseline gap-1 mt-1 font-mono">
            <span className="text-xl font-bold text-slate-200">
              {scorecard.heuristicPassed} / {scorecard.heuristicTotal}
            </span>
            <span className="text-xs text-slate-500">passed</span>
          </div>
        </div>
      </div>
    </div>
  );
}
