export interface PostMeta {
  title: string;
  date: string;
  slug: string;
  summary?: string;
  kind: 'blog' | 'update';
}
