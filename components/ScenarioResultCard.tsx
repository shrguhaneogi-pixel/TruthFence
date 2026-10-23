'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Terminal,
  Clock,
  Quote,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { TestRunResult } from '@/types/scenario';

interface ScenarioResultCardProps {
  result: TestRunResult;
}

export function ScenarioResultCard({ result }: ScenarioResultCardProps) {
  const [isRawExpanded, setIsRawExpanded] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  const { scenario, rawOutput, latencyMs, tokenUsage, evaluatorResult, error } =
    result;
  const isPassed = evaluatorResult.passed;
  const isHeuristic = evaluatorResult.isHeuristic;

  const handleCopy = () => {
    navigator.clipboard.writeText(rawOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const categoryColor =
    scenario.category === 'canary'
      ? 'border-rose-500/30 text-rose-300 bg-rose-500/10'
      : scenario.category === 'injection'
        ? 'border-amber-500/30 text-amber-300 bg-amber-500/10'
        : scenario.category === 'grounding'
          ? 'border-cyan-500/30 text-cyan-300 bg-cyan-500/10'
          : scenario.category === 'scope'
            ? 'border-purple-500/30 text-purple-300 bg-purple-500/10'
            : 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10';

  return (
    <div
      className={`rounded-xl border transition-all overflow-hidden shadow-md shadow-black/30 ${
        isPassed
          ? 'border-emerald-500/30 bg-fence-dark'
          : error
            ? 'border-amber-500/30 bg-fence-dark'
            : 'border-rose-500/30 bg-fence-dark'
      }`}
    >
      {/* Header bar */}
      <div className="p-4 bg-fence-surface/50 border-b border-fence-border/70 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {/* Non-color-only status icon + text badge */}
          {error ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold border border-amber-500/40 bg-amber-500/10 text-amber-300">
              <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden="true" />
              <span>[ERROR]</span>
            </span>
          ) : isPassed ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold border border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              <span>[PASS]</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold border border-rose-500/40 bg-rose-500/10 text-rose-300">
              <XCircle className="h-4 w-4 text-rose-400" aria-hidden="true" />
              <span>[FAIL]</span>
            </span>
          )}

          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              {scenario.title}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={`text-[10px] font-mono uppercase px-2 py-0.2 rounded border ${categoryColor}`}
              >
                {scenario.category}
              </span>
              {isHeuristic && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded border border-purple-500/30 text-purple-300 bg-purple-500/10">
                  HEURISTIC EVALUATION
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Telemetry metadata */}
        <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
          <span className="flex items-center gap-1" title="Inference Latency">
            <Clock className="h-3.5 w-3.5 text-slate-500" />
            <span>{latencyMs}ms</span>
          </span>
          {tokenUsage?.totalTokens && (
            <span className="text-slate-500 hidden sm:inline">
              | {tokenUsage.totalTokens} tokens
            </span>
          )}
        </div>
      </div>

      {/* Evaluator Verdict & Details */}
      <div className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-fence-surface/40 border border-fence-border/70 text-xs">
          <div>
            <span className="text-slate-400 font-mono">Metric Evaluated: </span>
            <span className="font-mono font-semibold text-slate-200">
              {evaluatorResult.metricName}
            </span>
          </div>
          <div className="font-mono">
            <span className="text-slate-400">Result: </span>
            <span
              className={`font-bold ${
                isPassed ? 'text-emerald-300' : 'text-rose-300'
              }`}
            >
              {evaluatorResult.metricValue}
            </span>
            {evaluatorResult.threshold && (
              <span className="text-slate-500 ml-1.5">
                (Threshold: {evaluatorResult.threshold})
              </span>
            )}
          </div>
        </div>

        {/* Reason / Explanation */}
        <div className="text-xs text-slate-300 leading-relaxed">
          <span className="font-mono text-slate-500">Evaluator Rationale: </span>
          <span>{evaluatorResult.reason}</span>
        </div>

        {/* Evidence Grounding Breakdown */}
        {scenario.category === 'grounding' && (
          <div className="space-y-2 pt-1">
            {evaluatorResult.details.matchedQuotations &&
              evaluatorResult.details.matchedQuotations.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    <span>
                      Verified Exact Quotations ({evaluatorResult.details.matchedQuotations.length}):
                    </span>
                  </div>
                  <div className="space-y-1 pl-2 border-l-2 border-emerald-500/40">
                    {evaluatorResult.details.matchedQuotations.map((q, i) => (
                      <p
                        key={i}
                        className="text-xs font-mono text-emerald-200/90 italic bg-emerald-950/20 px-2 py-1 rounded"
                      >
                        &quot;{q}&quot;
                      </p>
                    ))}
                  </div>
                </div>
              )}

            {evaluatorResult.details.unverifiedClaims &&
              evaluatorResult.details.unverifiedClaims.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[11px] font-mono text-rose-400 flex items-center gap-1">
                    <XCircle className="h-3 w-3" />
                    <span>
                      Unverified / Hallucinated Quotes ({evaluatorResult.details.unverifiedClaims.length}):
                    </span>
                  </div>
                  <div className="space-y-1 pl-2 border-l-2 border-rose-500/40">
                    {evaluatorResult.details.unverifiedClaims.map((u, i) => (
                      <p
                        key={i}
                        className="text-xs font-mono text-rose-200/90 italic bg-rose-950/20 px-2 py-1 rounded"
                      >
                        &quot;{u}&quot;
                      </p>
                    ))}
                  </div>
                </div>
              )}
          </div>
        )}

        {/* Format Schema Breakdown */}
        {scenario.category === 'format' && evaluatorResult.details.missingKeys && (
          <div className="pt-1">
            {evaluatorResult.details.missingKeys.length > 0 ? (
              <div className="text-xs font-mono text-rose-400">
                Missing Required Schema Keys:{' '}
                {evaluatorResult.details.missingKeys.map((k) => `"${k}"`).join(', ')}
              </div>
            ) : (
              <div className="text-xs font-mono text-emerald-400">
                All required JSON schema keys were parsed and validated successfully.
              </div>
            )}
          </div>
        )}

        {/* Canary Leakage Notice */}
        {scenario.category === 'canary' && evaluatorResult.details.canaryFound && (
          <div className="p-2.5 rounded border border-rose-500/40 bg-rose-950/30 text-rose-300 text-xs font-mono flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-400 flex-shrink-0" />
            <span>
              CRITICAL: Model revealed secret canary credentials during audit!
            </span>
          </div>
        )}
      </div>

      {/* Raw Response Collapsible Inspector */}
      <div className="border-t border-fence-border/70 bg-slate-950/80">
        <div className="px-4 py-2 flex items-center justify-between text-xs font-mono text-slate-400 border-b border-fence-border/40">
          <button
            type="button"
            onClick={() => setIsRawExpanded(!isRawExpanded)}
            className="flex items-center gap-1.5 hover:text-slate-200 focus:outline-none"
          >
            <Terminal className="h-3.5 w-3.5 text-cyan-400" />
            <span>Raw Gemma 4 Response</span>
            {isRawExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 text-slate-400 hover:text-slate-200 focus:outline-none"
            aria-label="Copy raw output"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {isRawExpanded && (
          <div className="p-4 max-h-72 overflow-y-auto">
            <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap break-words leading-relaxed">
              {rawOutput || (error ? `[ERROR]: ${error}` : 'No output returned.')}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
