import type { Handler } from '../types';

export const fallbackHandler: Handler = {
  intents: ['unknown'],
  async handle(ctx) {
    if (ctx.route.sentiment === 'angry') {
      return {
        reply: "I'm sorry this has been frustrating. Let me get a teammate to help you directly.",
        status: 'escalated',
        escalationReason: 'frustrated, intent unclear',
      };
    }
    return {
      reply: "I want to point you to the right help — is this about tracking an order, a problem with one, a payment, or a general question?",
      status: 'awaiting_user',
    };
  },
};
