export type InputCheck = { ok: true; text: string } | { ok: false; reply: string };

const INJECTION = /\b(ignore (all |the )?(previous|prior|above)|disregard (previous|all)|system prompt|you are now|pretend to be)\b/gi;

// Garbage-in guard. Cheap, deterministic; runs before any model call.
export function checkInput(raw: string): InputCheck {
  const text = raw.trim();
  if (!text) return { ok: false, reply: 'Looks like that came through empty — what can I help you with?' };
  if (text.length > 2000) return { ok: false, reply: "That's quite long! Could you sum up the main issue in a line or two?" };

  const letters = (text.match(/[a-zA-Zऀ-ॿ]/g) ?? []).length;
  if (text.length >= 6 && letters === 0) {
    return { ok: false, reply: "I didn't quite catch that — could you tell me in words what you need help with?" };
  }
  // Strip prompt-injection attempts but keep helping with whatever else they said.
  const cleaned = text.replace(INJECTION, '').trim();
  return { ok: true, text: cleaned || text };
}

export type OutputCheck = { ok: true; text: string } | { ok: false; reason: string };

// Garbage-out guard. The handler's facts are already grounded; this catches empties and persona/provider leaks.
export function checkOutput(reply: string): OutputCheck {
  const text = reply.trim();
  if (!text) return { ok: false, reason: 'empty reply' };
  if (/\b(as an ai|language model|i am an ai|openai|gemini|gpt|claude)\b/i.test(text)) {
    return { ok: false, reason: 'persona/provider leak' };
  }
  return { ok: true, text };
}
