import { useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { readImageAsBase64 } from '../util';

type ImagePayload = { mimeType: string; dataBase64: string };

export function Composer({ sending, onSend, placeholder = 'Type a message…' }: { sending: boolean; onSend: (text: string, image?: ImagePayload) => void; placeholder?: string }) {
  const [text, setText] = useState('');
  const [image, setImage] = useState<ImagePayload | null>(null);
  const [imageName, setImageName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function pickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImage(await readImageAsBase64(file));
    setImageName(file.name);
  }
  function submit() {
    const t = text.trim();
    if (!t || sending) return;
    onSend(t, image ?? undefined);
    setText('');
    setImage(null);
    setImageName('');
    if (fileRef.current) fileRef.current.value = '';
  }
  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }
  return (
    <div className="border-t border-neutral-200 bg-white p-3">
      {imageName && <div className="mb-2 text-xs text-neutral-500">📎 {imageName}</div>}
      <div className="flex items-end gap-2">
        <button type="button" onClick={() => fileRef.current?.click()} className="rounded-lg border border-neutral-200 px-3 py-2 text-neutral-500 hover:bg-neutral-50" title="Attach a photo">📷</button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickFile} />
        <textarea value={text} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)} onKeyDown={onKey} rows={1} placeholder={placeholder} className="min-h-[40px] flex-1 resize-none rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-swish-400 focus:outline-none" />
        <button type="button" onClick={submit} disabled={sending || !text.trim()} className="rounded-lg bg-swish-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">Send</button>
      </div>
    </div>
  );
}
