import type { StatusViewState } from "../app/types";
import { Icon } from "../ui/Icon";

interface StatusPanelProps {
  connected: boolean;
  isSending: boolean;
  status: StatusViewState;
  onQuery: () => void;
}

export function StatusPanel({ connected, isSending, status, onQuery }: StatusPanelProps) {
  const parsed = status.parsed;
  const phase = getStatusPhaseLabel(status);

  return (
    <div className="tab-pane-content status-layout">
      <div className="status-main">
        <div className="status-head">
          <div>
            <span className="preview-label">当前状态</span>
            <strong>{parsed ? parsed.deviceStateLabel : "暂无状态"}</strong>
          </div>
          <span className="badge status-badge">
            <span className={`status-dot ${phase.dotClass}`} />
            {phase.label}
          </span>
        </div>

        <div className="metric-grid status-metrics">
          <StatusMetric label="洗涤阶段" value={parsed?.washingStateLabel ?? "-"} />
          <StatusMetric label="程序" value={parsed?.modeLabel ?? "-"} />
          <StatusMetric label="剩余时间" value={parsed ? `${parsed.remainingMinutes} 分钟` : "-"} />
          <StatusMetric label="水位" value={parsed?.waterLevelLabel ?? "-"} />
        </div>
      </div>

      <div className="status-side stack-sm">
        <button className="button indigo" type="button" disabled={!connected || isSending} onClick={onQuery}>
          <Icon name="radio" />
          {status.phase === "sending" ? "发送中" : "查询状态"}
        </button>
        <div className={`status-message ${status.phase === "error" || status.phase === "timeout" ? "warn" : ""}`}>
          <strong>{status.message}</strong>
          <span>{renderStatusTimeLine(status)}</span>
        </div>
      </div>
    </div>
  );
}

function StatusMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function renderStatusTimeLine(status: StatusViewState): string {
  const lines = [
    status.requestedAt ? `查询 ${status.requestedAt}` : "",
    status.receivedAt ? `响应 ${status.receivedAt}` : ""
  ].filter(Boolean);
  return lines.length > 0 ? lines.join(" / ") : "尚未查询";
}

function getStatusPhaseLabel(status: StatusViewState): { label: string; dotClass: "ok" | "warn" | "err" } {
  switch (status.phase) {
    case "received":
      return status.parsed?.validCrc === false ? { label: "校验异常", dotClass: "warn" } : { label: "已更新", dotClass: "ok" };
    case "sending":
    case "waiting":
      return { label: "查询中", dotClass: "warn" };
    case "timeout":
      return { label: "无响应", dotClass: "err" };
    case "error":
    case "unknown":
      return { label: "异常", dotClass: "err" };
    case "idle":
    default:
      return { label: "待查询", dotClass: "warn" };
  }
}
