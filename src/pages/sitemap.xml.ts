import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async () => {
  const site = import.meta.env.SITE || 'https://pokemon-break-room.pages.dev';
  const staticPaths = ['/', '/about/', '/advertising/', '/disclaimer/', '/privacy/', '/categories/favorite/', '/categories/memories/', '/categories/battle/', '/categories/chat/', '/categories/lounge/'];
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  const urls = [
    ...staticPaths.map((path) => ({ loc: new URL(path, site).href, lastmod: null })),
    ...posts.map((post) => ({ loc: new URL(`/posts/${post.id}/`, site).href, lastmod: (post.data.updatedAt ?? post.data.publishedAt).toISOString() })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `\n  <url><loc>${url.loc}</loc>${url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : ''}</url>`).join('')}\n</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
