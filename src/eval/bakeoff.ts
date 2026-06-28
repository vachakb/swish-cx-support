import { createLlm } from '../llm';
import { buildMockHandlers } from '../pipeline/mock-llm';
import { RouteSchema, route, ruleIntent } from '../pipeline/router';
import type { Intent } from '../pipeline/types';
import { routeCases } from './dataset';

const llm = createLlm(buildMockHandlers());

type Classify = (text: string) => Promise<Intent>;

async function measure(name: string, classify: Classify) {
  let correct = 0;
  let totalMs = 0;
  const misses: string[] = [];
  for (const c of routeCases) {
    const t0 = Date.now();
    const got = await classify(c.text);
    totalMs += Date.now() - t0;
    if (got === c.expected) correct++;
    else misses.push(`"${c.text}" → ${got} (want ${c.expected})`);
  }
  return { name, accuracy: correct / routeCases.length, avgMs: totalMs / routeCases.length, misses };
}

const rulesOnly: Classify = (t) => Promise.resolve(ruleIntent(t) ?? 'unknown');
const llmOnly: Classify = async (t) => (await llm.generateJson({ task: 'route', tier: 'fast', prompt: t, schema: RouteSchema })).intent;
const hybrid: Classify = async (t) => (await route(t, llm)).intent;

const strategies: Array<[string, Classify]> = [
  ['rules-only', rulesOnly],
  ['llm-only', llmOnly],
  ['hybrid', hybrid],
];

const ruleHit = routeCases.filter((c) => ruleIntent(c.text) !== null).length;

const results = [];
for (const [name, fn] of strategies) results.push(await measure(name, fn));

console.log(`\nRouting bake-off · ${routeCases.length} labeled cases · provider: ${llm.name}\n`);
console.log('| strategy    | accuracy | avg latency |');
console.log('|-------------|----------|-------------|');
for (const r of results) console.log(`| ${r.name.padEnd(11)} | ${`${(r.accuracy * 100).toFixed(0)}%`.padStart(8)} | ${`${r.avgMs.toFixed(2)}ms`.padStart(11)} |`);
console.log(`\nRules cover ${ruleHit}/${routeCases.length} (${((ruleHit / routeCases.length) * 100).toFixed(0)}%) of cases on the instant path — hybrid skips the model on those.`);
console.log('With a real Gemini key, llm-only carries real latency/cost; hybrid keeps llm-level accuracy while routing most traffic through the cheap rule path.\n');
for (const r of results) if (r.misses.length) console.log(`${r.name} misses:\n  ${r.misses.join('\n  ')}\n`);
