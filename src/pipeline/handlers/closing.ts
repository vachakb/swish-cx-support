import type { Handler } from '../types';

// Customer signalled they're done — the engine archives the thread on this intent.
export const closingHandler: Handler = {
  intents: ['closing'],
  async handle() {
    return { reply: "Glad I could help — enjoy your meal! ✨ We're here anytime you need us.", status: 'resolved' };
  },
};
