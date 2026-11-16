import { useEffect } from 'react';
import type { PostRecord } from '../content/registry';
import { SITE_CONFIG } from '../data/siteContent';

interface PostPageProps {
  post: PostRecord;
  onNavigate: (route: string) => void;
}

export function PostPage({ post, onNavigate }: PostPageProps) {
  const { meta, Component } = post;

  useEffect(() => {
    document.documentElement.classList.add('is-post-page');
    const prevTitle = document.title;
    document.title = `${meta.title} — ${SITE_CONFIG.title}`;
    window.scrollTo(0, 0);
    return () => {
      document.documentElement.classList.remove('is-post-page');
      document.title = prevTitle;
    };
  }, [meta.title]);

  return (
    <div className="post-page">
      <aside className="post-cta" aria-label="Booking link">
        <div>
          {SITE_CONFIG.ctaLine1}
          <a href={SITE_CONFIG.bookingHref} target="_blank" rel="noopener noreferrer">
            {SITE_CONFIG.ctaHighlight}
          </a>
          {SITE_CONFIG.ctaLine1End}
        </div>
        <div>{SITE_CONFIG.ctaLine2}</div>
      </aside>

      <article className="post-container">
        <a
          href="/"
          className="post-back"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('/');
          }}
        >
          ← Index
        </a>

        <header>
          <h1 className="post-title">{meta.title}</h1>
          <time className="post-date" dateTime={meta.date}>
            {meta.date}
          </time>
        </header>

        <div className="post-content">
          <Component />
        </div>

        <footer className="post-footer">
          <hr className="post-rule" />
          <div className="post-footer-links">
            <span>[↗]: </span>
            {SITE_CONFIG.footerLinks.map((link, idx) => (
              <span key={link.label}>
                {idx > 0 && ', '}
                <a
                  href={link.href}
                  target={link.href.startsWith('http') ? '_blank' : undefined}
                  rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                >
                  {link.label}
                </a>
              </span>
            ))}
          </div>
        </footer>
      </article>
    </div>
  );
}
