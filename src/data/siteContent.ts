export type BranchId = 'work' | 'updates' | 'writing' | 'me';

export interface BioSegment {
  text: string;
  mark?: boolean; // wavy hand-drawn underline
  href?: string; // underlined clickable link
}

export interface BioParagraph {
  id: string;
  segments: BioSegment[];
}

export interface PhotoCardSpec {
  id: string;
  seed: number;
  width: number;
  height: number;
  displayWidth: number;
  rotationDeg: number;
  offsetX: number;
  offsetY: number;
  caption: string;
  motif: 'horizon' | 'monolith' | 'rings' | 'lattice';
  tapes: Array<{
    x: number; // normalized -0.5..0.5
    y: number;
    angleDeg: number;
    length: number;
    width: number;
  }>;
}

export interface UpdateEntrySpec {
  id: string;
  label: string; // e.g. "jun 13"
  route: string; // e.g. "/updates/2026-06-13/"
  dateISO: string;
}

export interface TrackSpec {
  id: string;
  title: string;
  artist: string;
  url: string;
  preset: 'rhodes' | 'kalimba' | 'rain';
}

export const SITE_CONFIG = {
  title: 'ink tree (╯°□°)╯',
  authorName: 'alex',
  email: 'hello@example.com',
  emailHref: 'mailto:hello@example.com',
  bookingHref: 'https://cal.com/example',
  ctaLine1: 'got a ',
  ctaHighlight: 'question',
  ctaLine1End: '?',
  ctaLine2: 'book 30min',
  footerLinks: [
    { label: 'Email', href: 'mailto:hello@example.com' },
    { label: 'LinkedIn', href: 'https://linkedin.com/in/example' },
    { label: 'Twitter', href: 'https://x.com/example' },
  ],
  musicCaptionLines: ['maybe this tells you more', 'if you press play here!'],
} as const;

export const BIO_PARAGRAPHS: BioParagraph[] = [
  {
    id: 'p1',
    segments: [
      { text: "i'm " },
      { text: 'alex', mark: true },
      { text: '. placeholder builder & writer, based in somewhere.' },
    ],
  },
  {
    id: 'p2',
    segments: [
      { text: 'mostly drawn to ' },
      { text: 'quiet interfaces', mark: true },
      { text: ', small tools, and notebooks filled with margin sketches.' },
    ],
  },
  {
    id: 'p3',
    segments: [
      { text: 'previously helped shape a few ' },
      { text: 'developer products', href: '/blog/placeholder-post/' },
      { text: ' and early-stage experiments on the web.' },
    ],
  },
  {
    id: 'p4',
    segments: [
      { text: 'outside of work, i collect ' },
      { text: 'field recordings', mark: true },
      { text: ', test paper stocks, and steep too much tea.' },
    ],
  },
  {
    id: 'p5',
    segments: [
      { text: 'longer notes live under ' },
      { text: 'writing', href: '/blog/placeholder-post/' },
      { text: ', with shorter logs tucked into ' },
      { text: 'updates', href: '/updates/2026-06-13/' },
      { text: '.' },
    ],
  },
  {
    id: 'p6',
    segments: [
      { text: 'always happy to trade notes — ' },
      { text: 'send a line', href: 'mailto:hello@example.com' },
      { text: ' or ' },
      { text: 'book time', href: 'https://cal.com/example' },
      { text: '.' },
    ],
  },
];

export const ME_PHOTOS: PhotoCardSpec[] = [
  {
    id: 'photo-1',
    seed: 101,
    width: 760,
    height: 760,
    displayWidth: 146,
    rotationDeg: -5.4,
    offsetX: 0,
    offsetY: 0,
    caption: 'stacked paper & ink test, 01',
    motif: 'rings',
    tapes: [{ x: -0.32, y: -0.44, angleDeg: -38, length: 42, width: 13 }],
  },
  {
    id: 'photo-2',
    seed: 202,
    width: 760,
    height: 558,
    displayWidth: 150,
    rotationDeg: 4.8,
    offsetX: 112,
    offsetY: 54,
    caption: 'coastal horizon study, morning',
    motif: 'horizon',
    tapes: [
      { x: 0.34, y: -0.43, angleDeg: 34, length: 40, width: 13 },
    ],
  },
  {
    id: 'photo-3',
    seed: 303,
    width: 639,
    height: 760,
    displayWidth: 120,
    rotationDeg: -4.2,
    offsetX: 10,
    offsetY: 136,
    caption: 'window shadow & notebook',
    motif: 'monolith',
    tapes: [{ x: -0.30, y: -0.45, angleDeg: -34, length: 40, width: 13 }],
  },
  {
    id: 'photo-4',
    seed: 404,
    width: 760,
    height: 439,
    displayWidth: 154,
    rotationDeg: 6.2,
    offsetX: 108,
    offsetY: 182,
    caption: 'desk lamp & quiet hours',
    motif: 'lattice',
    tapes: [
      { x: 0.35, y: 0.42, angleDeg: -36, length: 38, width: 12 },
      { x: -0.34, y: -0.43, angleDeg: -32, length: 38, width: 12 },
    ],
  },
];

export const UPDATE_ENTRIES: UpdateEntrySpec[] = [
  { id: 'u7', label: 'jun 13', route: '/updates/2026-06-13/', dateISO: '2026-06-13' },
  { id: 'u6', label: 'may 10', route: '/updates/2026-05-10/', dateISO: '2026-05-10' },
  { id: 'u5', label: 'apr 28', route: '/updates/2026-04-28/', dateISO: '2026-04-28' },
  { id: 'u4', label: 'apr 23', route: '/updates/2026-04-23/', dateISO: '2026-04-23' },
  { id: 'u3', label: 'apr 22', route: '/updates/2026-04-22/', dateISO: '2026-04-22' },
  { id: 'u2', label: 'apr 21', route: '/updates/2026-04-21/', dateISO: '2026-04-21' },
  { id: 'u1', label: 'apr 20', route: '/updates/2026-04-20/', dateISO: '2026-04-20' },
];

export const WRITING_POSTS = [
  {
    id: 'w1',
    label: 'placeholder post',
    dateLabel: 'jan 1',
    route: '/blog/placeholder-post/',
  },
];

export const WORK_LINKS = [
  {
    id: 'work-cal',
    label: 'book a call',
    href: 'https://cal.com/example',
    external: true,
    hasCanopy: true,
  },
  {
    id: 'work-mail',
    label: 'hello@example.com',
    href: 'mailto:hello@example.com',
    external: true,
    hasCanopy: false,
  },
];

export const MUSIC_TRACKS: TrackSpec[] = [
  {
    id: 'track-1',
    title: 'placeholder · track title',
    artist: 'synth study 01',
    url: 'https://example.com/audio-notes',
    preset: 'rhodes',
  },
  {
    id: 'track-2',
    title: 'placeholder · dusk loop',
    artist: 'synth study 02',
    url: 'https://example.com/audio-notes',
    preset: 'kalimba',
  },
  {
    id: 'track-3',
    title: 'placeholder · paper rain',
    artist: 'synth study 03',
    url: 'https://example.com/audio-notes',
    preset: 'rain',
  },
];
