import type { Handler, Intent } from '../types';
import { closingHandler } from './closing';
import { faqHandler } from './faq';
import { fallbackHandler } from './fallback';
import { greetingHandler } from './greeting';
import { humanHandler } from './human';
import { orderActionHandler } from './order-action';
import { orderInfoHandler } from './order-info';

const registry = new Map<Intent, Handler>();
for (const handler of [greetingHandler, faqHandler, orderInfoHandler, orderActionHandler, humanHandler, closingHandler, fallbackHandler]) {
  for (const intent of handler.intents) registry.set(intent, handler);
}

export function getHandler(intent: Intent): Handler {
  return registry.get(intent) ?? fallbackHandler;
}
