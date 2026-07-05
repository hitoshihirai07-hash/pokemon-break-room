import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

const escapeXml = (value: string) => value.replace(/[<>&'\"]/g, (char) => ({
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  "'": '&apos;',
  '"': '&quot;',
}[char] || char));

export const GET: APIRoute = async () => {
  const site = import.meta.env.SITE || 'https://pokemon-break-room.pages.dev';
  const posts = (await getCollection('blog', ({ data }) => !data.draft))
    .sort((a, b) => b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf());
  const items = posts.map((post) => `
    <item>
      <title>${escapeXml(post.data.title)}</title>
      <link>${new URL(`/posts/${post.id}/`, site).href}</link>
      <guid>${new URL(`/posts/${post.id}/`, site).href}</guid>
      <description>${escapeXml(post.data.description)}</description>
      <pubDate>${post.data.publishedAt.toUTCString()}</pubDate>
    </item>`).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0"><channel>
    <title>ポケモン好きの休憩所</title>
    <link>${site}</link>
    <description>好きなポケモンを、気軽に語れる場所。</description>
    <language>ja</language>${items}
  </channel></rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
