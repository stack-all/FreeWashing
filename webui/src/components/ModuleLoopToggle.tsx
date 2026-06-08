import { useCallback, useEffect, useRef, useState } from "react";
import { ChiptuneLoopPlayer } from "../audio/chiptunePlayer";
import { Icon } from "../ui/Icon";

const MUTE_STORAGE_KEY = "freewashing.audio-muted.v1";

interface ModuleLoopToggleProps {
  seed: string;
}

export function ModuleLoopToggle({ seed }: ModuleLoopToggleProps) {
  const playerRef = useRef<ChiptuneLoopPlayer | null>(null);
  const [isMuted, setIsMuted] = useState(readStoredMutedState);
  const mutedRef = useRef(isMuted);
  const seedRef = useRef(seed);

  const playLoop = useCallback(async () => {
    if (!playerRef.current) {
      playerRef.current = new ChiptuneLoopPlayer(seedRef.current);
    }

    playerRef.current.setSeed(seedRef.current);
    playerRef.current.setMuted(mutedRef.current);
    try {
      await playerRef.current.play();
    } catch {
      // 浏览器可能会拦截带声音的自动播放，后续用户首次交互时会再次触发。
    }
  }, []);

  useEffect(() => {
    void playLoop();

    const resumePlayback = () => void playLoop();
    const resumeWhenVisible = () => {
      if (!document.hidden) {
        void playLoop();
      }
    };

    window.addEventListener("pointerdown", resumePlayback, { passive: true });
    window.addEventListener("touchstart", resumePlayback, { passive: true });
    window.addEventListener("click", resumePlayback, { passive: true });
    window.addEventListener("keydown", resumePlayback);
    document.addEventListener("visibilitychange", resumeWhenVisible);

    return () => {
      window.removeEventListener("pointerdown", resumePlayback);
      window.removeEventListener("touchstart", resumePlayback);
      window.removeEventListener("click", resumePlayback);
      window.removeEventListener("keydown", resumePlayback);
      document.removeEventListener("visibilitychange", resumeWhenVisible);
      playerRef.current?.dispose();
      playerRef.current = null;
    };
  }, [playLoop]);

  useEffect(() => {
    seedRef.current = seed;
    playerRef.current?.setSeed(seed);
    if (!mutedRef.current) {
      void playLoop();
    }
  }, [playLoop, seed]);

  const toggleMuted = () => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    playerRef.current?.setMuted(next);
    writeStoredMutedState(next);
    setIsMuted(next);
    if (!next) {
      void playLoop();
    }
  };

  return (
    <>
      <button
        className={`module-mute-button ${isMuted ? "muted" : ""}`}
        type="button"
        aria-label={isMuted ? "取消静音背景音乐" : "静音背景音乐"}
        aria-pressed={isMuted}
        title={isMuted ? "取消静音" : "静音"}
        onClick={toggleMuted}
      >
        <Icon name={isMuted ? "volumeOff" : "volume"} />
      </button>
    </>
  );
}

function readStoredMutedState(): boolean {
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeStoredMutedState(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, muted ? "1" : "0");
  } catch {
    // 存储不可用时只影响跨会话记忆，本次运行仍可切换静音。
  }
}
