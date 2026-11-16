import type { ComponentType } from 'react';
import type { PostMeta } from '../types/post';

import PlaceholderPost, { meta as placeholderPostMeta } from './blog/placeholder-post.mdx';
import Update0613, { meta as update0613Meta } from './updates/2026-06-13.mdx';
import Update0510, { meta as update0510Meta } from './updates/2026-05-10.mdx';
import Update0428, { meta as update0428Meta } from './updates/2026-04-28.mdx';
import Update0423, { meta as update0423Meta } from './updates/2026-04-23.mdx';
import Update0422, { meta as update0422Meta } from './updates/2026-04-22.mdx';
import Update0421, { meta as update0421Meta } from './updates/2026-04-21.mdx';
import Update0420, { meta as update0420Meta } from './updates/2026-04-20.mdx';

export interface PostRecord {
  route: string;
  meta: PostMeta;
  Component: ComponentType<{ components?: Record<string, ComponentType<unknown>> }>;
}

const POSTS: PostRecord[] = [
  { route: '/blog/placeholder-post', meta: placeholderPostMeta, Component: PlaceholderPost },
  { route: '/updates/2026-06-13', meta: update0613Meta, Component: Update0613 },
  { route: '/updates/2026-05-10', meta: update0510Meta, Component: Update0510 },
  { route: '/updates/2026-04-28', meta: update0428Meta, Component: Update0428 },
  { route: '/updates/2026-04-23', meta: update0423Meta, Component: Update0423 },
  { route: '/updates/2026-04-22', meta: update0422Meta, Component: Update0422 },
  { route: '/updates/2026-04-21', meta: update0421Meta, Component: Update0421 },
  { route: '/updates/2026-04-20', meta: update0420Meta, Component: Update0420 },
];

export function findPostByPath(pathname: string): PostRecord | undefined {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return POSTS.find((p) => p.route === normalized);
}

export function getAllPosts(): PostRecord[] {
  return POSTS;
}
