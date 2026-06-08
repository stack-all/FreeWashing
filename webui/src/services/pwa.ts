export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export interface PwaUpdate {
  registration: ServiceWorkerRegistration | null;
  source: "service-worker" | "assets";
}

interface ServiceWorkerCallbacks {
  onStatus: (message: string) => void;
  onUpdateReady: (update: PwaUpdate) => void;
}

export function isPwaInstalled(): boolean {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

export function registerServiceWorker({ onStatus, onUpdateReady }: ServiceWorkerCallbacks): () => void {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) {
    return () => undefined;
  }

  let disposed = false;
  let reloading = false;
  let intervalId: number | null = null;
  const cleanupTasks: Array<() => void> = [];
  let updateReported = false;
  const url = `${import.meta.env.BASE_URL}sw.js`;

  const reportUpdate = (update: PwaUpdate) => {
    if (disposed || updateReported) {
      return;
    }
    updateReported = true;
    onUpdateReady(update);
  };

  const checkRemoteAssets = async () => {
    if (disposed) {
      return;
    }

    const currentAssets = getCurrentAssetPaths();
    if (currentAssets.size === 0) {
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.BASE_URL}?__fw_update_check=${Date.now()}`, {
        cache: "no-store"
      });
      if (!response.ok) {
        return;
      }
      const remoteAssets = getAssetPathsFromHtml(await response.text());
      if (remoteAssets.size > 0 && !setsEqual(currentAssets, remoteAssets)) {
        reportUpdate({ registration: null, source: "assets" });
      }
    } catch {
      // 网络不可用时保持静默，下次恢复网络或聚焦页面时会再次检查。
    }
  };

  const checkForUpdates = (registration: ServiceWorkerRegistration) => {
    void registration.update().catch(() => undefined);
    void checkRemoteAssets();
  };

  const handleControllerChange = () => {
    if (reloading) {
      return;
    }
    reloading = true;
    window.location.reload();
  };

  navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

  navigator.serviceWorker
    .register(url)
    .then((registration) => {
      if (disposed) {
        return;
      }

      onStatus("离线缓存已启用");

      if (registration.waiting && navigator.serviceWorker.controller) {
        reportUpdate({ registration, source: "service-worker" });
      }

      const handleUpdateFound = () => {
        const worker = registration.installing;
        if (!worker) {
          return;
        }

        const handleStateChange = () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            reportUpdate({ registration, source: "service-worker" });
          }
        };

        worker.addEventListener("statechange", handleStateChange);
        cleanupTasks.push(() => worker.removeEventListener("statechange", handleStateChange));
      };

      registration.addEventListener("updatefound", handleUpdateFound);
      const handleFocus = () => checkForUpdates(registration);
      const handleVisibilityChange = () => {
        if (!document.hidden) {
          checkForUpdates(registration);
        }
      };

      window.addEventListener("focus", handleFocus);
      document.addEventListener("visibilitychange", handleVisibilityChange);
      intervalId = window.setInterval(() => checkForUpdates(registration), 5 * 60 * 1000);
      window.setTimeout(() => checkForUpdates(registration), 1200);

      cleanupTasks.push(() => registration.removeEventListener("updatefound", handleUpdateFound));
      cleanupTasks.push(() => window.removeEventListener("focus", handleFocus));
      cleanupTasks.push(() => document.removeEventListener("visibilitychange", handleVisibilityChange));
    })
    .catch((error: unknown) => onStatus(`Service Worker 注册失败: ${String(error)}`));

  return () => {
    disposed = true;
    navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    cleanupTasks.splice(0).forEach((cleanup) => cleanup());
    if (intervalId !== null) {
      window.clearInterval(intervalId);
    }
  };
}

export function activateServiceWorkerUpdate(registration: ServiceWorkerRegistration | null): boolean {
  const waiting = registration?.waiting;
  if (!waiting) {
    return false;
  }

  waiting.postMessage({ type: "SKIP_WAITING" });
  return true;
}

export async function reloadWithFreshBuild(): Promise<void> {
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("freewashing-")).map((key) => caches.delete(key)));
  }

  window.location.href = `${import.meta.env.BASE_URL}?__fw_reload=${Date.now()}`;
}

function getCurrentAssetPaths(): Set<string> {
  const assets = new Set<string>();
  document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>("script[src*='/assets/'], link[href*='/assets/']").forEach(
    (element) => {
      const value = element instanceof HTMLScriptElement ? element.src : element.href;
      try {
        assets.add(new URL(value, window.location.href).pathname);
      } catch {
        // Ignore malformed URLs from unexpected markup.
      }
    }
  );
  return assets;
}

function getAssetPathsFromHtml(html: string): Set<string> {
  const assets = new Set<string>();
  const pattern = /\b(?:src|href)="([^"]*\/assets\/[^"]+)"/g;
  let match = pattern.exec(html);
  while (match) {
    try {
      assets.add(new URL(match[1], window.location.origin).pathname);
    } catch {
      // Ignore malformed URLs from unexpected markup.
    }
    match = pattern.exec(html);
  }
  return assets;
}

function setsEqual(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) {
    return false;
  }

  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }
  return true;
}
