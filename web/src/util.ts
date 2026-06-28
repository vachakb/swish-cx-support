export const inr = (paise: number): string => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

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
