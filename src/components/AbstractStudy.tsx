interface AbstractStudyProps {
  variant?: 'horizon' | 'grid' | 'rings';
  caption?: string;
}

export function AbstractStudy({ variant = 'horizon', caption }: AbstractStudyProps) {
  return (
    <figure className="post-figure">
      <svg
        viewBox="0 0 640 280"
        width="640"
        height="280"
        role="img"
        aria-label={caption ?? 'Abstract geometric study'}
        className="post-figure-svg"
      >
        <rect width="640" height="280" fill="#252427" />
        {variant === 'horizon' && (
          <>
            <circle cx="470" cy="88" r="36" fill="#d4d4d4" opacity="0.72" />
            <path
              d="M0 175 Q160 142 320 170 T640 162 L640 280 L0 280 Z"
              fill="#353338"
            />
            <path
              d="M0 212 Q210 190 410 218 T640 205 L640 280 L0 280 Z"
              fill="#19191b"
            />
            <line x1="36" y1="154" x2="290" y2="154" stroke="#d4d4d4" strokeWidth="1" opacity="0.35" />
          </>
        )}
        {variant === 'grid' && (
          <>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <line
                key={`v-${i}`}
                x1={80 + i * 96}
                y1={28}
                x2={80 + i * 96}
                y2={252}
                stroke="#d4d4d4"
                strokeWidth="1"
                opacity="0.16"
              />
            ))}
            {[0, 1, 2, 3].map((j) => (
              <line
                key={`h-${j}`}
                x1={48}
                y1={56 + j * 56}
                x2={592}
                y2={56 + j * 56}
                stroke="#d4d4d4"
                strokeWidth="1"
                opacity="0.16"
              />
            ))}
            <rect x="176" y="74" width="144" height="132" fill="#d4d4d4" opacity="0.14" />
            <rect x="260" y="108" width="192" height="72" stroke="#FF8800" strokeWidth="1.5" fill="none" opacity="0.6" />
          </>
        )}
        {variant === 'rings' && (
          <>
            {[28, 56, 86, 118].map((r, idx) => (
              <circle
                key={r}
                cx="320"
                cy="140"
                r={r}
                fill="none"
                stroke={idx === 2 ? '#FF8800' : '#d4d4d4'}
                strokeWidth="1.2"
                opacity={0.45 - idx * 0.08}
              />
            ))}
          </>
        )}
      </svg>
      {caption && <figcaption className="post-figcaption">{caption}</figcaption>}
    </figure>
  );
}
