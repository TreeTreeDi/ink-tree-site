import { useEffect, useRef, useState } from 'react';
import {
  BIO_PARAGRAPHS,
  UPDATE_ENTRIES,
  WORK_LINKS,
  WRITING_POSTS,
  type BranchId,
} from '../data/siteContent';
import { InkTreeScene, type HitTargetScreen } from '../tree/InkTreeScene';
import { BackButton } from '../components/BackButton';
import { MusicWidget } from '../components/MusicWidget';

interface HomePageProps {
  onNavigate: (route: string) => void;
}

export function HomePage({ onNavigate }: HomePageProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<InkTreeScene | null>(null);
  const [activeBranch, setActiveBranch] = useState<BranchId | null>(null);
  const [hitTargets, setHitTargets] = useState<HitTargetScreen[]>([]);
  const [announcement, setAnnouncement] = useState<string>('');

  useEffect(() => {
    document.documentElement.classList.remove('is-post-page');
    let disposed = false;

    const init = async () => {
      try {
        await Promise.race([
          document.fonts.ready,
          new Promise((resolve) => setTimeout(resolve, 600)),
        ]);
      } catch {
        // Proceed even if FontFaceSet check rejects
      }
      if (disposed || !hostRef.current) return;

      const scene = new InkTreeScene(hostRef.current, {
        onSelectBranch: (branch) => {
          setActiveBranch(branch);
          setAnnouncement(branch ? `Opened ${branch} branch` : 'Returned to tree overview');
        },
        onNavigateRoute: (route) => {
          onNavigate(route);
        },
        onHoverChange: (_id, caption) => {
          if (caption) setAnnouncement(caption);
        },
        onHitTargetsUpdate: (targets) => {
          setHitTargets(targets);
        },
      });
      sceneRef.current = scene;
    };

    void init();

    return () => {
      disposed = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [onNavigate]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const scene = sceneRef.current;
      if (!scene) return;
      if (e.key === 'Escape' && activeBranch !== null) {
        e.preventDefault();
        scene.selectBranch(null);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        scene.panBy(-55, 0);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        scene.panBy(55, 0);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        scene.panBy(0, 55);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        scene.panBy(0, -55);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeBranch]);

  const handleBack = () => {
    sceneRef.current?.selectBranch(null);
  };

  const handleTargetActivate = (t: HitTargetScreen) => {
    if (t.kind === 'branch' && t.branchId) {
      sceneRef.current?.selectBranch(activeBranch === t.branchId ? null : t.branchId);
    } else if (t.kind === 'route' && t.href) {
      onNavigate(t.href);
    } else if (t.kind === 'external' && t.href) {
      window.open(t.href, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <main className="tree-page" aria-label="Interactive ink tree home">
      <div ref={hostRef} className="tree-canvas-host" />

      {/* Synchronized keyboard & screen-reader interactive hit targets */}
      <div className="tree-hit-layer">
        {hitTargets.map((t) => {
          const style: React.CSSProperties = {
            left: `${t.x - t.w * 0.5}px`,
            top: `${t.y - t.h * 0.5}px`,
            width: `${t.w}px`,
            height: `${t.h}px`,
          };
          if (t.kind === 'route' || t.kind === 'external') {
            const isExt = t.kind === 'external';
            return (
              <a
                key={t.id}
                href={t.href}
                className="tree-hit-target"
                style={style}
                target={isExt && t.href?.startsWith('http') ? '_blank' : undefined}
                rel={isExt && t.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                aria-label={t.label}
                onFocus={() => sceneRef.current?.setExternalHover(t.id)}
                onBlur={() => sceneRef.current?.setExternalHover(null)}
                onClick={(e) => {
                  if (!isExt && t.href) {
                    e.preventDefault();
                    onNavigate(t.href);
                  }
                }}
              />
            );
          }
          return (
            <button
              key={t.id}
              type="button"
              className="tree-hit-target"
              style={style}
              aria-label={t.label}
              aria-expanded={t.branchId ? activeBranch === t.branchId : undefined}
              onFocus={() => sceneRef.current?.setExternalHover(t.id)}
              onBlur={() => sceneRef.current?.setExternalHover(null)}
              onClick={() => handleTargetActivate(t)}
            />
          );
        })}
      </div>

      {/* Offscreen semantic mirror for crawlers and screen readers */}
      <nav className="sr-only" aria-label="Site structure">
        <h2>Branches</h2>
        <ul>
          <li>
            <button type="button" onClick={() => sceneRef.current?.selectBranch('me')}>
              me
            </button>
            <div>
              {BIO_PARAGRAPHS.map((p) => (
                <p key={p.id}>{p.segments.map((s) => s.text).join('')}</p>
              ))}
            </div>
          </li>
          <li>
            <button type="button" onClick={() => sceneRef.current?.selectBranch('writing')}>
              writing
            </button>
            <ul>
              {WRITING_POSTS.map((w) => (
                <li key={w.id}>
                  <a
                    href={w.route}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(w.route);
                    }}
                  >
                    {w.label} — {w.dateLabel}
                  </a>
                </li>
              ))}
            </ul>
          </li>
          <li>
            <button type="button" onClick={() => sceneRef.current?.selectBranch('updates')}>
              updates
            </button>
            <ul>
              {UPDATE_ENTRIES.map((u) => (
                <li key={u.id}>
                  <a
                    href={u.route}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(u.route);
                    }}
                  >
                    {u.label} ({u.dateISO})
                  </a>
                </li>
              ))}
            </ul>
          </li>
          <li>
            <button type="button" onClick={() => sceneRef.current?.selectBranch('work')}>
              work with me
            </button>
            <ul>
              {WORK_LINKS.map((wl) => (
                <li key={wl.id}>
                  <a href={wl.href}>{wl.label}</a>
                </li>
              ))}
            </ul>
          </li>
        </ul>
      </nav>

      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>

      <BackButton visible={activeBranch !== null} onBack={handleBack} />
      <MusicWidget showCaption={activeBranch === null} />
    </main>
  );
}
