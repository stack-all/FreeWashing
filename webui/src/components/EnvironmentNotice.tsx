import { Icon } from "../ui/Icon";

interface EnvironmentNoticeProps {
  bluetoothSupported: boolean;
  secureContext: boolean;
  bluetoothAvailable: boolean | null;
}

export function EnvironmentNotice({
  bluetoothSupported,
  secureContext,
  bluetoothAvailable
}: EnvironmentNoticeProps) {
  if (!bluetoothSupported) {
    return (
      <div className="notice danger">
        <Icon name="bluetooth" />
        当前浏览器没有 Web Bluetooth。请使用 Chrome 或 Edge，并在 Android、Windows、macOS、ChromeOS 等支持平台访问。
      </div>
    );
  }

  if (!secureContext) {
    return (
      <div className="notice danger">
        <Icon name="plug" />
        Web Bluetooth 只在 HTTPS 或 localhost 这类安全上下文中工作。GitHub Pages 部署后会自动满足 HTTPS 条件。
      </div>
    );
  }

  if (bluetoothAvailable === false) {
    return (
      <div className="notice danger">
        <Icon name="bluetooth" />
        浏览器报告蓝牙不可用。请确认系统蓝牙已开启，且浏览器没有禁用 Web Bluetooth。
      </div>
    );
  }

  return null;
}
