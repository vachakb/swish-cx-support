import { db } from '../db/client';
import { id } from '../db/ids';
import { traces } from '../db/schema';
import type { TraceStep } from '../types';

// Per-turn trace: times each stage, powers the UI debug panel and the bake-off's latency numbers.
export class Tracer {
  readonly traceId = id('trc');
  private readonly conversationId: string;
  private readonly steps: TraceStep[] = [];
  private readonly startedAt = Date.now();

  constructor(conversationId: string) {
    this.conversationId = conversationId;
  }

  async step<T>(stage: string, fn: () => Promise<T>): Promise<T> {
    const t0 = Date.now();
    try {
      return await fn();
    } finally {
      this.steps.push({ stage, ms: Date.now() - t0 });
    }
  }

  note(stage: string, data: Record<string, unknown>): void {
    this.steps.push({ stage, ms: 0, data });
  }

  get latencyMs(): number {
    return Date.now() - this.startedAt;
  }

  get collected(): TraceStep[] {
    return this.steps;
  }

  async finalize(meta: { messageId?: string; intent?: string; confidence?: number; sentiment?: string }): Promise<void> {
    await db.insert(traces).values({
      id: this.traceId,
      conversationId: this.conversationId,
      messageId: meta.messageId ?? null,
      intent: meta.intent ?? null,
      confidence: meta.confidence ?? null,
      sentiment: meta.sentiment ?? null,
      latencyMs: this.latencyMs,
      steps: this.steps,
    });
  }
}
