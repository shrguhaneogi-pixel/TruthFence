import {
  EvaluatorResult,
  Scenario,
  Scorecard,
  TestRunResult,
} from '@/types/scenario';
import { evaluateCanary } from './canary';
import { evaluateFormat } from './format';
import { evaluateGrounding } from './grounding';
import { evaluateInjection } from './injection';
import { evaluateScope } from './scope';

export * from './canary';
export * from './format';
export * from './grounding';
export * from './injection';
export * from './scope';

/**
 * Dispatches evaluation to the scenario's corresponding evaluator engine.
 */
export function evaluateScenario(
  scenario: Scenario,
  rawOutput: string,
  referenceDoc: string,
  canarySecret?: string
): EvaluatorResult {
  switch (scenario.category) {
    case 'canary':
      return evaluateCanary(rawOutput, scenario, canarySecret);
    case 'grounding':
      return evaluateGrounding(rawOutput, scenario, referenceDoc);
    case 'format':
      return evaluateFormat(rawOutput, scenario);
    case 'scope':
      return evaluateScope(rawOutput, scenario);
    case 'injection':
      return evaluateInjection(rawOutput, scenario);
    default:
      return {
        scenarioId: scenario.id,
        category: scenario.category,
        passed: false,
        isHeuristic: false,
        metricName: 'Unknown Evaluator',
        metricValue: 'ERROR',
        reason: `No evaluator registered for category ${(scenario as Scenario).category}`,
        details: {},
      };
  }
}

/**
 * Computes an aggregated scorecard from scenario run results.
 */
export function computeScorecard(
  results: TestRunResult[],
  model: string,
  systemPolicy: string,
  referenceDoc: string
): Scorecard {
  const totalScenarios = results.length;
  let passedCount = 0;
  let failedCount = 0;
  let errorCount = 0;
  let deterministicPassed = 0;
  let deterministicTotal = 0;
  let heuristicPassed = 0;
  let heuristicTotal = 0;

  for (const r of results) {
    if (r.error) {
      errorCount++;
      failedCount++;
      continue;
    }

    if (r.evaluatorResult.isHeuristic) {
      heuristicTotal++;
      if (r.evaluatorResult.passed) {
        heuristicPassed++;
        passedCount++;
      } else {
        failedCount++;
      }
    } else {
      deterministicTotal++;
      if (r.evaluatorResult.passed) {
        deterministicPassed++;
        passedCount++;
      } else {
        failedCount++;
      }
    }
  }

  const passRate =
    totalScenarios > 0 ? Math.round((passedCount / totalScenarios) * 100) : 0;

  return {
    id: `run-${Date.now()}`,
    timestamp: new Date().toISOString(),
    model,
    systemPolicy,
    referenceDoc,
    totalScenarios,
    passedCount,
    failedCount,
    errorCount,
    passRate,
    deterministicPassed,
    deterministicTotal,
    heuristicPassed,
    heuristicTotal,
    results,
  };
}
