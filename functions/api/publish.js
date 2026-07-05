const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  },
});

const isValidSlug = (slug) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);

function encodeBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const origin = request.headers.get('Origin');
  const expectedOrigin = new URL(request.url).origin;
  if (origin && origin !== expectedOrigin) return json({ error: '許可されていない送信元です。' }, 403);

  const providedKey = request.headers.get('X-Publish-Key') || '';
  if (!env.PUBLISH_API_KEY || providedKey !== env.PUBLISH_API_KEY) {
    return json({ error: '公開キーが正しくありません。' }, 401);
  }
  if (!env.GITHUB_TOKEN || !env.GITHUB_OWNER || !env.GITHUB_REPO) {
    return json({ error: 'CloudflareのGitHub連携用シークレットが未設定です。' }, 500);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: '送信内容を読み取れませんでした。' }, 400);
  }

  const { slug, markdown, title } = payload || {};
  if (!isValidSlug(slug || '')) return json({ error: 'URL末尾の形式が正しくありません。' }, 400);
  if (typeof markdown !== 'string' || markdown.length < 40 || markdown.length > 120000) {
    return json({ error: '記事本文の長さが正しくありません。' }, 400);
  }
  if (typeof title !== 'string' || !title.trim()) return json({ error: '記事テーマがありません。' }, 400);

  const branch = env.GITHUB_BRANCH || 'main';
  const filePath = `src/content/blog/${slug}.md`;
  const url = `https://api.github.com/repos/${encodeURIComponent(env.GITHUB_OWNER)}/${encodeURIComponent(env.GITHUB_REPO)}/contents/${filePath.split('/').map(encodeURIComponent).join('/')}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'pokemon-break-room-publisher',
  };

  let sha;
  const existing = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, { headers });
  if (existing.ok) {
    const current = await existing.json();
    sha = current.sha;
  } else if (existing.status !== 404) {
    return json({ error: 'GitHub上の記事確認に失敗しました。トークン権限とリポジトリ名を確認してください。' }, 502);
  }

  const commit = await fetch(url, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `docs: publish ${title.trim().slice(0, 70)}`,
      content: encodeBase64(markdown),
      branch,
      ...(sha ? { sha } : {}),
    }),
  });
  const result = await commit.json().catch(() => ({}));
  if (!commit.ok) {
    return json({ error: result.message || 'GitHubへの反映に失敗しました。' }, 502);
  }

  return json({
    ok: true,
    filePath,
    commitUrl: result.commit?.html_url || null,
  });
}

