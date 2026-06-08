export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function registerServiceWorker(onStatus: (message: string) => void): void {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) {
    return;
  }

  const url = `${import.meta.env.BASE_URL}sw.js`;
  navigator.serviceWorker
    .register(url)
    .then(() => onStatus("离线缓存已启用"))
    .catch((error: unknown) => onStatus(`Service Worker 注册失败: ${String(error)}`));
}
