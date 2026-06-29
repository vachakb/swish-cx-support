import { eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { id } from '../db/ids';
import { orders, resolutions, wallets } from '../db/schema';
import { getOrder, getResolutionByKey, logAudit } from '../repositories';
import type { ActionExecutor, ActionRequest, ActionResult } from './types';

const CANCELLABLE = new Set(['placed', 'preparing']);
const IDEMPOTENT = 'Already processed (idempotent).';

// Re-validate against live state at execution time — never trust the proposal blindly.
async function validate(req: ActionRequest): Promise<string | null> {
  switch (req.type) {
    case 'refund': {
      const order = await getOrder(req.orderId);
      if (!order) return 'order not found';
      if (req.amount <= 0) return 'refund amount must be positive';
      if (req.amount > order.total) return 'refund exceeds order total';
      return null;
    }
    case 'credit':
      return req.amount > 0 ? null : 'credit amount must be positive';
    case 'cancel': {
      const order = await getOrder(req.orderId);
      if (!order) return 'order not found';
      if (!CANCELLABLE.has(order.status)) return `order can't be cancelled once it's ${order.status}`;
      return null;
    }
    case 'redeliver':
    case 'reassign_rider':
      return (await getOrder(req.orderId)) ? null : 'order not found';
    default: {
      const _x: never = req;
      return `unknown action ${String(_x)}`;
    }
  }
}

async function applySideEffects(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], req: ActionRequest): Promise<void> {
  if (req.type === 'credit') {
    await tx.update(wallets)
      .set({ creditBalance: sql`${wallets.creditBalance} + ${req.amount}`, updatedAt: new Date() })
      .where(eq(wallets.customerId, req.customerId));
  } else if (req.type === 'cancel') {
    await tx.update(orders).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(orders.id, req.orderId));
  }

}

export const mockExecutor: ActionExecutor = {
  async execute(req: ActionRequest): Promise<ActionResult> {
    const existing = await getResolutionByKey(req.idempotencyKey);
    if (existing) return { status: 'duplicate', resolutionId: existing.id, message: IDEMPOTENT };

    const invalid = await validate(req);
    if (invalid) return { status: 'failed', message: invalid };

    const resolutionId = id('res');
    const orderId = 'orderId' in req ? req.orderId : null;
    const amount = 'amount' in req ? req.amount : null;
    try {
      await db.transaction(async (tx) => {
        await tx.insert(resolutions).values({
          id: resolutionId,
          conversationId: req.conversationId,
          customerId: req.customerId,
          orderId,
          type: req.type,
          amount,
          reason: req.reason,
          decidedBy: 'policy',
          status: 'executed',
          idempotencyKey: req.idempotencyKey,
        });
        await applySideEffects(tx, req);
      });
    } catch {

      const dup = await getResolutionByKey(req.idempotencyKey);
      if (dup) return { status: 'duplicate', resolutionId: dup.id, message: IDEMPOTENT };
      return { status: 'failed', message: 'execution failed' };
    }

    await logAudit({ conversationId: req.conversationId, actor: 'bot', action: `action.${req.type}`, detail: { resolutionId, orderId, amount } });
    return { status: 'executed', resolutionId, message: 'Done.' };
  },
};
