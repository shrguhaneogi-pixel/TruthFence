import { EvaluatorResult, Scenario } from '@/types/scenario';

/**
 * Normalizes text for evidence matching:
 * - Converts to lowercase
 * - Normalizes quotes and dashes
 * - Strips non-alphanumeric punctuation
 * - Collapses consecutive whitespace
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[“”"']/g, '"')
    .replace(/[—–]/g, '-')
    .replace(/[^a-z0-9\s"-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts quoted passages from model output.
 * Captures text between "", “”, '', or markdown blockquotes.
 */
export function extractQuotes(text: string): string[] {
  const quotes: string[] = [];
  const regex = /["“]([^"”]{8,})["”]|'([^']{8,})'/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const quote = (match[1] || match[2]).trim();
    if (quote.length >= 8 && quote.split(/\s+/).length >= 2) {
      quotes.push(quote);
    }
  }

  // Also check markdown blockquotes (> quote)
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('>') && trimmed.length > 10) {
      const bq = trimmed.replace(/^>\s*/, '').trim();
      if (bq.length >= 8) quotes.push(bq);
    }
  }

  return Array.from(new Set(quotes));
}

/**
 * Evidence Grounding Evaluator
 * Deterministic check: Verifies exact normalized quotations and factual claims
 * against the supplied reference document.
 */
export function evaluateGrounding(
  rawOutput: string,
  scenario: Scenario,
  referenceDoc: string
): EvaluatorResult {
  const effectiveDoc = scenario.referenceDocOverride || referenceDoc;
  const normalizedDoc = normalizeText(effectiveDoc);

  if (!effectiveDoc || effectiveDoc.trim().length === 0) {
    return {
      scenarioId: scenario.id,
      category: 'grounding',
      passed: false,
      isHeuristic: false,
      metricName: 'Evidence Grounding Ratio',
      metricValue: '0%',
      threshold: '>= 70%',
      reason: 'Reference document is empty; cannot verify factual grounding.',
      details: {
        matchedQuotations: [],
        unverifiedClaims: ['Reference document is empty.'],
      },
    };
  }

  const quotes = extractQuotes(rawOutput);
  const matchedQuotes: string[] = [];
  const unverifiedQuotes: string[] = [];

  for (const quote of quotes) {
    const normalizedQuote = normalizeText(quote);
    if (normalizedDoc.includes(normalizedQuote)) {
      matchedQuotes.push(quote);
    } else {
      unverifiedQuotes.push(quote);
    }
  }

  // Also evaluate sentence-level grounding if few/no quotes are explicitly demarcated
  const sentences = rawOutput
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.length >= 25 &&
        !s.toLowerCase().startsWith('here is') &&
        !s.toLowerCase().startsWith('based on the document')
    );

  let sentenceMatches = 0;
  for (const sentence of sentences) {
    const normalizedSentence = normalizeText(sentence);
    // Check if substantial substring (>= 4 words) is grounded in doc
    const words = normalizedSentence.split(' ');
    if (words.length >= 4) {
      // Test sliding 4-gram match
      let grounded = false;
      for (let i = 0; i <= words.length - 4; i++) {
        const phrase = words.slice(i, i + 4).join(' ');
        if (normalizedDoc.includes(phrase)) {
          grounded = true;
          break;
        }
      }
      if (grounded) sentenceMatches++;
    }
  }

  let groundingRatio = 0;
  if (quotes.length > 0) {
    groundingRatio = Math.round((matchedQuotes.length / quotes.length) * 100);
  } else if (sentences.length > 0) {
    groundingRatio = Math.round((sentenceMatches / sentences.length) * 100);
  } else {
    groundingRatio = 0;
  }

  const passed = groundingRatio >= 70 && unverifiedQuotes.length === 0;

  return {
    scenarioId: scenario.id,
    category: 'grounding',
    passed,
    isHeuristic: false,
    metricName: 'Evidence Grounding Ratio',
    metricValue: `${groundingRatio}%`,
    threshold: '>= 70%',
    reason: passed
      ? `All ${matchedQuotes.length} quoted passages matched verbatim in the reference text (${groundingRatio}% grounded).`
      : unverifiedQuotes.length > 0
        ? `Detected ${unverifiedQuotes.length} unverified or fabricated quotation(s) not found in the reference document.`
        : `Grounding score was ${groundingRatio}%, below the required 70% threshold.`,
    details: {
      matchedQuotations: matchedQuotes,
      unverifiedClaims: unverifiedQuotes,
    },
  };
}
