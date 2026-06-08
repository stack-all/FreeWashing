export interface StoredDevice {
  id: string;
  name: string;
}

export interface StoredSettings {
  waterLevel: string;
  builderTransaction: string;
  builderFamily: string;
  builderMode: string;
  builderParameter: string;
  customTransaction: string;
  customFamily: string;
  customMode: string;
  customParameter: string;
  manualHex: string;
  pauseHex: string;
  lastDevice: StoredDevice | null;
}

const STORAGE_KEY = "freewashing.settings.v1";

export function loadSettings(defaults: StoredSettings): StoredSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaults;
    }
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

export function saveSettings(settings: StoredSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
