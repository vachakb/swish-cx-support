import type { LlmProvider } from '../llm';
import { SWISH_VOICE } from './voice';


export async function polish(llm: LlmProvider, baseReply: string, signal?: AbortSignal): Promise<string> {
  if (llm.name === 'mock') return baseReply;
  const prompt = `Rephrase this Swish support reply to sound warm, human, and concise (1-3 short sentences). Keep every fact — times, money, item names, policy — EXACTLY as written; add no new facts.\n\nReply: """${baseReply}"""`;
  try {
    const out = (await llm.generateText({ task: 'polish', tier: 'fast', system: SWISH_VOICE, prompt, signal })).trim();
    return out || baseReply;
  } catch {
    return baseReply;
  }
}
