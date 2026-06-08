import { useRef, type ReactNode, type TouchEvent } from "react";
import { CONTROL_TABS, type ControlTabId } from "../app/types";
import { Icon } from "../ui/Icon";

interface ControlTabsProps {
  activeTab: ControlTabId;
  children: ReactNode;
  onChange: (tab: ControlTabId) => void;
  onSwipe: (delta: number) => void;
}

export function ControlTabs({ activeTab, children, onChange, onSwipe }: ControlTabsProps) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);

  function handleTouchStart(event: TouchEvent<HTMLElement>): void {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("button, input, select, textarea")) {
      startX.current = null;
      startY.current = null;
      return;
    }

    const touch = event.touches[0];
    startX.current = touch.clientX;
    startY.current = touch.clientY;
  }

  function handleTouchEnd(event: TouchEvent<HTMLElement>): void {
    if (startX.current === null || startY.current === null) {
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - startX.current;
    const deltaY = touch.clientY - startY.current;
    startX.current = null;
    startY.current = null;

    if (Math.abs(deltaX) < 45 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) {
      return;
    }

    onSwipe(deltaX < 0 ? 1 : -1);
  }

  return (
    <section className="panel control-tabs-panel" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="tab-strip" role="tablist" aria-label="洗衣机控制">
        {CONTROL_TABS.map((tab) => (
          <button
            className={`tab-button ${tab.id === activeTab ? "active" : ""}`}
            type="button"
            role="tab"
            aria-selected={tab.id === activeTab}
            key={tab.id}
            onClick={() => onChange(tab.id)}
          >
            <Icon name={tab.iconName} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
      <div className="tab-panel" data-active-tab={activeTab}>
        {children}
      </div>
    </section>
  );
}
