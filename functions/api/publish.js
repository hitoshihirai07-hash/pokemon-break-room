const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  },
});

const value = (input) => typeof input === 'string' ? input.trim() : '';
const isValidSlug = (slug) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);

function encodeBase64(input) {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function configFrom(env) {
  return {
    token: value(env.GITHUB_TOKEN),
    owner: value(env.GITHUB_OWNER),
    repo: value(env.GITHUB_REPO),
    branch: value(env.GITHUB_BRANCH) || 'main',
    publishKey: value(env.PUBLISH_API_KEY),
  };
}

function headers(token) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'pokemon-break-room-publisher',
  };
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

function githubError(action, response, body, config, extra = {}) {
  const message = body?.message || 'GitHubから詳細なエラー内容を取得できませんでした。';
  const permissionHint = response.headers.get('X-Accepted-GitHub-Permissions') || '';
  const detail = [
    `GitHub ${action}に失敗しました（HTTP ${response.status}）。`,
    message,
    `対象: ${config.owner}/${config.repo}（${config.branch}）`,
    permissionHint ? `GitHubが要求した権限: ${permissionHint}` : '',
  ].filter(Boolean).join(' ');
  return json({
    error: detail,
    github: {
      status: response.status,
      message,
      target: `${config.owner}/${config.repo}`,
      branch: config.branch,
      acceptedPermissions: permissionHint || null,
      ...extra,
    },
  }, 502);
}

async function validateRequest(request, env) {
  const origin = request.headers.get('Origin');
  const expectedOrigin = new URL(request.url).origin;
  if (origin && origin !== expectedOrigin) {
    return { error: json({ error: '許可されていない送信元です。' }, 403) };
  }
  const config = configFrom(env);
  const providedKey = value(request.headers.get('X-Publish-Key'));
  if (!config.publishKey || providedKey !== config.publishKey) {
    return { error: json({ error: '公開キーが正しくありません。' }, 401) };
  }
  if (!config.token || !config.owner || !config.repo) {
    return { error: json({ error: 'Cloudflareの GITHUB_TOKEN / GITHUB_OWNER / GITHUB_REPO が未設定です。' }, 500) };
  }
  return { config };
}

export async function onRequestPost(context) {
  const checked = await validateRequest(context.request, context.env);
  if (checked.error) return checked.error;
  const { config } = checked;

  let payload;
  try {
    payload = await context.request.json();
  } catch {
    return json({ error: '送信内容を読み取れませんでした。' }, 400);
  }

  const { slug, markdown, title } = payload || {};
  if (!isValidSlug(slug || '')) return json({ error: 'URL末尾の形式が正しくありません。' }, 400);
  if (typeof markdown !== 'string' || markdown.length < 40 || markdown.length > 120000) {
    return json({ error: '記事本文の長さが正しくありません。' }, 400);
  }
  if (typeof title !== 'string' || !title.trim()) return json({ error: '記事テーマがありません。' }, 400);

  const apiHeaders = headers(config.token);
  const filePath = `src/content/blog/${slug}.md`;
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
  const url = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${encodedPath}`;

  let sha;
  const existing = await fetch(`${url}?ref=${encodeURIComponent(config.branch)}`, { headers: apiHeaders });
  if (existing.ok) {
    const current = await readJson(existing);
    sha = current.sha;
  } else if (existing.status !== 404) {
    const detail = await readJson(existing);
    return githubError('上書き対象の記事確認', existing, detail, config);
  }

  const commit = await fetch(url, {
    method: 'PUT',
    headers: { ...apiHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `docs: publish ${title.trim().slice(0, 70)}`,
      content: encodeBase64(markdown),
      branch: config.branch,
      ...(sha ? { sha } : {}),
    }),
  });
  const result = await readJson(commit);
  if (!commit.ok) return githubError('記事の作成・更新', commit, result, config);

  return json({
    ok: true,
    filePath,
    commitUrl: result.commit?.html_url || null,
  });
}
