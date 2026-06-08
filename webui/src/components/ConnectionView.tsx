import type { BluetoothDeviceSummary, ConnectedDevice } from "../services/bluetooth";
import { Icon } from "../ui/Icon";

interface ConnectionViewProps {
  canInstall: boolean;
  appInstalled: boolean;
  canUseBluetooth: boolean;
  connected: boolean;
  connectedDevice: ConnectedDevice | null;
  grantedDevices: BluetoothDeviceSummary[];
  isBusy: boolean;
  selectedGrantedDeviceId: string;
  supportsRememberedDevices: boolean;
  onConnectGranted: () => void;
  onConnectNew: () => void;
  onDisconnect: () => void;
  onInstall: () => void;
  onRefreshGranted: () => void;
  onSelectedGrantedDeviceChange: (deviceId: string) => void;
}

export function ConnectionView({
  canInstall,
  appInstalled,
  canUseBluetooth,
  connected,
  connectedDevice,
  grantedDevices,
  isBusy,
  selectedGrantedDeviceId,
  supportsRememberedDevices,
  onConnectGranted,
  onConnectNew,
  onDisconnect,
  onInstall,
  onRefreshGranted,
  onSelectedGrantedDeviceChange
}: ConnectionViewProps) {
  return (
    <section className="connection-view stack-sm">
      <button
        className="button ghost install-action"
        type="button"
        disabled={appInstalled}
        title={canInstall ? "安装应用" : "也可以从浏览器菜单安装或添加到主屏幕"}
        onClick={onInstall}
      >
        <Icon name="download" />
        {appInstalled ? "已安装 PWA" : "安装 PWA"}
      </button>
      <section className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <Icon name="bluetooth" />
            <div>
              <h2>设备连接</h2>
              <p>{connected ? connectedDevice?.name ?? "已连接" : "选择或恢复已授权设备"}</p>
            </div>
          </div>
          <span className="badge">
            <span className={`status-dot ${connected ? "ok" : "err"}`} />
            {connected ? "已连接" : "未连接"}
          </span>
        </div>
        <div className="panel-body stack-sm">
          {supportsRememberedDevices ? (
            <div className="form-row">
              <label htmlFor="known-device">已授权设备</label>
              <select
                className="select"
                id="known-device"
                value={selectedGrantedDeviceId}
                disabled={grantedDevices.length === 0}
                onChange={(event) => onSelectedGrantedDeviceChange(event.target.value)}
              >
                {grantedDevices.length === 0 ? (
                  <option value="">暂无已授权设备</option>
                ) : (
                  grantedDevices.map((device) => (
                    <option value={device.id} key={device.id}>
                      {device.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          ) : (
            <div className="notice info">当前浏览器没有开放已授权设备列表。首次选择设备仍可连接，但刷新后无法免弹窗恢复。</div>
          )}

          <div className="connection-actions">
            <button
              className="button primary connection-primary"
              type="button"
              disabled={isBusy || !canUseBluetooth}
              onClick={onConnectNew}
            >
              <Icon name="search" />
              扫描新设备
            </button>
            <button
              className="button indigo"
              type="button"
              disabled={isBusy || !canUseBluetooth || grantedDevices.length === 0}
              onClick={onConnectGranted}
            >
              <Icon name="plug" />
              连接已授权
            </button>
            <button
              className="button ghost"
              type="button"
              disabled={!supportsRememberedDevices || !canUseBluetooth}
              onClick={onRefreshGranted}
            >
              <Icon name="refresh" />
              刷新列表
            </button>
            <button className="button rose" type="button" disabled={!connected} onClick={onDisconnect}>
              <Icon name="power" />
              断开
            </button>
          </div>
        </div>
      </section>
    </section>
  );
}
