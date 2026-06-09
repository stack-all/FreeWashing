import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppTabs } from "./components/AppTabs";
import { BuilderPanel } from "./components/BuilderPanel";
import { ConnectionView } from "./components/ConnectionView";
import { ControlTabs } from "./components/ControlTabs";
import { EnvironmentNotice } from "./components/EnvironmentNotice";
import { ManualPanel } from "./components/ManualPanel";
import { ModuleLoopToggle } from "./components/ModuleLoopToggle";
import { QuickControls } from "./components/QuickControls";
import { StatusPanel } from "./components/StatusPanel";
import { defaultSettings, getBuilderPreview } from "./app/protocolBuilder";
import {
  CONTROL_TABS,
  DEFAULT_STATUS_STATE,
  type AppState,
  type AppTabId,
  type BluetoothPacketDirection,
  type ControlTabId,
  type LogLevel,
  type SettingField
} from "./app/types";
import { bytesToHex, parseHexByte, parseHexPacket } from "./domain/hex";
import {
  buildControlFrame,
  buildPauseFrame,
  buildStatusQueryFrame,
  type ParsedWasherResponse,
  parseWasherResponse,
  type WasherModeDefinition
} from "./domain/protocol";
import { DEFAULT_CHIPTUNE_SEED } from "./audio/chiptunePlayer";
import { WasherBluetoothClient, type ConnectedDevice } from "./services/bluetooth";
import {
  activateServiceWorkerUpdate,
  isPwaInstalled,
  registerServiceWorker,
  reloadWithFreshBuild,
  type InstallPromptEvent,
  type PwaUpdate
} from "./services/pwa";
import { loadSettings, saveSettings } from "./services/storage";
import { Icon } from "./ui/Icon";

function createInitialState(): AppState {
  return {
    online: navigator.onLine,
    secureContext: window.isSecureContext,
    bluetoothAvailable: null,
    connectionPhase: "idle",
    connectedDevice: null,
    grantedDevices: [],
    selectedGrantedDeviceId: "",
    canInstall: false,
    appInstalled: isPwaInstalled(),
    updateAvailable: false,
    isUpdating: false,
    isSending: false,
    musicSeed: DEFAULT_CHIPTUNE_SEED,
    logs: [],
    packetHistory: [],
    status: DEFAULT_STATUS_STATE,
    activeAppTab: "connect",
    activeControlTab: "quick",
    settings: loadSettings(defaultSettings)
  };
}

export function App() {
  const [state, setState] = useState<AppState>(createInitialState);
  const stateRef = useRef(state);
  const logIdRef = useRef(0);
  const packetIdRef = useRef(0);
  const statusQueryIdRef = useRef(0);
  const statusQueryTimerRef = useRef<number | null>(null);
  const installPromptRef = useRef<InstallPromptEvent | null>(null);
  const pendingUpdateRef = useRef<PwaUpdate | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    saveSettings(state.settings);
  }, [state.settings]);

  const clearStatusQueryTimer = useCallback(() => {
    if (statusQueryTimerRef.current === null) {
      return;
    }

    window.clearTimeout(statusQueryTimerRef.current);
    statusQueryTimerRef.current = null;
  }, []);

  const addLog = useCallback((message: string, level: LogLevel = "info") => {
    setState((previous) => ({
      ...previous,
      logs: [
        {
          id: logIdRef.current,
          time: currentTime(),
          level,
          message
        },
        ...previous.logs
      ].slice(0, 50)
    }));
    logIdRef.current += 1;
  }, []);

  const addPacketHistory = useCallback((direction: BluetoothPacketDirection, operation: string, hex: string) => {
    const id = packetIdRef.current;
    const time = currentTime();
    packetIdRef.current += 1;
    setState((previous) => ({
      ...previous,
      musicSeed: direction === "tx" ? `${id}|${time}|${operation}|${hex}` : previous.musicSeed,
      packetHistory: [
        {
          id,
          time,
          direction,
          operation,
          hex
        },
        ...previous.packetHistory
      ].slice(0, 80)
    }));
  }, []);

  const handleStatusNotification = useCallback(
    (parsed: ParsedWasherResponse | null) => {
      if (parsed) {
        clearStatusQueryTimer();
        setState((previous) => ({
          ...previous,
          status: {
            ...previous.status,
            phase: parsed.validCrc === false ? "error" : "received",
            message: parsed.validCrc === false ? "收到响应，但校验异常" : "状态已更新",
            receivedAt: currentTime(),
            parsed
          }
        }));
        return;
      }

      setState((previous) => {
        if (previous.status.phase !== "sending" && previous.status.phase !== "waiting") {
          return previous;
        }

        clearStatusQueryTimer();
        return {
          ...previous,
          status: {
            ...previous.status,
            phase: "unknown",
            message: "收到未识别响应",
            receivedAt: currentTime()
          }
        };
      });
    },
    [clearStatusQueryTimer]
  );

  const bluetoothClient = useMemo(
    () =>
      new WasherBluetoothClient({
        onDisconnected() {
          clearStatusQueryTimer();
          setState((previous) => ({
            ...previous,
            connectionPhase: "idle",
            connectedDevice: null,
            activeAppTab: "connect",
            status: {
              ...previous.status,
              phase: "idle",
              message: "未连接",
              requestedAt: null,
              receivedAt: null,
              parsed: null
            }
          }));
          addLog("设备已断开连接", "error");
        },
        onNotification(bytes) {
          const raw = bytesToHex(bytes);
          const parsed = parseWasherResponse(bytes);
          handleStatusNotification(parsed);
          addPacketHistory("rx", parsed ? "设备响应" : "未识别响应", raw);
          addLog(parsed ? `收到设备响应: ${raw}` : `收到未识别响应: ${raw}`, parsed?.validCrc === false ? "error" : "info");
        }
      }),
    [addLog, addPacketHistory, clearStatusQueryTimer, handleStatusNotification]
  );

  const builderPreview = useMemo(() => getBuilderPreview(state.settings), [state.settings]);
  const connected = state.connectionPhase === "connected";
  const activeAppTab = connected ? state.activeAppTab : "connect";
  const canUseBluetooth = bluetoothClient.isSupported && state.secureContext && state.bluetoothAvailable !== false;
  const isBusy = state.connectionPhase === "connecting";

  const armStatusQueryTimer = useCallback((requestId: number) => {
    statusQueryTimerRef.current = window.setTimeout(() => {
      statusQueryTimerRef.current = null;
      setState((previous) => {
        if (previous.status.requestId !== requestId || previous.status.phase !== "waiting") {
          return previous;
        }

        return {
          ...previous,
          status: {
            ...previous.status,
            phase: "timeout",
            message: "未收到设备响应"
          }
        };
      });
    }, 6500);
  }, []);

  const updateSetting = useCallback((key: SettingField, value: string) => {
    setState((previous) => ({
      ...previous,
      settings: {
        ...previous.settings,
        [key]: value
      }
    }));
  }, []);

  const refreshGrantedDevices = useCallback(
    async (showMessage = false) => {
      if (!bluetoothClient.supportsRememberedDevices) {
        return;
      }

      try {
        const grantedDevices = await bluetoothClient.getGrantedDevices();
        setState((previous) => {
          const lastDeviceId = previous.settings.lastDevice?.id;
          const selectedGrantedDeviceId =
            grantedDevices.find((device) => device.id === previous.selectedGrantedDeviceId)?.id ??
            grantedDevices.find((device) => device.id === lastDeviceId)?.id ??
            grantedDevices[0]?.id ??
            "";

          return {
            ...previous,
            grantedDevices,
            selectedGrantedDeviceId
          };
        });

        if (showMessage) {
          addLog(`已授权设备 ${grantedDevices.length} 台`, "info");
        }
      } catch (error) {
        addLog(errorMessage(error), "error");
      }
    },
    [addLog, bluetoothClient]
  );

  const handlePwaUpdateReady = useCallback(
    (update: PwaUpdate) => {
      pendingUpdateRef.current = update;
      setState((previous) => {
        if (previous.updateAvailable) {
          return previous;
        }
        return {
          ...previous,
          updateAvailable: true
        };
      });
      addLog(update.source === "assets" ? "检测到 GitHub Pages 新版本" : "检测到离线缓存新版本", "info");
    },
    [addLog]
  );

  useEffect(() => {
    const handleOnline = () => setState((previous) => ({ ...previous, online: true }));
    const handleOffline = () => setState((previous) => ({ ...previous, online: false }));
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      installPromptRef.current = event as InstallPromptEvent;
      setState((previous) => ({ ...previous, canInstall: true, appInstalled: false }));
    };
    const handleAppInstalled = () => {
      installPromptRef.current = null;
      setState((previous) => ({ ...previous, canInstall: false, appInstalled: true }));
      addLog("PWA 已安装", "success");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    const unregisterServiceWorkerEvents = registerServiceWorker({
      onStatus: (message) => addLog(message, "info"),
      onUpdateReady: handlePwaUpdateReady
    });
    void bluetoothClient.isAvailable().then((available) => {
      setState((previous) => ({ ...previous, bluetoothAvailable: available }));
    });
    void refreshGrantedDevices(false);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      unregisterServiceWorkerEvents();
      clearStatusQueryTimer();
    };
  }, [addLog, bluetoothClient, clearStatusQueryTimer, handlePwaUpdateReady, refreshGrantedDevices]);

  const setActiveAppTab = useCallback((tab: AppTabId) => {
    setState((previous) => {
      if (tab === "control" && previous.connectionPhase !== "connected") {
        return previous;
      }
      return { ...previous, activeAppTab: tab };
    });
  }, []);

  const setActiveControlTab = useCallback((tab: ControlTabId) => {
    setState((previous) => ({ ...previous, activeControlTab: tab }));
  }, []);

  const shiftControlTab = useCallback((delta: number) => {
    setState((previous) => {
      const currentIndex = CONTROL_TABS.findIndex((tab) => tab.id === previous.activeControlTab);
      const nextIndex = Math.min(CONTROL_TABS.length - 1, Math.max(0, currentIndex + delta));
      const nextTab = CONTROL_TABS[nextIndex];
      if (!nextTab || nextTab.id === previous.activeControlTab) {
        return previous;
      }
      return { ...previous, activeControlTab: nextTab.id };
    });
  }, []);

  const handleConnected = useCallback((device: ConnectedDevice) => {
    setState((previous) => ({
      ...previous,
      connectionPhase: "connected",
      connectedDevice: device,
      activeAppTab: "control",
      settings: {
        ...previous.settings,
        lastDevice: {
          id: device.id,
          name: device.name
        }
      }
    }));
  }, []);

  const withConnectionBusy = useCallback(
    async (work: () => Promise<void>) => {
      let completed = false;
      setState((previous) => ({ ...previous, connectionPhase: "connecting" }));
      try {
        await work();
        completed = true;
      } catch (error) {
        setState((previous) => ({
          ...previous,
          connectionPhase: "idle",
          connectedDevice: null
        }));
        addLog(errorMessage(error), "error");
      } finally {
        if (!completed) {
          setState((previous) => ({
            ...previous,
            connectionPhase: "idle"
          }));
        }
      }
    },
    [addLog]
  );

  const connectNewDevice = useCallback(async () => {
    await withConnectionBusy(async () => {
      const device = await bluetoothClient.requestAndConnect();
      handleConnected(device);
      await refreshGrantedDevices(false);
      addLog(`已连接 ${device.name}`, "success");
    });
  }, [addLog, bluetoothClient, handleConnected, refreshGrantedDevices, withConnectionBusy]);

  const connectGrantedDevice = useCallback(async () => {
    await withConnectionBusy(async () => {
      const device = await bluetoothClient.connectGranted(stateRef.current.selectedGrantedDeviceId || undefined);
      handleConnected(device);
      addLog(`已恢复连接 ${device.name}`, "success");
    });
  }, [addLog, bluetoothClient, handleConnected, withConnectionBusy]);

  const disconnect = useCallback(() => {
    clearStatusQueryTimer();
    bluetoothClient.disconnect();
    setState((previous) => ({
      ...previous,
      connectionPhase: "idle",
      connectedDevice: null,
      activeAppTab: "connect",
      status: {
        ...previous.status,
        phase: "idle",
        message: "未连接",
        requestedAt: null,
        receivedAt: null,
        parsed: null
      }
    }));
  }, [bluetoothClient, clearStatusQueryTimer]);

  const sendFrame = useCallback(
    async (bytes: readonly number[], label: string) => {
      if (!bluetoothClient.isConnected) {
        addLog("请先连接洗衣机蓝牙设备", "error");
        return;
      }

      setState((previous) => ({ ...previous, isSending: true }));
      try {
        const hex = bytesToHex(bytes);
        await bluetoothClient.send(bytes);
        addPacketHistory("tx", label, hex);
        addLog(`${label} 已发送: ${hex}`, "success");
      } catch (error) {
        addLog(errorMessage(error), "error");
      } finally {
        setState((previous) => ({ ...previous, isSending: false }));
      }
    },
    [addLog, addPacketHistory, bluetoothClient]
  );

  const sendManualLikeFrame = useCallback(
    async (hex: string, label: string) => {
      try {
        await sendFrame(parseHexPacket(hex), label);
      } catch (error) {
        addLog(errorMessage(error), "error");
      }
    },
    [addLog, sendFrame]
  );

  const sendStatusQuery = useCallback(async () => {
    if (!bluetoothClient.isConnected) {
      setState((previous) => ({
        ...previous,
        status: {
          ...previous.status,
          phase: "error",
          message: "请先连接洗衣机"
        }
      }));
      addLog("请先连接洗衣机蓝牙设备", "error");
      return;
    }

    clearStatusQueryTimer();
    statusQueryIdRef.current += 1;
    const requestId = statusQueryIdRef.current;

    setState((previous) => ({
      ...previous,
      activeControlTab: "status",
      isSending: true,
      status: {
        ...previous.status,
        requestId,
        phase: "sending",
        message: "正在发送查询",
        requestedAt: currentTime(),
        receivedAt: null
      }
    }));

    try {
      const bytes = buildStatusQueryFrame();
      await bluetoothClient.send(bytes);
      addPacketHistory("tx", "状态查询", bytesToHex(bytes));
      setState((previous) => {
        if (previous.status.requestId !== requestId || previous.status.phase !== "sending") {
          return previous;
        }

        return {
          ...previous,
          status: {
            ...previous.status,
            phase: "waiting",
            message: "等待设备响应"
          }
        };
      });
      armStatusQueryTimer(requestId);
      addLog("状态查询已发送", "success");
    } catch (error) {
      clearStatusQueryTimer();
      setState((previous) => ({
        ...previous,
        status: {
          ...previous.status,
          phase: "error",
          message: errorMessage(error)
        }
      }));
      addLog(errorMessage(error), "error");
    } finally {
      setState((previous) => ({ ...previous, isSending: false }));
    }
  }, [addLog, addPacketHistory, armStatusQueryTimer, bluetoothClient, clearStatusQueryTimer]);

  const sendPreset = useCallback(
    (mode: WasherModeDefinition, level: string) => {
      updateSetting("waterLevel", level);
      void sendFrame(buildControlFrame(mode.code, parseHexByte(level, "水位"), mode.defaultFamily), mode.label);
    },
    [sendFrame, updateSetting]
  );

  const sendPause = useCallback(() => {
    void sendFrame(buildPauseFrame(), "暂停");
  }, [sendFrame]);

  const sendResume = useCallback(() => {
    void sendManualLikeFrame(stateRef.current.settings.pauseHex, "恢复");
  }, [sendManualLikeFrame]);

  const sendBuilder = useCallback(() => {
    const preview = getBuilderPreview(stateRef.current.settings);
    if (!preview.error) {
      void sendFrame(preview.bytes, "自定义生成包");
    }
  }, [sendFrame]);

  const sendManual = useCallback(() => {
    void sendManualLikeFrame(stateRef.current.settings.manualHex, "自定义蓝牙包");
  }, [sendManualLikeFrame]);

  const copyBuilder = useCallback(async () => {
    const preview = getBuilderPreview(stateRef.current.settings);
    if (preview.error) {
      return;
    }

    try {
      await navigator.clipboard.writeText(preview.hex);
      addLog("已复制到剪贴板", "success");
    } catch (error) {
      addLog(`复制失败: ${errorMessage(error)}`, "error");
    }
  }, [addLog]);

  const copyPacketHex = useCallback(
    async (hex: string) => {
      try {
        await navigator.clipboard.writeText(hex);
        addLog("已复制蓝牙指令", "success");
      } catch (error) {
        addLog(`复制失败: ${errorMessage(error)}`, "error");
      }
    },
    [addLog]
  );

  const clearPacketHistory = useCallback(() => {
    setState((previous) => {
      if (previous.packetHistory.length === 0) {
        return previous;
      }

      return {
        ...previous,
        packetHistory: []
      };
    });
  }, []);

  const installPwa = useCallback(async () => {
    if (stateRef.current.appInstalled) {
      addLog("PWA 已安装", "info");
      return;
    }

    if (!installPromptRef.current) {
      addLog("当前浏览器暂未提供安装弹窗，可从浏览器菜单选择安装应用或添加到主屏幕", "info");
      return;
    }

    await installPromptRef.current.prompt();
    await installPromptRef.current.userChoice;
    installPromptRef.current = null;
    setState((previous) => ({ ...previous, canInstall: false }));
  }, [addLog]);

  const applyPwaUpdate = useCallback(async () => {
    if (!stateRef.current.updateAvailable || stateRef.current.isUpdating) {
      return;
    }

    setState((previous) => ({ ...previous, isUpdating: true }));
    const update = pendingUpdateRef.current;
    if (activateServiceWorkerUpdate(update?.registration ?? null)) {
      window.setTimeout(() => void reloadWithFreshBuild(), 3000);
      return;
    }

    await reloadWithFreshBuild();
  }, []);

  const controlContent = getControlContent(state.activeControlTab);

  return (
    <main className="app-shell">
      <div className="app-frame">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">
              <Icon name="droplet" />
            </div>
            <div>
              <h1>FreeWashing</h1>
              <p>宿舍洗衣机蓝牙控制台</p>
            </div>
          </div>
        </header>
        <ModuleLoopToggle seed={state.musicSeed} />

        {state.updateAvailable ? (
          <div className="update-banner" role="status" aria-live="polite">
            <span>检测到新版本</span>
            <button className="button primary compact update-action" type="button" disabled={state.isUpdating} onClick={() => void applyPwaUpdate()}>
              <Icon name="refresh" />
              {state.isUpdating ? "更新中" : "更新"}
            </button>
          </div>
        ) : null}

        <EnvironmentNotice
          bluetoothSupported={bluetoothClient.isSupported}
          secureContext={state.secureContext}
          bluetoothAvailable={state.bluetoothAvailable}
        />
        <AppTabs activeTab={activeAppTab} connected={connected} onChange={setActiveAppTab} />

        <div className="app-view">
          {activeAppTab === "control" ? (
            <ControlTabs activeTab={state.activeControlTab} onChange={setActiveControlTab} onSwipe={shiftControlTab}>
              {controlContent}
            </ControlTabs>
          ) : (
            <ConnectionView
              canInstall={state.canInstall}
              appInstalled={state.appInstalled}
              canUseBluetooth={canUseBluetooth}
              connected={connected}
              connectedDevice={state.connectedDevice}
              grantedDevices={state.grantedDevices}
              isBusy={isBusy}
              selectedGrantedDeviceId={state.selectedGrantedDeviceId}
              supportsRememberedDevices={bluetoothClient.supportsRememberedDevices}
              onConnectGranted={() => void connectGrantedDevice()}
              onConnectNew={() => void connectNewDevice()}
              onDisconnect={disconnect}
              onInstall={() => void installPwa()}
              onRefreshGranted={() => void refreshGrantedDevices(true)}
              onSelectedGrantedDeviceChange={(deviceId) =>
                setState((previous) => ({
                  ...previous,
                  selectedGrantedDeviceId: deviceId
                }))
              }
            />
          )}
        </div>

      </div>
    </main>
  );

  function getControlContent(activeTab: ControlTabId) {
    if (activeTab === "quick") {
      return (
        <QuickControls
          connected={connected}
          isSending={state.isSending}
          onPause={sendPause}
          onPreset={sendPreset}
          onResume={sendResume}
        />
      );
    }

    if (activeTab === "status") {
      return <StatusPanel connected={connected} isSending={state.isSending} status={state.status} onQuery={() => void sendStatusQuery()} />;
    }

    if (activeTab === "builder") {
      return (
        <BuilderPanel
          connected={connected}
          isSending={state.isSending}
          preview={builderPreview}
          settings={state.settings}
          onCopy={() => void copyBuilder()}
          onSend={sendBuilder}
          onSettingChange={updateSetting}
        />
      );
    }

    return (
      <ManualPanel
        connected={connected}
        history={state.packetHistory}
        isSending={state.isSending}
        manualHex={state.settings.manualHex}
        onClearHistory={clearPacketHistory}
        onCopyPacket={(hex) => void copyPacketHex(hex)}
        onManualHexChange={(value) => updateSetting("manualHex", value)}
        onSend={sendManual}
      />
    );
  }
}

function currentTime(): string {
  return new Date().toLocaleTimeString("zh-CN", { hour12: false });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
