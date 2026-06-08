import { useCallback, useEffect, useRef, useState } from "react";
import { ModLoopPlayer } from "../audio/modPlayer";
import { Icon } from "../ui/Icon";

const AUDIO_BASE = `${import.meta.env.BASE_URL}audio/freewashing_8bit_loop`;

export function ModuleLoopToggle() {
  const playerRef = useRef<ModLoopPlayer | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const mutedRef = useRef(false);

  const playLoop = useCallback(async () => {
    if (!playerRef.current) {
      playerRef.current = new ModLoopPlayer(`${AUDIO_BASE}.mod`);
    }

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

  const toggleMuted = () => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    playerRef.current?.setMuted(next);
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
