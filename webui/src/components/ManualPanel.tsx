import type { BluetoothPacketEntry } from "../app/types";
import { Icon } from "../ui/Icon";

interface ManualPanelProps {
  connected: boolean;
  history: BluetoothPacketEntry[];
  isSending: boolean;
  manualHex: string;
  onCopyPacket: (hex: string) => void;
  onManualHexChange: (value: string) => void;
  onSend: () => void;
}

export function ManualPanel({ connected, history, isSending, manualHex, onCopyPacket, onManualHexChange, onSend }: ManualPanelProps) {
  return (
    <div className="tab-pane-content stack-sm">
      <textarea
        className="textarea"
        id="manual-hex"
        spellCheck={false}
        placeholder="AA 01 9A 03 03 9B 2E 55"
        value={manualHex}
        onChange={(event) => onManualHexChange(event.target.value)}
      />
      <button className="button primary" type="button" disabled={!connected || isSending} onClick={onSend}>
        <Icon name="send" />
        发送自定义包
      </button>
      <section className="packet-history" aria-label="蓝牙收发历史">
        <div className="packet-history-head">
          <strong>蓝牙历史</strong>
          <span>最近 {history.length} 条</span>
        </div>
        {history.length > 0 ? (
          <div className="packet-list">
            {history.map((entry) => (
              <article
                className={`packet-entry ${entry.direction}`}
                key={entry.id}
                role="button"
                tabIndex={0}
                aria-label={`复制${entry.operation}蓝牙指令`}
                title="双击复制蓝牙指令"
                onDoubleClick={() => onCopyPacket(entry.hex)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onCopyPacket(entry.hex);
                  }
                }}
              >
                <div className="packet-entry-top">
                  <span className={`packet-direction ${entry.direction}`}>{entry.direction === "tx" ? "发送" : "响应"}</span>
                  <strong>{entry.operation}</strong>
                  <time>{entry.time}</time>
                </div>
                <code>{entry.hex}</code>
              </article>
            ))}
          </div>
        ) : (
          <div className="packet-empty">暂无蓝牙包</div>
        )}
      </section>
    </div>
  );
}
