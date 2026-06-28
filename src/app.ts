import { createLlm } from './llm';
import { buildMockHandlers } from './pipeline/mock-llm';
import { runTurn } from './pipeline/engine';
import type { EngineDeps } from './pipeline/engine';
import type { TurnInput } from './pipeline/types';
import { providers } from './providers';

// Composition root: the mock LLM gets the pipeline's task responders; Gemini is used when a key is set.
const llm = createLlm(buildMockHandlers());
const deps: EngineDeps = { llm, providers };

export const engine = { run: (input: TurnInput) => runTurn(input, deps) };
export { llm, providers };
