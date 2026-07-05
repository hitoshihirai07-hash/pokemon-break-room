const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  },
});

const value = (input) => typeof input === 'string' ? input.trim() : '';

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

export async function onRequestPost(context) {
  const origin = context.request.headers.get('Origin');
  const expectedOrigin = new URL(context.request.url).origin;
  if (origin && origin !== expectedOrigin) return json({ error: '許可されていない送信元です。' }, 403);

  const config = configFrom(context.env);
  const providedKey = value(context.request.headers.get('X-Publish-Key'));
  if (!config.publishKey || providedKey !== config.publishKey) {
    return json({ error: '公開キーが正しくありません。' }, 401);
  }
  if (!config.token || !config.owner || !config.repo) {
    return json({ error: 'Cloudflareの GITHUB_TOKEN / GITHUB_OWNER / GITHUB_REPO が未設定です。' }, 500);
  }

  const apiHeaders = headers(config.token);
  const userResponse = await fetch('https://api.github.com/user', { headers: apiHeaders });
  const user = await readJson(userResponse);
  if (!userResponse.ok) {
    return json({
      error: `GitHubトークンを認証できません（HTTP ${userResponse.status}）。${user.message || ''}`,
      github: { status: userResponse.status, message: user.message || null },
    }, 502);
  }

  const target = `${config.owner}/${config.repo}`;
  const repoResponse = await fetch(`https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}`, { headers: apiHeaders });
  const repo = await readJson(repoResponse);
  const acceptedPermissions = repoResponse.headers.get('X-Accepted-GitHub-Permissions') || null;
  if (!repoResponse.ok) {
    return json({
      error: `トークン利用者「${user.login}」は ${target} を操作できません（HTTP ${repoResponse.status}）。${repo.message || ''}`,
      github: {
        tokenAccount: user.login,
        target,
        status: repoResponse.status,
        message: repo.message || null,
        acceptedPermissions,
      },
    }, 502);
  }

  const permissions = repo.permissions || {};
  const canPush = permissions.push === true || permissions.maintain === true || permissions.admin === true;
  const message = canPush
    ? `接続確認済み：トークン利用者「${user.login}」は ${target} へ書き込めます。`
    : `トークン利用者は「${user.login}」として認識されていますが、${target} への書き込み権限を確認できませんでした。GitHubでトークンの対象リポジトリと Contents: Read and write を確認してください。`;

  return json({
    ok: canPush,
    message,
    github: {
      tokenAccount: user.login,
      target,
      branch: config.branch,
      canPush,
      permissions,
      acceptedPermissions,
    },
  }, canPush ? 200 : 409);
}
