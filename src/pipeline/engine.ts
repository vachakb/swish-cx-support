import type { LlmProvider } from '../llm';
import type { Providers } from '../providers/types';
import * as repo from '../repositories';
import type { Conversation } from '../repositories';
import { polish } from './compose';
import { checkInput, checkOutput } from './guardrails';
import { getHandler } from './handlers';
import { route } from './router';
import { Tracer } from './tracer';
import type { HandlerResult, TurnContext, TurnInput, TurnResult } from './types';

export interface EngineDeps {
  llm: LlmProvider;
  providers: Providers;
}

async function loadOrCreate(input: TurnInput): Promise<Conversation> {
  if (input.conversationId) {
    const existing = await repo.getConversation(input.conversationId);
    if (existing) return existing;
  }
  return repo.createConversation({ channel: input.channel, customerId: input.customerId ?? null, orderId: input.orderId ?? null, status: 'bot' });
}

export async function runTurn(input: TurnInput, deps: EngineDeps): Promise<TurnResult> {
  const conversation = await loadOrCreate(input);
  await repo.addMessage({ conversationId: conversation.id, role: 'user', text: input.text });

  // Garbage-in guard runs before any model call.
  const gate = checkInput(input.text);
  if (!gate.ok) {
    await repo.addMessage({ conversationId: conversation.id, role: 'assistant', text: gate.reply });
    await repo.updateConversation(conversation.id, { status: 'awaiting_user' });
    return { conversationId: conversation.id, traceId: '', reply: gate.reply, status: 'awaiting_user', intent: 'unknown', sentiment: 'neutral', latencyMs: 0 };
  }

  const tracer = new Tracer(conversation.id);
  const routed = await tracer.step('route', () => route(gate.text, deps.llm));

  const ctx: TurnContext = {
    input: { ...input, text: gate.text },
    conversation,
    history: await repo.listMessages(conversation.id),
    route: routed,
    customerId: input.customerId ?? conversation.customerId ?? undefined,
    orderId: input.orderId ?? conversation.orderId ?? undefined,
  };

  const handler = getHandler(routed.intent);
  let result: HandlerResult;
  try {
    result = await tracer.step(`handle:${routed.intent}`, () => handler.handle(ctx, { llm: deps.llm, providers: deps.providers, tracer }));
  } catch {
    result = { reply: 'Something went wrong on my side — let me get a teammate to help you right away.', status: 'escalated', escalationReason: 'handler error' };
  }

  // Garbage-out guard. Polish may rephrase; if it leaks persona/provider, fall back to the grounded base reply.
  const polished = await tracer.step('compose', () => polish(deps.llm, result.reply));
  const checked = checkOutput(polished);
  const reply = checked.ok ? checked.text : checkOutput(result.reply).ok ? result.reply : 'Let me connect you with a teammate to make sure this is handled properly.';

  const assistantMsg = await repo.addMessage({ conversationId: conversation.id, role: 'assistant', text: reply, payload: result.data ?? null, traceId: tracer.traceId });
  await repo.updateConversation(conversation.id, {
    status: result.status,
    sentiment: routed.sentiment,
    customerId: ctx.customerId ?? null,
    orderId: ctx.orderId ?? null,
    escalationReason: result.status === 'escalated' ? result.escalationReason ?? null : null,
  });
  await tracer.finalize({ messageId: assistantMsg.id, intent: routed.intent, confidence: routed.confidence, sentiment: routed.sentiment });

  return {
    conversationId: conversation.id,
    traceId: tracer.traceId,
    reply,
    status: result.status,
    action: result.action,
    escalationReason: result.escalationReason,
    data: result.data,
    intent: routed.intent,
    sentiment: routed.sentiment,
    latencyMs: tracer.latencyMs,
  };
}
