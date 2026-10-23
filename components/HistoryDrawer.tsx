'use client';

import React from 'react';
import {
  X,
  History,
  Trash2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  Cpu,
} from 'lucide-react';
import { Scorecard } from '@/types/scenario';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: Scorecard[];
  onSelectRun: (run: Scorecard) => void;
  onClearHistory: () => void;
}

export function HistoryDrawer({
  isOpen,
  onClose,
  history,
  onSelectRun,
  onClearHistory,
}: HistoryDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-fence-dark border-l border-fence-border h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-fence-border flex items-center justify-between bg-fence-surface/60">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-cyan-400" />
            <h3 className="font-bold text-white text-sm">Audit Run History</h3>
            <span className="text-xs font-mono text-slate-400">
              ({history.length})
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none"
            aria-label="Close history drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {history.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs font-mono">
              <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>No audit sessions saved yet.</p>
              <p className="mt-1 text-[11px] text-slate-600">
                Run an adversarial test suite to record history.
              </p>
            </div>
          ) : (
            history.map((run) => (
              <div
                key={run.id}
                onClick={() => {
                  onSelectRun(run);
                  onClose();
                }}
                className="p-3 rounded-lg border border-fence-border bg-fence-surface/50 hover:bg-fence-surface hover:border-cyan-500/40 cursor-pointer transition-all space-y-2"
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-300 font-semibold">
                    {run.id}
                  </span>
                  <span
                    className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                      run.passRate >= 80
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {run.passRate}% PASS
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span className="flex items-center gap-1">
                    <Cpu className="h-3 w-3 text-cyan-400" />
                    <span>{run.model}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-slate-500" />
                    <span>{new Date(run.timestamp).toLocaleString()}</span>
                  </span>
                </div>

                <div className="text-[11px] font-mono text-slate-400 flex items-center gap-3 pt-1 border-t border-fence-border/40">
                  <span className="text-emerald-400">
                    {run.passedCount} passed
                  </span>
                  <span className="text-rose-400">
                    {run.failedCount} failed
                  </span>
                  <span className="text-slate-500 ml-auto flex items-center gap-1 text-[10px]">
                    Load Run &rarr;
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {history.length > 0 && (
          <div className="p-4 border-t border-fence-border bg-fence-surface/40 flex justify-between items-center">
            <span className="text-[11px] text-slate-500 font-mono">
              Saved in browser local storage
            </span>
            <button
              type="button"
              onClick={onClearHistory}
              className="flex items-center gap-1 text-xs font-mono text-rose-400 hover:text-rose-300 focus:outline-none"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear History</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
