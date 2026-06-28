import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { config } from './config';

const app = new Hono();

app.get('/api/health', (c) =>
  c.json({ status: 'ok', service: 'swish-support', provider: config.llmProvider }),
);

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`Swish Support API → http://localhost:${info.port}  [llm: ${config.llmProvider}]`);
});
