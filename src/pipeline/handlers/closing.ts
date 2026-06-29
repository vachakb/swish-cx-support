import type { Handler } from '../types';

// Confirm before archiving: a first "thanks/bye" gets an "anything else?"; a second one closes.
export const closingHandler: Handler = {
  intents: ['closing'],
  async handle(ctx) {
    const lastBot = [...ctx.history].reverse().find((m) => m.role === 'assistant');
    const alreadyConfirming = (lastBot?.payload as { kind?: string } | null | undefined)?.kind === 'closing_confirm';
    if (alreadyConfirming) {
      return { reply: "Take care, and enjoy! 💚 We're here anytime you need us.", status: 'closed' };
    }
    return { reply: "Glad I could help! 😊 Is there anything else I can do for you?", status: 'awaiting_user', data: { kind: 'closing_confirm' } };
  },
};
