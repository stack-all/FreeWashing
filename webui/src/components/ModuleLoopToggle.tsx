import { useRef, useState } from "react";
import { Icon } from "../ui/Icon";

const AUDIO_BASE = `${import.meta.env.BASE_URL}audio/freewashing_8bit_loop`;

export function ModuleLoopToggle() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUnavailable, setIsUnavailable] = useState(false);

  async function togglePlayback(): Promise<void> {
    const audio = audioRef.current;
    if (!audio || isUnavailable) {
      return;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    try {
      audio.volume = 0.36;
      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsUnavailable(true);
      setIsPlaying(false);
    }
  }

  return (
    <div className="module-loop">
      <button
        className={`button ghost compact module-loop-button ${isPlaying ? "active" : ""}`}
        type="button"
        aria-pressed={isPlaying}
        disabled={isUnavailable}
        title={isUnavailable ? "当前浏览器无法播放音频" : "播放或暂停 8-bit 循环音乐"}
        onClick={() => void togglePlayback()}
      >
        <Icon name={isPlaying ? "pause" : "play"} />
        <span>{isUnavailable ? "音频不可用" : "8-bit"}</span>
      </button>
      <audio
        ref={audioRef}
        loop
        preload="none"
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onError={() => setIsUnavailable(true)}
      >
        <source src={`${AUDIO_BASE}.ogg`} type="audio/ogg" />
        <source src={`${AUDIO_BASE}.mod`} type="audio/x-mod" />
      </audio>
    </div>
  );
}
