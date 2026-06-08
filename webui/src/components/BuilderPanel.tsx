import type { BuilderPreview, SettingField } from "../app/types";
import { byteValue } from "../app/protocolBuilder";
import { WATER_LEVELS, WASHER_MODES } from "../domain/protocol";
import type { StoredSettings } from "../services/storage";
import { Icon } from "../ui/Icon";

interface BuilderPanelProps {
  connected: boolean;
  isSending: boolean;
  preview: BuilderPreview;
  settings: StoredSettings;
  onCopy: () => void;
  onSend: () => void;
  onSettingChange: (key: SettingField, value: string) => void;
}

export function BuilderPanel({
  connected,
  isSending,
  preview,
  settings,
  onCopy,
  onSend,
  onSettingChange
}: BuilderPanelProps) {
  return (
    <div className="tab-pane-content builder-body">
      <div className="builder-matrix">
        <div className="builder-field">
          <label htmlFor="builder-transaction">TT 操作</label>
          <select
            className="select"
            id="builder-transaction"
            value={settings.builderTransaction}
            onChange={(event) => onSettingChange("builderTransaction", event.target.value)}
          >
            <option value="control">01 控制</option>
            <option value="query">00 查询</option>
            <option value="custom">自定义</option>
          </select>
          <input
            className="input mono"
            id="custom-transaction"
            aria-label="自定义 TT"
            value={settings.customTransaction}
            spellCheck={false}
            onChange={(event) => onSettingChange("customTransaction", event.target.value)}
          />
        </div>

        <div className="builder-field">
          <label htmlFor="builder-family">CC 命令族</label>
          <select
            className="select"
            id="builder-family"
            value={settings.builderFamily}
            onChange={(event) => onSettingChange("builderFamily", event.target.value)}
          >
            <option value="auto">自动推导</option>
            <option value="9A">9A 普通</option>
            <option value="9B">9B 特殊</option>
            <option value="custom">自定义</option>
          </select>
          <input
            className="input mono"
            id="custom-family"
            aria-label="自定义 CC"
            value={settings.customFamily}
            spellCheck={false}
            onChange={(event) => onSettingChange("customFamily", event.target.value)}
          />
        </div>

        <div className="builder-field">
          <label htmlFor="builder-mode">MM 模式</label>
          <select
            className="select"
            id="builder-mode"
            value={settings.builderMode}
            onChange={(event) => onSettingChange("builderMode", event.target.value)}
          >
            {WASHER_MODES.map((mode) => (
              <option value={byteValue(mode.code)} key={mode.id}>
                {byteValue(mode.code)} {mode.label}
              </option>
            ))}
            <option value="custom">自定义</option>
          </select>
          <input
            className="input mono"
            id="custom-mode"
            aria-label="自定义 MM"
            value={settings.customMode}
            spellCheck={false}
            onChange={(event) => onSettingChange("customMode", event.target.value)}
          />
        </div>

        <div className="builder-field">
          <label htmlFor="builder-parameter">LL 参数</label>
          <select
            className="select"
            id="builder-parameter"
            value={settings.builderParameter}
            onChange={(event) => onSettingChange("builderParameter", event.target.value)}
          >
            <option value="water">最近水位</option>
            <option value="00">00 无参数</option>
            {WATER_LEVELS.map((level) => (
              <option value={byteValue(level.code)} key={level.id}>
                {byteValue(level.code)} {level.label.replace("水位", "")}
              </option>
            ))}
            <option value="custom">自定义</option>
          </select>
          <input
            className="input mono"
            id="custom-parameter"
            aria-label="自定义 LL"
            value={settings.customParameter}
            spellCheck={false}
            onChange={(event) => onSettingChange("customParameter", event.target.value)}
          />
        </div>
      </div>

      <div className={`preview ${preview.error ? "error" : ""}`}>
        <span className="preview-label">生成结果</span>
        <code>{preview.error ?? preview.hex}</code>
      </div>

      <div className="builder-actions">
        <button className="button primary" type="button" disabled={!connected || isSending || Boolean(preview.error)} onClick={onSend}>
          <Icon name="send" />
          发送生成包
        </button>
        <button className="button ghost" type="button" disabled={Boolean(preview.error)} onClick={onCopy}>
          <Icon name="copy" />
          复制生成包
        </button>
      </div>
    </div>
  );
}
