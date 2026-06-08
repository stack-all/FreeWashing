import type { AppTabId } from "../app/types";
import { Icon } from "../ui/Icon";

interface AppTabsProps {
  activeTab: AppTabId;
  connected: boolean;
  onChange: (tab: AppTabId) => void;
}

export function AppTabs({ activeTab, connected, onChange }: AppTabsProps) {
  return (
    <nav className="app-tabs" role="tablist" aria-label="应用页面">
      <button
        className={`app-tab ${activeTab === "connect" ? "active" : ""}`}
        type="button"
        role="tab"
        aria-selected={activeTab === "connect"}
        onClick={() => onChange("connect")}
      >
        <Icon name="bluetooth" />
        <span>连接</span>
      </button>
      <button
        className={`app-tab ${activeTab === "control" ? "active" : ""}`}
        type="button"
        role="tab"
        aria-selected={activeTab === "control"}
        aria-disabled={!connected}
        disabled={!connected}
        onClick={() => onChange("control")}
      >
        <Icon name="droplet" />
        <span>操作</span>
      </button>
    </nav>
  );
}
