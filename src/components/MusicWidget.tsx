import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MUSIC_TRACKS, SITE_CONFIG } from '../data/siteContent';
import { AmbientSynthPlayer } from '../audio/synthPlayer';

interface MusicWidgetProps {
  showCaption: boolean;
}

export function MusicWidget({ showCaption }: MusicWidgetProps) {
  const playerRef = useRef<AmbientSynthPlayer | null>(null);
  const [trackIndex, setTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const track = MUSIC_TRACKS[trackIndex];

  useEffect(() => {
    playerRef.current = new AmbientSynthPlayer();
    return () => {
      playerRef.current?.dispose();
      playerRef.current = null;
    };
  }, []);

  const handleTogglePlay = async () => {
    const p = playerRef.current;
    if (!p) return;
    if (isPlaying) {
      p.pause();
      setIsPlaying(false);
    } else {
      await p.play(track.preset);
      setIsPlaying(true);
    }
  };

  const handleNext = async () => {
    const nextIdx = (trackIndex + 1) % MUSIC_TRACKS.length;
    setTrackIndex(nextIdx);
    const p = playerRef.current;
    if (p) {
      p.setPreset(MUSIC_TRACKS[nextIdx].preset);
      if (!isPlaying) {
        await p.play(MUSIC_TRACKS[nextIdx].preset);
        setIsPlaying(true);
      }
    }
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    playerRef.current?.setMuted(next);
  };

  return (
    <div className="music-widget" aria-label="Ambient audio player">
      <AnimatePresence>
        {showCaption && (
          <motion.div
            className="music-caption"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.25 }}
            aria-hidden="true"
          >
            <div className="music-caption-text">
              <span>{SITE_CONFIG.musicCaptionLines[0]}</span>
              <span>{SITE_CONFIG.musicCaptionLines[1]}</span>
            </div>
            <svg
              className="music-caption-arrow"
              width="34"
              height="26"
              viewBox="0 0 34 26"
              fill="none"
            >
              <path
                d="M27 3 C 18 6, 11 13, 8 22 M 4 17 L 7.8 22.8 L 13.5 19.5"
                stroke="#c4c3cc"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="music-pill" role="region" aria-label="Music controls">
        <button
          type="button"
          className="music-btn music-play"
          onClick={handleTogglePlay}
          aria-label={isPlaying ? 'Pause ambient track' : 'Play ambient track'}
        >
          {isPlaying ? '❚❚' : '▶'}
        </button>

        <span
          className={`music-title ${isPlaying ? 'is-playing' : ''}`}
          title={track.title}
        >
          {track.title}
        </span>

        <div className="music-actions">
          <button
            type="button"
            className="music-btn"
            onClick={handleToggleMute}
            aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? '▽' : '▲'}
          </button>
          <a
            className="music-btn"
            href={track.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open track notes"
            title="Track notes"
          >
            ↗
          </a>
          <button
            type="button"
            className="music-btn"
            onClick={handleNext}
            aria-label="Next ambient track"
            title="Next track"
          >
            ⏭
          </button>
        </div>
      </div>
    </div>
  );
}
