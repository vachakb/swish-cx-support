import type { LlmProvider } from '../llm';
import type { Providers } from '../providers/types';
import * as repo from '../repositories';
import type { Conversation } from '../repositories';
import { polish } from './compose';
import { checkInput, checkOutput } from './guardrails';
import { getHandler } from './handlers';
import { deriveTitle } from './lifecycle';
import { meteredLlm } from './metered-llm';
import { detectLanguage, detectSentiment, route, ruleIntent } from './router';
import { Tracer } from './tracer';
import type { HandlerResult, Intent, RouteResult, TurnContext, TurnInput, TurnResult } from './types';

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
  // Persist the guided-intake transcript (chip selections) on the first turn so a reopened thread shows the full flow.
  if (input.intake?.length) {
    for (const b of input.intake) await repo.addMessage({ conversationId: conversation.id, role: b.role, text: b.text });
  } else {
    await repo.addMessage({ conversationId: conversation.id, role: 'user', text: input.text });
  }

  // Garbage-in guard runs before any model call.
  const gate = checkInput(input.text);
  if (!gate.ok) {
    await repo.addMessage({ conversationId: conversation.id, role: 'assistant', text: gate.reply });
    await repo.updateConversation(conversation.id, { status: 'awaiting_user' });
    return { conversationId: conversation.id, traceId: '', reply: gate.reply, status: 'awaiting_user', intent: 'unknown', sentiment: 'neutral', latencyMs: 0 };
  }

  const tracer = new Tracer(conversation.id);
  tracer.note('llm', { provider: deps.llm.name });
  // Every model call this turn records its model/tokens/cost into the trace, automatically.
  const llm = meteredLlm(deps.llm, tracer);

  const history = await repo.listMessages(conversation.id);
  // Dialogue state for "midflow intent switching": a clarifying turn marks itself with kind:'clarify'
  // and the flow it's awaiting. We hand that to the classifier so it can tell an answer to our question
  // from a fresh topic — and fall back to the flow only when the reply carries no clear intent.
  const lastBot = [...history].reverse().find((m) => m.role === 'assistant');
  const clarify = lastBot?.payload as { kind?: string; intent?: Intent } | null | undefined;
  const midResolution = clarify?.kind === 'clarify';
  const resumeIntent: Intent = clarify?.intent ?? 'order_issue';
  const pending = midResolution ? { question: lastBot?.text ?? '', intent: resumeIntent } : undefined;

  let routed: RouteResult;
  try {
    routed = await tracer.step('route', () => route(gate.text, llm, undefined, pending));
  } catch {
    // LLM routing failed — fall back to rules (or 'unknown') so we still respond gracefully.
    routed = { intent: ruleIntent(gate.text) ?? 'unknown', confidence: 0.3, sentiment: detectSentiment(gate.text), language: detectLanguage(gate.text) };
  }
  // Continue the pending flow only when the reply has no clear intent of its own (classifier returned
  // 'unknown'); any clear, different intent is honoured as a topic switch — no hardcoded override list.
  if (midResolution && routed.intent === 'unknown') {
    tracer.note('continuity', { resumed: resumeIntent });
    routed = { ...routed, intent: resumeIntent };
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
    result = await tracer.step(`handle:${routed.intent}`, () => handler.handle(ctx, { llm, providers: deps.providers, tracer }));
  } catch {
    result = { reply: 'Something went wrong on my side — let me get a teammate to help you right away.', status: 'escalated', escalationReason: 'handler error' };
  }

  // Garbage-out guard. Polish may rephrase; if it leaks persona/provider, fall back to the grounded base reply.
  // Polish is an extra model round-trip, so spend it only where natural language adds value —
  // order issues and escalations. Happy-path fact replies use their on-brand templates (instant).
  const wantsPolish = result.polish ?? (routed.intent === 'order_issue' || result.status === 'escalated');
  const composed = wantsPolish ? await tracer.step('compose', () => polish(llm, result.reply)) : result.reply;
  const checked = checkOutput(composed);
  const reply = checked.ok ? checked.text : checkOutput(result.reply).ok ? result.reply : 'Let me connect you with a teammate to make sure this is handled properly.';

  const assistantMsg = await repo.addMessage({ conversationId: conversation.id, role: 'assistant', text: reply, payload: result.data ?? null, traceId: tracer.traceId });
  // The conversation status follows the turn (handlers decide; closing confirms before it returns 'closed').
  const convStatus = result.status;
  await repo.updateConversation(conversation.id, {
    status: convStatus,
    sentiment: routed.sentiment,
    subject: conversation.subject ?? deriveTitle(routed.intent, gate.text),
    customerId: ctx.customerId ?? null,
    orderId: ctx.orderId ?? null,
    escalationReason: result.status === 'escalated' ? result.escalationReason ?? null : null,
  });
  await tracer.finalize({ messageId: assistantMsg.id, intent: routed.intent, confidence: routed.confidence, sentiment: routed.sentiment });

  // Frustration-aware handoff: if the customer is angry and we're not already escalating, proactively
  // surface a human option (the #1 complaint about support bots is being unable to reach a person).
  const hasHumanOption = (result.suggestions ?? []).some((s) => /person|human|agent|teammate|someone/i.test(typeof s === 'string' ? s : s.label));
  const suggestions =
    routed.sentiment === 'angry' && result.status !== 'escalated' && !hasHumanOption ? [...(result.suggestions ?? []), 'Talk to a person'] : result.suggestions;

  return {
    conversationId: conversation.id,
    traceId: tracer.traceId,
    reply,
    status: result.status,
    action: result.action,
    escalationReason: result.escalationReason,
    data: result.data,
    suggestions,
    intent: routed.intent,
    sentiment: routed.sentiment,
    latencyMs: tracer.latencyMs,
  };
}
