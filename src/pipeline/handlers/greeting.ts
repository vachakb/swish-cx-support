import type { Handler } from '../types';

export const greetingHandler: Handler = {
  intents: ['greeting'],
  async handle() {
    return {
      reply: "Hey! I'm Swish Support. I can track an order, fix anything that went wrong with one, or answer a quick question — what's up?",
      status: 'resolved',
    };
  },
};
