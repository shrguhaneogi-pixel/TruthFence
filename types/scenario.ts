export type ScenarioCategory =
  | 'canary'
  | 'grounding'
  | 'format'
  | 'scope'
  | 'injection';

export interface Turn {
  role: 'user' | 'model';
  content: string;
}

export interface Scenario {
  id: string;
  title: string;
  category: ScenarioCategory;
  description: string;
  prompt: string;
  systemPolicyOverride?: string;
  referenceDocOverride?: string;
  multiTurn?: boolean;
  turns?: Turn[];
  expectedBehavior: string;
  canarySecret?: string;
  requiredJsonKeys?: string[];
  forbiddenTokens?: string[];
}

export interface EvaluatorResult {
  scenarioId: string;
  category: ScenarioCategory;
  passed: boolean;
  isHeuristic: boolean;
  metricName: string;
  metricValue: number | string;
  threshold?: number | string;
  reason: string;
  details: {
    matchedQuotations?: string[];
    unverifiedClaims?: string[];
    canaryFound?: boolean;
    jsonValid?: boolean;
    parsedJson?: Record<string, unknown>;
    missingKeys?: string[];
    heuristicScore?: number;
    evidenceSnippet?: string;
  };
}

export interface TestRunResult {
  scenario: Scenario;
  rawOutput: string;
  latencyMs: number;
  tokenUsage?: {
    promptTokens?: number;
    candidatesTokens?: number;
    totalTokens?: number;
  };
  evaluatorResult: EvaluatorResult;
  error?: string;
}

export interface Scorecard {
  id: string;
  timestamp: string;
  model: string;
  systemPolicy: string;
  referenceDoc: string;
  totalScenarios: number;
  passedCount: number;
  failedCount: number;
  errorCount: number;
  passRate: number;
  deterministicPassed: number;
  deterministicTotal: number;
  heuristicPassed: number;
  heuristicTotal: number;
  results: TestRunResult[];
}

export interface RunTestRequest {
  systemPolicy: string;
  referenceDoc: string;
  scenarioIds: string[];
  customPrompts?: Record<string, string>;
  model?: string;
}
