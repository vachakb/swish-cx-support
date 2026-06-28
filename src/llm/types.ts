import type { ZodType } from 'zod';

export type ModelTier = 'fast' | 'smart' | 'vision';

export interface ImageInput {
  mimeType: string;
  dataBase64: string;
}

export interface LlmRequest {
  system?: string;
  prompt: string;
  tier?: ModelTier;
  task?: string; // hint the mock uses to pick a deterministic responder
  images?: ImageInput[];
  signal?: AbortSignal;
}

export interface LlmProvider {
  readonly name: string;
  generateJson<T>(req: LlmRequest & { schema: ZodType<T> }): Promise<T>;
  generateText(req: LlmRequest): Promise<string>;
}
