import type { MockHandlers } from '../llm';
import type { VisionScore } from '../types';
import { detectLanguage, detectSentiment, ruleIntent, tailIntent } from './router';
import type { RouteResult } from './types';

function mockVisionIssue(text: string): VisionScore['issueType'] {
  if (/spill|leak|soak/i.test(text)) return 'spillage';
  if (/missing|only got|didn'?t/i.test(text)) return 'missing_item';
  if (/wrong|incorrect/i.test(text)) return 'wrong_item';
  if (/damag|broke|crush|smash/i.test(text)) return 'damaged';
  return 'unclear';
}

// Deterministic stand-ins for the LLM tasks, used for key-free runs and tests.
// Routing doubles as the "rules-only" bake-off baseline.
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
      vision: (req): VisionScore => ({
        issueType: mockVisionIssue(req.prompt),
        severity: 0.8,
        confidence: 0.75,
      }),
    },
  };
}
