import { config } from '../config';
import { createGeminiLlm } from './gemini';
import { createMockLlm } from './mock';
import type { MockHandlers } from './mock';
import type { LlmProvider } from './types';

export function createLlm(mockHandlers?: MockHandlers): LlmProvider {
  if (config.llmProvider === 'gemini' && config.geminiApiKey) return createGeminiLlm(config.geminiApiKey);
  return createMockLlm(mockHandlers);
}

export { createMockLlm } from './mock';
export type { MockHandlers, JsonResponder, TextResponder } from './mock';
export type { ImageInput, LlmProvider, LlmRequest, ModelTier } from './types';
