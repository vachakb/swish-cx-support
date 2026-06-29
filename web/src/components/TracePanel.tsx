import type { ReactNode } from 'react';
import type { Trace } from '../types';

const num = (v: unknown): number => (typeof v === 'number' ? v : 0);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export function TracePanel({ trace, status }: { trace: Trace | null; status?: string }) {
  if (!trace) {
    return (
      <div className="flex h-full flex-col bg-white">
        <div className="border-b border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700">Live decision trace</div>
        <div className="grid flex-1 place-items-center p-6 text-center text-xs text-neutral-400">The routing, model, ETA-truth, and policy decisions behind each reply appear here.</div>
      </div>
    );
  }
  const steps = trace.steps ?? [];
  const timed = steps.filter((x) => x.ms > 0);
  const maxMs = Math.max(1, ...timed.map((x) => x.ms));
  const models = steps.filter((x) => x.stage === 'model');
  const tokens = models.reduce((a, x) => a + num(x.data?.inTokens) + num(x.data?.outTokens), 0);
  const costPaise = models.reduce((a, x) => a + num(x.data?.costPaise), 0);
  const policy = steps.find((x) => x.stage === 'policy');
  const decisions = steps.filter((x) => x.data && !['model', 'llm', 'policy'].includes(x.stage));
  const provider = str(steps.find((x) => x.stage === 'llm')?.data?.provider);

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700">Live decision trace</div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-xs">
        <div className="flex flex-wrap gap-1.5">
          <Tag>intent: {trace.intent}</Tag>
          {trace.confidence != null && <Tag>conf {trace.confidence.toFixed(2)}</Tag>}
          <Tag>{trace.sentiment}</Tag>
          {status && <Tag tone={status === 'escalated' ? 'amber' : status === 'resolved' ? 'green' : 'gray'}>{status}</Tag>}
          <Tag tone="indigo">{trace.latencyMs}ms</Tag>
          {provider && <Tag>{provider}</Tag>}
        </div>

        <Section title="Pipeline">
          {timed.map((x, i) => (
            <div key={`${x.stage}-${i}`} className="space-y-0.5">
              <div className="flex justify-between text-neutral-600">
                <span>{x.stage}</span>
                <span className="tabular-nums text-neutral-400">{x.ms}ms</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                <div className="h-full rounded-full bg-swish-400" style={{ width: `${(x.ms / maxMs) * 100}%` }} />
              </div>
            </div>
          ))}
        </Section>

        {models.length > 0 && (
          <Section title={`Model calls · ${tokens.toLocaleString()} tok · ≈ ₹${(costPaise / 100).toFixed(4)}`}>
            {models.map((x, i) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-md bg-neutral-50 px-2 py-1">
                <div className="min-w-0">
                  <div className="font-medium text-neutral-700">
                    {str(x.data?.task)} <span className="text-neutral-400">· {str(x.data?.tier)}</span>
                  </div>
                  <div className="truncate text-[10px] text-neutral-400">{str(x.data?.model)}</div>
                </div>
                <div className="shrink-0 text-right tabular-nums text-neutral-500">
                  <div>{num(x.data?.inTokens)}→{num(x.data?.outTokens)} tok</div>
                  <div className="text-[10px] text-neutral-400">≈ ₹{(num(x.data?.costPaise) / 100).toFixed(4)}</div>
                </div>
              </div>
            ))}
          </Section>
        )}

        {policy && (
          <Section title="Policy · deterministic gate">
            <div className={`rounded-md px-2 py-1.5 ${str(policy.data?.outcome) === 'auto_approve' ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>
              <div className="font-semibold">{str(policy.data?.outcome) || 'n/a'}</div>
              {arr(policy.data?.reasons).length > 0 && (
                <ul className="mt-0.5 list-disc pl-4 text-[11px]">
                  {arr(policy.data?.reasons).map((r, i) => (
                    <li key={i}>{str(r)}</li>
                  ))}
                </ul>
              )}
            </div>
          </Section>
        )}

        {decisions.length > 0 && (
          <Section title="Decisions">
            {decisions.map((x, i) => (
              <div key={`${x.stage}-${i}`} className="rounded-md bg-neutral-50 px-2 py-1">
                <div className="font-medium text-neutral-600">{x.stage}</div>
                <pre className="mt-0.5 overflow-x-auto whitespace-pre-wrap break-words text-[10px] leading-snug text-neutral-500">{JSON.stringify(x.data)}</pre>
              </div>
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Tag({ children, tone = 'gray' }: { children: ReactNode; tone?: 'gray' | 'amber' | 'green' | 'indigo' }) {
  const tones = { gray: 'bg-neutral-100 text-neutral-600', amber: 'bg-amber-100 text-amber-700', green: 'bg-green-100 text-green-700', indigo: 'bg-indigo-100 text-indigo-700' };
  return <span className={`rounded px-1.5 py-0.5 font-medium ${tones[tone]}`}>{children}</span>;
}
