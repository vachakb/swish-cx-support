import type { MockHandlers } from '../llm';
import { detectLanguage, detectSentiment, ruleIntent, tailIntent } from './router';
import type { RouteResult } from './types';

// Deterministic stand-ins for the LLM tasks, used for key-free runs and tests.
// The routing stand-in is keyword-based — it also serves as the "rules-only" bake-off baseline.
export function buildMockHandlers(): MockHandlers {
  return {
    json: {
      route: (req): RouteResult => {
        const text = req.prompt;
        return {
          intent: ruleIntent(text) ?? tailIntent(text),
          confidence: 0.8,
          sentiment: detectSentiment(text),
          language: detectLanguage(text),
        };
      },
    },
  };
}
