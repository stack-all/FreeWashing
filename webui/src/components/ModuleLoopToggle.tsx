import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../ui/Icon";

const AUDIO_BASE = `${import.meta.env.BASE_URL}audio/freewashing_8bit_loop`;

export function ModuleLoopToggle() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const mutedRef = useRef(false);

  const playLoop = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.volume = 0.36;
    audio.muted = mutedRef.current;
    try {
      await audio.play();
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
    };
  }, [playLoop]);

  const resumeAfterPause = () => {
    window.setTimeout(() => void playLoop(), 250);
  };

  const toggleMuted = () => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    if (audioRef.current) {
      audioRef.current.muted = next;
    }
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
      <audio
        ref={audioRef}
        autoPlay
        hidden
        loop
        preload="auto"
        src={`${AUDIO_BASE}.mod`}
        onCanPlay={() => void playLoop()}
        onPause={resumeAfterPause}
      >
        <source src={`${AUDIO_BASE}.mod`} type="audio/x-mod" />
      </audio>
    </>
  );
}
