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
    <div
      className={`music-widget ${showCaption ? '' : 'has-back'}`}
      aria-label="Ambient audio player"
    >
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
            <svg
              className="music-caption-arrow"
              width="28"
              height="28"
              viewBox="0 0 28 28"
              fill="none"
            >
              <path
                d="M24 5 C 12 6, 7 15, 11 24 M 6.5 20.5 L 11.2 25 L 15.2 19.6"
                stroke="#c4c3cc"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="music-caption-text">
              <span>{SITE_CONFIG.musicCaptionLines[0]}</span>
              <span>{SITE_CONFIG.musicCaptionLines[1]}</span>
            </div>
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
          {isPlaying ? (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <rect x="2" y="1.5" width="2" height="7" fill="currentColor" />
              <rect x="6" y="1.5" width="2" height="7" fill="currentColor" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <path d="M2 1.2L8.8 5L2 8.8Z" fill="currentColor" />
            </svg>
          )}
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
            {isMuted ? (
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                <path
                  d="M5 2L8.6 8H1.4Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.25"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                <path d="M5 1.8L8.8 8H1.2Z" fill="currentColor" />
              </svg>
            )}
          </button>
          <a
            className="music-btn"
            href={track.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open track notes"
            title="Track notes"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <path
                d="M2.2 7.8L7.8 2.2M3.6 2.2H7.8V6.4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.35"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
          <button
            type="button"
            className="music-btn"
            onClick={handleNext}
            aria-label="Next ambient track"
            title="Next track"
          >
            <svg width="12" height="10" viewBox="0 0 12 10" aria-hidden="true">
              <path d="M1 1.7L5.3 5L1 8.3Z M5.6 1.7L9.9 5L5.6 8.3Z" fill="currentColor" />
              <rect x="10.2" y="1.8" width="1.2" height="6.4" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
