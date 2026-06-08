import { Icon } from "../ui/Icon";

interface ManualPanelProps {
  connected: boolean;
  isSending: boolean;
  manualHex: string;
  onManualHexChange: (value: string) => void;
  onSend: () => void;
}

export function ManualPanel({ connected, isSending, manualHex, onManualHexChange, onSend }: ManualPanelProps) {
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
    </div>
  );
}
