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
    if ((!t && !image) || sending) return; // a photo on its own is a valid message
    onSend(t || "Here's a photo of the issue.", image ?? undefined);
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
    <div className="border-t border-neutral-100 bg-white px-4 py-3">
      <div className="mx-auto w-full max-w-2xl">
        {imageName && <div className="mb-2 text-xs font-medium text-swish-600">📎 {imageName}</div>}
        <div className="flex items-end gap-1.5 rounded-2xl border border-neutral-200 bg-neutral-50 p-1.5 transition focus-within:border-swish-300 focus-within:bg-white">
          <button type="button" onClick={() => fileRef.current?.click()} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600" title="Attach a photo">📷</button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickFile} />
          <textarea value={text} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)} onKeyDown={onKey} rows={1} placeholder={placeholder} className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent px-1.5 py-1.5 text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none" />
          <button type="button" onClick={submit} disabled={sending || (!text.trim() && !image)} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-swish-500 text-white transition hover:bg-swish-600 disabled:opacity-40">➤</button>
        </div>
      </div>
    </div>
  );
}
