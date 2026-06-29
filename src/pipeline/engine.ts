import type { LlmProvider } from '../llm';
import type { Providers } from '../providers/types';
import * as repo from '../repositories';
import type { Conversation } from '../repositories';
import { polish } from './compose';
import { checkInput, checkOutput } from './guardrails';
import { getHandler } from './handlers';
import { deriveTitle } from './lifecycle';
import { detectLanguage, detectSentiment, route, ruleIntent } from './router';
import { Tracer } from './tracer';
import type { HandlerResult, Intent, RouteResult, TurnContext, TurnInput, TurnResult } from './types';

// Mid-resolution, only these intents count as an explicit topic switch; everything else continues the flow.
const OVERRIDE_INTENTS = new Set<Intent>(['human', 'cancel_order', 'closing']);

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
  tracer.note('llm', { provider: deps.llm.name });

  const history = await repo.listMessages(conversation.id);
  // Continuity: if our last turn asked an order-issue clarifying question, keep a context-free
  // follow-up (e.g. "strawberry cake") in that flow instead of dropping it to the generic fallback.
  const lastBot = [...history].reverse().find((m) => m.role === 'assistant');
  const midResolution = (lastBot?.payload as { kind?: string } | null | undefined)?.kind === 'clarify';

  let routed: RouteResult;
  try {
    routed = await tracer.step('route', () => route(gate.text, deps.llm));
  } catch {
    // LLM routing failed — fall back to rules (or 'unknown') so we still respond gracefully.
    routed = { intent: ruleIntent(gate.text) ?? 'unknown', confidence: 0.3, sentiment: detectSentiment(gate.text), language: detectLanguage(gate.text) };
  }
  // While waiting on the answer to a clarifying question, keep the follow-up in the resolution flow —
  // only an explicit switch (human / cancel / done) breaks out. A reply like "the rider never showed"
  // must not get re-routed to order-status and lose the thread.
  if (midResolution && !OVERRIDE_INTENTS.has(routed.intent)) {
    if (routed.intent !== 'order_issue') tracer.note('continuity', { from: routed.intent, to: 'order_issue' });
    routed = { ...routed, intent: 'order_issue' };
  }

  const ctx: TurnContext = {
    input: { ...input, text: gate.text },
    conversation,
    history,
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
  // Polish is an extra model round-trip, so spend it only where natural language adds value —
  // order issues and escalations. Happy-path fact replies use their on-brand templates (instant).
  const wantsPolish = result.polish ?? (routed.intent === 'order_issue' || result.status === 'escalated');
  const composed = wantsPolish ? await tracer.step('compose', () => polish(deps.llm, result.reply)) : result.reply;
  const checked = checkOutput(composed);
  const reply = checked.ok ? checked.text : checkOutput(result.reply).ok ? result.reply : 'Let me connect you with a teammate to make sure this is handled properly.';

  const assistantMsg = await repo.addMessage({ conversationId: conversation.id, role: 'assistant', text: reply, payload: result.data ?? null, traceId: tracer.traceId });
  // 'closing' archives the thread; otherwise it follows the turn's status.
  const convStatus = routed.intent === 'closing' ? 'closed' : result.status;
  await repo.updateConversation(conversation.id, {
    status: convStatus,
    sentiment: routed.sentiment,
    subject: conversation.subject ?? deriveTitle(routed.intent, gate.text),
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
