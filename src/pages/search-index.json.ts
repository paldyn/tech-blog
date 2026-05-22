import type { APIRoute } from 'astro';
import { getPublishedPosts, postUrl } from '../utils/posts';

export const GET: APIRoute = async () => {
  const posts = await getPublishedPosts();
  const items = posts.map((post) => ({
    title: post.data.title,
    description: post.data.description,
    type: post.data.type,
    typeLabel: post.data.type === 'knowledge' ? '지식' : '기록',
    category: post.data.category,
    tags: post.data.tags,
    author: post.data.author ?? 'PALDYN',
    pubDate: post.data.pubDate.toISOString().slice(0, 10),
    url: postUrl(post),
    searchText: [
      post.data.title,
      post.data.description,
      post.data.type === 'knowledge' ? '지식 knowledge' : '기록 record',
      post.data.category,
      post.data.tags.join(' '),
      post.data.author ?? 'PALDYN',
    ].join(' ').toLowerCase(),
  }));
  return new Response(JSON.stringify(items), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
