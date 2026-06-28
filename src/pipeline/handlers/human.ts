import type { Handler } from '../types';

export const humanHandler: Handler = {
  intents: ['human'],
  async handle() {
    return {
      reply: "Of course — I'm bringing in a teammate now. They'll see this whole conversation, so you won't have to repeat anything.",
      status: 'escalated',
      escalationReason: 'customer requested a human',
    };
  },
};
