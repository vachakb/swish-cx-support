export const inr = (paise: number): string => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

// Display IDs in Swish's dashed-numeric style (e.g. 0632-212573-7063), deterministic from the real id.
export function formatId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const s = h.toString().padStart(14, '0').slice(0, 14);
  return `${s.slice(0, 4)}-${s.slice(4, 10)}-${s.slice(10, 14)}`;
}

// "Jun 24, 2026, 2:37 PM"
export function longDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// "28-06-2026 20:28"
export function shortDateTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function readImageAsBase64(file: File): Promise<{ mimeType: string; dataBase64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve({ mimeType: file.type || 'image/jpeg', dataBase64: result.split(',')[1] ?? '' });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
