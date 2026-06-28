let asked = false;

// Ask once, on a user gesture (browsers require that).
export async function ensureNotifyPermission(): Promise<void> {
  if (asked || typeof Notification === 'undefined') return;
  asked = true;
  if (Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch {
      /* ignore */
    }
  }
}

export function notify(title: string, body: string): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body });
  } catch {
    /* ignore */
  }
}
