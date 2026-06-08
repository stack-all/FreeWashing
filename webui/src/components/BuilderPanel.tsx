import type { BuilderPreview, SettingField } from "../app/types";
import { byteValue } from "../app/protocolBuilder";
import { parseHexByte } from "../domain/hex";
import {
  CONTROL_TRANSACTION,
  NORMAL_FAMILY,
  QUERY_TRANSACTION,
  resolveFamily,
  WATER_LEVELS,
  WASHER_MODES
} from "../domain/protocol";
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
  const querySelected = settings.builderTransaction === "query";
  const transactionValue =
    settings.builderTransaction === "custom"
      ? settings.customTransaction
      : byteValue(settings.builderTransaction === "query" ? QUERY_TRANSACTION : CONTROL_TRANSACTION);
  const familyValue = querySelected ? byteValue(NORMAL_FAMILY) : getFamilyValue(settings);
  const modeValue = querySelected ? "00" : settings.builderMode === "custom" ? settings.customMode : settings.builderMode;
  const parameterValue = querySelected ? "00" : getParameterValue(settings);

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
          <BuilderValueInput
            id="custom-transaction"
            aria-label="自定义 TT"
            editable={settings.builderTransaction === "custom"}
            value={transactionValue}
            onChange={(value) => onSettingChange("customTransaction", value)}
          />
        </div>

        <div className={`builder-field ${querySelected ? "inactive" : ""}`}>
          <label htmlFor="builder-family">CC 命令族</label>
          <select
            className="select"
            id="builder-family"
            value={querySelected ? "9A" : settings.builderFamily}
            disabled={querySelected}
            onChange={(event) => onSettingChange("builderFamily", event.target.value)}
          >
            <option value="auto">自动推导</option>
            <option value="9A">9A 普通</option>
            <option value="9B">9B 特殊</option>
            <option value="custom">自定义</option>
          </select>
          <BuilderValueInput
            id="custom-family"
            aria-label="自定义 CC"
            editable={!querySelected && settings.builderFamily === "custom"}
            value={familyValue}
            onChange={(value) => onSettingChange("customFamily", value)}
          />
        </div>

        <div className={`builder-field ${querySelected ? "inactive" : ""}`}>
          <label htmlFor="builder-mode">MM 模式</label>
          <select
            className="select"
            id="builder-mode"
            value={querySelected ? "00" : settings.builderMode}
            disabled={querySelected}
            onChange={(event) => onSettingChange("builderMode", event.target.value)}
          >
            {querySelected ? <option value="00">00 查询</option> : null}
            {WASHER_MODES.map((mode) => (
              <option value={byteValue(mode.code)} key={mode.id}>
                {byteValue(mode.code)} {mode.label}
              </option>
            ))}
            <option value="custom">自定义</option>
          </select>
          <BuilderValueInput
            id="custom-mode"
            aria-label="自定义 MM"
            editable={!querySelected && settings.builderMode === "custom"}
            value={modeValue}
            onChange={(value) => onSettingChange("customMode", value)}
          />
        </div>

        <div className={`builder-field ${querySelected ? "inactive" : ""}`}>
          <label htmlFor="builder-parameter">LL 参数</label>
          <select
            className="select"
            id="builder-parameter"
            value={querySelected ? "00" : settings.builderParameter}
            disabled={querySelected}
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
          <BuilderValueInput
            id="custom-parameter"
            aria-label="自定义 LL"
            editable={!querySelected && settings.builderParameter === "custom"}
            value={parameterValue}
            onChange={(value) => onSettingChange("customParameter", value)}
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

interface BuilderValueInputProps {
  id: string;
  "aria-label": string;
  editable: boolean;
  value: string;
  onChange: (value: string) => void;
}

function BuilderValueInput({ id, editable, value, onChange, "aria-label": ariaLabel }: BuilderValueInputProps) {
  return (
    <input
      className={`input mono builder-value ${editable ? "editable" : "derived"}`}
      id={id}
      aria-label={editable ? ariaLabel : `${ariaLabel} 当前值`}
      value={value}
      readOnly={!editable}
      spellCheck={false}
      title={editable ? "自定义输入" : "根据左侧选项生成"}
      onChange={editable ? (event) => onChange(event.target.value) : undefined}
    />
  );
}

function getFamilyValue(settings: StoredSettings): string {
  if (settings.builderFamily === "custom") {
    return settings.customFamily;
  }

  if (settings.builderFamily !== "auto") {
    return settings.builderFamily;
  }

  const mode = parseOptionalByte(settings.builderMode === "custom" ? settings.customMode : settings.builderMode);
  return mode === null ? "--" : byteValue(resolveFamily(mode));
}

function getParameterValue(settings: StoredSettings): string {
  if (settings.builderParameter === "custom") {
    return settings.customParameter;
  }

  if (settings.builderParameter === "water") {
    return settings.waterLevel;
  }

  return settings.builderParameter;
}

function parseOptionalByte(value: string): number | null {
  try {
    return parseHexByte(value, "字节");
  } catch {
    return null;
  }
}
