import * as z from 'zod';
import { config } from '../config';

// Built to the real WhatsApp Cloud API contract. With creds set, sends are real Graph API calls;
// without them (sim mode), send is a no-op and the webhook route echoes the reply to the simulator.

export function verifyWebhook(query: { mode?: string; token?: string; challenge?: string }): string | null {
  if (query.mode === 'subscribe' && query.token === config.whatsapp.verifyToken) return query.challenge ?? '';
  return null;
}

export interface InboundWa {
  from: string;
  text: string;
  messageId: string;
}

// Minimal slice of the real inbound webhook payload.
const InboundSchema = z.object({
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({
          value: z.object({
            messages: z
              .array(z.object({ from: z.string(), id: z.string(), type: z.string(), text: z.object({ body: z.string() }).optional() }))
              .optional(),
          }),
        }),
      ),
    }),
  ),
});

export function parseInbound(body: unknown): InboundWa | null {
  const parsed = InboundSchema.safeParse(body);
  if (!parsed.success) return null;
  const msg = parsed.data.entry[0]?.changes[0]?.value.messages?.[0];
  if (!msg || msg.type !== 'text' || !msg.text) return null;
  return { from: msg.from, text: msg.text.body, messageId: msg.id };
}

// The exact Graph API request body we'd POST to reply
export function buildSendPayload(to: string, text: string) {
  return { messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { body: text } };
}

export async function sendMessage(to: string, text: string, signal?: AbortSignal): Promise<void> {
  if (!config.whatsapp.live) return; // sim mode — the UI surfaces buildSendPayload instead
  await fetch(`${config.whatsapp.graphBase}/${config.whatsapp.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.whatsapp.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildSendPayload(to, text)),
    signal: signal ?? AbortSignal.timeout(8000),
  });
}
