declare module '*.mdx' {
  import type { ComponentType } from 'react';
  import type { PostMeta } from './post';
  export const meta: PostMeta;
  const MDXContent: ComponentType<{ components?: Record<string, ComponentType<unknown>> }>;
  export default MDXContent;
}
