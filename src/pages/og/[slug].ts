import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import sharp from 'sharp';

export async function getStaticPaths() {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return posts.map((post) => ({
    params: { slug: post.id },
    props: { post },
  }));
}

const categoryNames: Record<string, string> = {
  favorite: '推しポケ語り',
  memories: 'ゲームと思い出',
  battle: 'ゆる対戦・育成',
  chat: 'ポケモン雑談',
  lounge: 'みんなの休憩所',
};

function escapeXml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&apos;',
    '"': '&quot;',
  })[character] || character);
}

function splitText(value: string, maxChars: number, maxLines: number) {
  const lines: string[] = [];
  let line = '';
  for (const character of value) {
    if (line.length >= maxChars) {
      lines.push(line);
      line = '';
      if (lines.length === maxLines - 1) break;
    }
    line += character;
  }
  const consumed = lines.join('').length;
  const remaining = value.slice(consumed + line.length);
  if (line) lines.push(line);
  if (remaining && lines.length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].slice(0, Math.max(1, maxChars - 1))}…`;
  }
  return lines.slice(0, maxLines);
}

export const GET: APIRoute = async ({ props }) => {
  const post = props.post;
  const titleLineValues = splitText(post.data.title, 12, 3);
  const titleLines = titleLineValues.map((line, index) => (
    `<text x="96" y="${220 + index * 78}" font-family="Noto Sans CJK JP, Noto Sans JP, sans-serif" font-size="56" font-weight="700" fill="#3f3f3f">${escapeXml(line)}</text>`
  )).join('');
  const category = categoryNames[post.data.category] || 'ポケモンの話';
  const descriptionLines = splitText(post.data.description, 32, 2).map((line, index) => (
    `<text x="96" y="${492 + index * 34}" font-family="Noto Sans CJK JP, Noto Sans JP, sans-serif" font-size="22" fill="#6f706c">${escapeXml(line)}</text>`
  )).join('');

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fffaf1" />
        <stop offset="100%" stop-color="#ffedca" />
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#b7874a" flood-opacity=".17" />
      </filter>
    </defs>
    <rect width="1200" height="630" fill="url(#bg)" />
    <circle cx="1070" cy="110" r="94" fill="#ffd36c" opacity=".78" />
    <path d="M101 544 C220 410, 390 480, 514 604 L0 630 L0 510 Z" fill="#dcebd0" />
    <path d="M976 604 C1016 486, 1133 436, 1200 470 L1200 630 L927 630 Z" fill="#d8e8d4" />
    <g filter="url(#shadow)">
      <circle cx="992" cy="342" r="123" fill="#fffdf9" stroke="#3f3f3f" stroke-width="12" />
      <path d="M869 342 H1115" stroke="#3f3f3f" stroke-width="12" />
      <path d="M869 342 A123 123 0 0 1 1115 342" fill="#f28c72" />
      <circle cx="992" cy="342" r="34" fill="#fffdf9" stroke="#3f3f3f" stroke-width="12" />
    </g>
    <rect x="96" y="92" rx="22" ry="22" width="188" height="48" fill="#e4edd9" />
    <text x="120" y="124" font-family="Noto Sans CJK JP, Noto Sans JP, sans-serif" font-size="23" font-weight="700" fill="#527146">${escapeXml(category)}</text>
    ${titleLines}
    <line x1="96" y1="442" x2="780" y2="442" stroke="#eadfce" stroke-width="2" />
    ${descriptionLines}
    <text x="96" y="588" font-family="Noto Sans CJK JP, Noto Sans JP, sans-serif" font-size="23" font-weight="700" fill="#50735f">ポケモン好きの休憩所</text>
  </svg>`;

  const image = await sharp(new TextEncoder().encode(svg)).png({ compressionLevel: 9 }).toBuffer();
  return new Response(image, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
