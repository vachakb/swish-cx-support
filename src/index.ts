import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { config } from './config';
import { app } from './server/app';
import { startProactiveOutreach } from './server/proactive';
import { startInactivitySweeper } from './server/sweeper';

// In production, serve the built web app (with SPA fallback) after the API routes.
if (config.isProd) {
  app.use('/*', serveStatic({ root: './web/dist' }));
  app.get('/*', serveStatic({ path: './web/dist/index.html' }));
}

serve({ fetch: app.fetch, port: config.port }, (info) => {
  // Spell out *why* it's mock so a missing/overridden key is obvious at a glance.
  const llm =
    config.llmProvider === 'gemini'
      ? 'gemini'
      : config.geminiApiKey
        ? 'mock (LLM_PROVIDER=mock overrides the key)'
        : 'mock — no GEMINI_API_KEY found in .env';
  console.log(`Swish Support → http://localhost:${info.port}  [llm: ${llm}, whatsapp: ${config.whatsapp.live ? 'live' : 'sim'}]`);
});

// Close + sign off chats that have gone quiet — owned by the service, not triggered by a page load.
startInactivitySweeper();
// Reach out about orders running late before the customer has to ask.
startProactiveOutreach();
