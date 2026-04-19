import { getCollection, type CollectionEntry } from 'astro:content';
import readingTime from 'reading-time';

export type Post = CollectionEntry<'posts'>;
export type PostType = 'record' | 'knowledge';

function textSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{Letter}\p{Number}-]+/gu, '');
}

export function categorySlug(name: string): string {
  return textSlug(name);
}

export function tagSlug(name: string): string {
  const slug = textSlug(name);
  if (!slug) return '';
  if (slug === 'index') return 'tag-index';
  return slug;
}

export function categoryBadgeText(name: string): string {
  const parts = name
    .trim()
    .split(/[\s/-]+/g)
    .filter(Boolean);
  if (parts.length === 0) return '#';
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

export type CategoryEntry = { name: string; slug: string; count: number };

function buildCategoryEntries(posts: Post[]): CategoryEntry[] {
  const counts = new Map<string, number>();
  for (const p of posts) {
    const c = p.data.category;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, slug: categorySlug(name), count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export async function getCategories(): Promise<CategoryEntry[]> {
  const posts = await getPublishedPosts();
  return buildCategoryEntries(posts);
}

export async function getCategoriesByType(type: PostType): Promise<CategoryEntry[]> {
  const posts = await getPostsByType(type);
  return buildCategoryEntries(posts);
}

export type TagEntry = { name: string; slug: string; count: number };

function buildTagEntries(posts: Post[]): TagEntry[] {
  const counts = new Map<string, TagEntry>();

  for (const post of posts) {
    for (const rawTag of post.data.tags) {
      const name = rawTag.trim();
      if (!name) continue;
      const slug = tagSlug(name);
      if (!slug) continue;

      const current = counts.get(slug);
      if (current) {
        current.count += 1;
      } else {
        counts.set(slug, { name, slug, count: 1 });
      }
    }
  }

  return Array.from(counts.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export async function getTags(): Promise<TagEntry[]> {
  const posts = await getPublishedPosts();
  return buildTagEntries(posts);
}

export async function getTagsByType(type: PostType): Promise<TagEntry[]> {
  const posts = await getPostsByType(type);
  return buildTagEntries(posts);
}

const THUMB_VARIANTS: Array<'a' | 'b' | 'c' | 'd' | 'e' | 'f'> = ['a', 'b', 'c', 'd', 'e', 'f'];

function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function variantFor(post: Post): 'a' | 'b' | 'c' | 'd' | 'e' | 'f' {
  return post.data.thumbVariant ?? THUMB_VARIANTS[hashCode(post.id) % THUMB_VARIANTS.length]!;
}

export function thumbFor(post: Post): string {
  if (post.data.thumb) return post.data.thumb;
  return categoryBadgeText(post.data.category);
}

export function readingTimeFor(post: Post): string {
  const minutes = Math.max(1, Math.round(readingTime(post.body ?? '').minutes));
  return `${minutes} min read`;
}

export async function getPublishedPosts(): Promise<Post[]> {
  const all = await getCollection('posts', ({ data }) => !data.draft);
  return all.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
}

export async function getPostsByType(type: PostType): Promise<Post[]> {
  const posts = await getPublishedPosts();
  return posts.filter((post) => post.data.type === type);
}

export function postTypeLabel(type: PostType): string {
  return type === 'knowledge' ? '지식' : '기록';
}

export function postUrl(post: Post): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/posts/${post.id}/`;
}
