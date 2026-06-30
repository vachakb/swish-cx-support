import type { MockHandlers } from '../llm';
import type { VisionScore } from '../types';
import type { KnowledgeAnswer } from './knowledge';
import type { ResolveDecision } from './resolve';
import type { WismoDecision } from './wismo';
import { detectLanguage, detectSentiment, ruleIntent, tailIntent } from './router';
import type { RouteResult } from './types';

function mockIssueLabel(text: string): string {
  if (/spill|leak|soak/i.test(text)) return 'the spillage';
  if (/missing|only got|didn'?t|short/i.test(text)) return 'the missing item';
  if (/wrong|incorrect/i.test(text)) return 'the wrong item';
  if (/damag|broke|crush|smash/i.test(text)) return 'the damage';
  return 'the issue';
}

function mockVisionIssue(text: string): VisionScore['issueType'] {
  if (/spill|leak|soak/i.test(text)) return 'spillage';
  if (/missing|only got|didn'?t/i.test(text)) return 'missing_item';
  if (/wrong|incorrect/i.test(text)) return 'wrong_item';
  if (/damag|broke|crush|smash/i.test(text)) return 'damaged';
  return 'unclear';
}


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
      // Deterministic stand-in for the grounded knowledge agent (the real reasoning is Gemini's).
      knowledge: (req): KnowledgeAnswer => {
        const q = (req.prompt.match(/Customer's question: "([^"]*)"/)?.[1] ?? req.prompt).toLowerCase();
        if (/koramangala|indiranagar|hsr/.test(q)) return { reply: 'Yes — we deliver there! Go ahead and order. 💚', needsFollowup: false };
        if (/delhi|mumbai|kolkata|chennai|hyderabad|pune|ahmedabad|jaipur|noida|gurgaon|goa/.test(q)) {
          return { reply: "We're not live there yet — Swish runs across parts of Bengaluru today, and we're expanding fast. I can note your interest so you hear when we launch! 💚", needsFollowup: false };
        }
        if (/deliver|available|serviceable|\barea\b/.test(q)) return { reply: 'Swish is live across parts of Bengaluru. Which area are you in, and I\'ll confirm we deliver there?', needsFollowup: true };
        if (/refer|reward|invite/.test(q)) return { reply: "Your referral rewards show up in your Swish wallet — you've got ₹50 on the way once a friend's first order is delivered. Share code SWISHER150 to earn more!", needsFollowup: false };
        return { reply: 'Happy to help! Could you tell me a little more about what you need?', needsFollowup: false };
      },
      // Heuristic stand-in for the resolution agent: ask once when there's no evidence,
      // then propose a modest partial credit. (The real intelligence is Gemini's.)
      resolve: (req): ResolveDecision => {
        const t = req.prompt;
        const latest = t.match(/Latest customer message: "([^"]*)"/)?.[1] ?? t;
        const hasPhoto = /attached a photo/i.test(t) && !/No photo attached/i.test(t);
        const askedBefore = /\nassistant:/i.test(t);
        const detailed = latest.length > 35 || latest.includes(':'); // chip-composed intake messages are already specific
        const issue = mockIssueLabel(latest);
        const conduct = /misconduct|misbehav|rude|abusiv|harass|unsafe|threat|conduct|delivery (partner|executive|agent|boy)/i.test(latest);
        if (conduct) {
          if (!askedBefore) {
            return { sentiment: 'angry', diagnosis: 'delivery-partner conduct report', needMoreInfo: true, reply: "I'm really sorry — that's not acceptable and I take it seriously. Could you tell me exactly what happened (and roughly when), so I can pass the full picture to our safety team?", suggestions: [], remedy: 'none', amountPaise: 0, reason: 'conduct report' };
          }
          return { sentiment: 'angry', diagnosis: 'delivery-partner conduct report', needMoreInfo: false, reply: "Thank you for telling me. I've escalated this to our safety team with everything you've shared — they'll review it and follow up, and you won't have to repeat anything.", suggestions: [], remedy: 'escalate', amountPaise: 0, reason: 'conduct report' };
        }
        // Minor / subjective taste gripe → empathy + kitchen feedback, never money or a (pointless) photo ask.
        if (/(too )?(bitter|bland|salty|sweet|spicy|mild)\b|watery/i.test(latest)) {
          return { sentiment: 'negative', diagnosis: `minor quality note: ${issue}`, needMoreInfo: false, reply: "I'm sorry it wasn't quite right! I'll pass that straight to our kitchen so they can fine-tune it — thanks for the honest feedback. 💚", suggestions: [], remedy: 'none', amountPaise: 0, reason: 'minor quality feedback' };
        }
        if (!hasPhoto && !askedBefore && !detailed) {
          return {
            sentiment: 'negative',
            diagnosis: `Reported ${issue}`,
            needMoreInfo: true,
            reply: "I'm really sorry to hear that. So I can make this right, could you tell me which item was affected and what exactly went wrong?",
            suggestions: [],
            remedy: 'none',
            amountPaise: 0,
            reason: issue,
          };
        }
        return {
          sentiment: 'negative',
          diagnosis: `${issue} confirmed`,
          needMoreInfo: false,
          reply: `Thanks for the details — I'm sorry about ${issue}. I'm arranging a credit to make up for it right now.`,
          suggestions: [],
          remedy: 'credit',
          amountPaise: 6000,
          reason: issue,
        };
      },
      // WISMO stand-in: honest when the ETA is reliable, transparent + investigative when it isn't.
      wismo: (req): WismoDecision => {
        const t = req.prompt;
        const reliable = !/UNRELIABLE/.test(t);
        const severe = /Severity: severe/i.test(t);
        if (reliable) {
          const m = t.match(/about (\d+) minute/);
          return { reply: `Your order's on its way — about ${m?.[1] ?? 'a few'} minutes out. It's running a touch behind but moving; I'm keeping a close eye on it!`, escalate: false };
        }
        return {
          reply: "I'm sorry — I can't get a reliable live update from the rider right now, so I won't guess a time. It's running behind, and I'm checking with both the rider and the kitchen to get it moving. You can track it live in the app, and I'll message you the moment it's on the way.",
          escalate: severe,
        };
      },
    },
  };
}
