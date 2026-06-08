import type { ParsedWasherResponse } from "../domain/protocol";
import type { BluetoothDeviceSummary, ConnectedDevice } from "../services/bluetooth";
import type { StoredSettings } from "../services/storage";
import type { IconName } from "../ui/icons";

export type LogLevel = "info" | "success" | "error";
export type BluetoothPacketDirection = "tx" | "rx";
export type ConnectionPhase = "idle" | "connecting" | "connected";
export type ControlTabId = "quick" | "status" | "builder" | "manual";
export type AppTabId = "connect" | "control";
export type StatusQueryPhase = "idle" | "sending" | "waiting" | "received" | "timeout" | "error" | "unknown";
export type SettingField = Exclude<keyof StoredSettings, "lastDevice">;

export interface LogEntry {
  id: number;
  time: string;
  level: LogLevel;
  message: string;
}

export interface BluetoothPacketEntry {
  id: number;
  time: string;
  direction: BluetoothPacketDirection;
  operation: string;
  hex: string;
}

export interface StatusViewState {
  requestId: number;
  phase: StatusQueryPhase;
  message: string;
  requestedAt: string | null;
  receivedAt: string | null;
  parsed: ParsedWasherResponse | null;
}

export interface AppState {
  online: boolean;
  secureContext: boolean;
  bluetoothAvailable: boolean | null;
  connectionPhase: ConnectionPhase;
  connectedDevice: ConnectedDevice | null;
  grantedDevices: BluetoothDeviceSummary[];
  selectedGrantedDeviceId: string;
  canInstall: boolean;
  appInstalled: boolean;
  updateAvailable: boolean;
  isUpdating: boolean;
  isSending: boolean;
  logs: LogEntry[];
  packetHistory: BluetoothPacketEntry[];
  status: StatusViewState;
  activeAppTab: AppTabId;
  activeControlTab: ControlTabId;
  settings: StoredSettings;
}

export interface BuilderPreview {
  bytes: number[];
  hex: string;
  error: string | null;
}

export interface ControlTabDefinition {
  id: ControlTabId;
  label: string;
  iconName: IconName;
}

export const CONTROL_TABS: ControlTabDefinition[] = [
  { id: "quick", label: "常规控制", iconName: "droplet" },
  { id: "status", label: "状态", iconName: "radio" },
  { id: "builder", label: "自定义参数", iconName: "settings" },
  { id: "manual", label: "蓝牙历史", iconName: "terminal" }
];

export const DEFAULT_STATUS_STATE: StatusViewState = {
  requestId: 0,
  phase: "idle",
  message: "暂无状态",
  requestedAt: null,
  receivedAt: null,
  parsed: null
};
