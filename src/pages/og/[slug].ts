import type { APIRoute } from 'astro';

// OGP images are saved as static PNG files in public/og when an article is published.
// This route stays empty only to replace the earlier build-time sharp implementation.
export function getStaticPaths() {
  return [];
}

export const GET: APIRoute = () => new Response('Not found', { status: 404 });
