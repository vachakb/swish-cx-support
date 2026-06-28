import type { ReactNode } from 'react';
import type { Trace } from '../types';

export function TracePanel({ trace, status }: { trace: Trace | null; status?: string }) {
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700">Live decision trace</div>
      {!trace ? (
        <div className="grid flex-1 place-items-center p-6 text-center text-xs text-neutral-400">The routing, ETA-truth, and policy decisions behind each reply appear here.</div>
      ) : (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-xs">
          <div className="flex flex-wrap gap-1.5">
            <Tag>intent: {trace.intent}</Tag>
            {trace.confidence != null && <Tag>conf: {trace.confidence.toFixed(2)}</Tag>}
            <Tag>sentiment: {trace.sentiment}</Tag>
            <Tag>{trace.latencyMs}ms</Tag>
            {status && <Tag tone={status === 'escalated' ? 'amber' : status === 'resolved' ? 'green' : 'gray'}>{status}</Tag>}
          </div>
          <ol className="space-y-2">
            {(trace.steps ?? []).map((s, i) => (
              <li key={`${s.stage}-${i}`} className="rounded-lg border border-neutral-100 bg-neutral-50 p-2">
                <div className="flex justify-between font-medium text-neutral-700">
                  <span>{s.stage}</span>
                  <span className="text-neutral-400">{s.ms}ms</span>
                </div>
                {s.data && <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-snug text-neutral-500">{JSON.stringify(s.data)}</pre>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function Tag({ children, tone = 'gray' }: { children: ReactNode; tone?: 'gray' | 'amber' | 'green' }) {
  const tones = { gray: 'bg-neutral-100 text-neutral-600', amber: 'bg-amber-100 text-amber-700', green: 'bg-green-100 text-green-700' };
  return <span className={`rounded px-1.5 py-0.5 font-medium ${tones[tone]}`}>{children}</span>;
}
