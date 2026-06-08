import { byteValue } from "../app/protocolBuilder";
import { NORMAL_FAMILY, SPECIAL_FAMILY, WATER_LEVELS, WASHER_MODES, type WasherModeDefinition } from "../domain/protocol";
import { Icon } from "../ui/Icon";

interface QuickControlsProps {
  connected: boolean;
  isSending: boolean;
  onPause: () => void;
  onPreset: (mode: WasherModeDefinition, level: string) => void;
  onResume: () => void;
}

export function QuickControls({ connected, isSending, onPause, onPreset, onResume }: QuickControlsProps) {
  const normalModes = WASHER_MODES.filter((mode) => mode.defaultFamily === NORMAL_FAMILY);
  const specialModes = WASHER_MODES.filter((mode) => mode.defaultFamily === SPECIAL_FAMILY);

  return (
    <div className="tab-pane-content stack">
      <div className="mode-list">
        {normalModes.map((mode) => (
          <article className="mode-card" key={mode.id}>
            <h3>{mode.label}</h3>
            <div className="water-action-grid" aria-label={`${mode.label}水位`}>
              {WATER_LEVELS.map((level) => (
                <button
                  className="button compact water-action"
                  type="button"
                  key={level.id}
                  disabled={!connected || isSending}
                  onClick={() => onPreset(mode, byteValue(level.code))}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="special-grid">
        {specialModes.map((mode) => (
          <button
            className="button special-mode"
            type="button"
            key={mode.id}
            disabled={!connected || isSending}
            onClick={() => onPreset(mode, byteValue(mode.defaultParameter))}
          >
            <span>{mode.label}</span>
          </button>
        ))}
      </div>

      <div className="quick-actions">
        <button className="button amber" type="button" disabled={!connected || isSending} onClick={onPause}>
          <Icon name="pause" />
          暂停
        </button>
        <button className="button primary" type="button" disabled={!connected || isSending} onClick={onResume}>
          <Icon name="play" />
          恢复
        </button>
      </div>
    </div>
  );
}
