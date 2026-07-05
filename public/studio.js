const $ = (id) => document.getElementById(id);
const fields = ['title', 'category', 'publishedAt', 'slug', 'description', 'tags', 'notes', 'instructions', 'question', 'body'];
const STORAGE_KEY = 'pokemon-break-room-studio-v1';
const categoryNames = {
  favorite: '推しポケ語り',
  memories: 'ゲームと思い出',
  battle: 'ゆる対戦・育成',
  chat: 'ポケモン雑談',
  lounge: 'みんなの休憩所',
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function loadDraft() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    fields.forEach((field) => {
      if ($(field) && typeof data[field] === 'string') $(field).value = data[field];
    });
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function saveDraft() {
  const data = Object.fromEntries(fields.map((field) => [field, $(field)?.value ?? '']));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#039;',
    '"': '&quot;',
  })[character]);
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function renderMarkdown(markdown) {
  const lines = markdown.replace(/^---[\s\S]*?---\s*/m, '').split('\n');
  const html = [];
  let inList = false;
  let inQuote = false;
  let paragraph = [];

  const closeParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
  };
  const closeQuote = () => {
    if (inQuote) {
      html.push('</blockquote>');
      inQuote = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      closeParagraph();
      closeList();
      closeQuote();
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeParagraph(); closeList(); closeQuote();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    const list = line.match(/^[-*]\s+(.+)$/);
    if (list) {
      closeParagraph(); closeQuote();
      if (!inList) { html.push('<ul>'); inList = true; }
      html.push(`<li>${inlineMarkdown(list[1])}</li>`);
      continue;
    }
    const quote = line.match(/^>\s?(.+)$/);
    if (quote) {
      closeParagraph(); closeList();
      if (!inQuote) { html.push('<blockquote>'); inQuote = true; }
      html.push(`<p>${inlineMarkdown(quote[1])}</p>`);
      continue;
    }
    closeList(); closeQuote();
    paragraph.push(line);
  }
  closeParagraph(); closeList(); closeQuote();
  return html.join('\n') || '<p>本文を貼り付けるとプレビューできます。</p>';
}

function cleanBody(value) {
  return value.replace(/^---[\s\S]*?---\s*/m, '').trim();
}

function slugFromInput() {
  const current = $('slug').value.trim().toLowerCase();
  if (current) return current.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `pokemon-note-${$('publishedAt').value.replaceAll('-', '') || today().replaceAll('-', '')}`;
}

function yamlText(value) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
}

function makeDescription(body) {
  const input = $('description').value.trim();
  if (input) return input.slice(0, 180);
  const plain = cleanBody(body).replace(/[#>*_`\-]/g, '').replace(/\s+/g, ' ').trim();
  return (plain || 'ポケモンについて気軽に語る記事です。').slice(0, 170);
}

function createMarkdown() {
  const title = $('title').value.trim();
  const body = cleanBody($('body').value);
  const category = $('category').value;
  const tags = $('tags').value.split(',').map((tag) => tag.trim()).filter(Boolean);
  const publishedAt = $('publishedAt').value || today();
  const slug = slugFromInput();
  if (!title || !body) throw new Error('記事テーマと生成済み本文を入力してください。');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('URL末尾は半角英小文字・数字・ハイフンだけで入力してください。');
  const frontmatter = [
    '---',
    `title: "${yamlText(title)}"`,
    `description: "${yamlText(makeDescription(body))}"`,
    `publishedAt: ${publishedAt}`,
    `category: "${category}"`,
    'tags:',
    ...(tags.length ? tags.map((tag) => `  - "${yamlText(tag)}"`) : ['  - "ポケモン"']),
    'draft: false',
    '---',
    '',
  ].join('\n');
  return { markdown: `${frontmatter}${body}\n`, slug, title, category, description: makeDescription(body) };
}

function makePrompt() {
  const title = $('title').value.trim();
  const notes = $('notes').value.trim();
  if (!title || !notes) throw new Error('記事テーマと箇条書きメモを入力してください。');
  const category = categoryNames[$('category').value];
  const instructions = $('instructions').value.trim() || '断定しすぎず、個人の感想として自然に書いてください。';
  const question = $('question').value.trim() || '読者が自分の思い出を話したくなる、短い問いかけを最後に入れてください。';
  return `あなたは「ポケモン好きの休憩所」の編集者です。以下のメモをもとに、日本語のブログ記事本文を作成してください。\n\n【記事テーマ】\n${title}\n\n【カテゴリ】\n${category}\n\n【箇条書きメモ】\n${notes}\n\n【書き方の条件】\n- 読者を見下さず、強さや知識量を競う文章にしない\n- 個人ブログらしく、やわらかく読みやすい文体\n- 見出しは2〜4個。過度なSEO表現は使わない\n- 事実として断定できない内容は、推測・感想として分ける\n- 作品名・ポケモン名などの固有情報を補う場合、確認できないことを捏造しない\n- 本文は900〜1,500字を目安にする\n- 本文だけをMarkdown形式で出力する。記事タイトル、説明文、Frontmatterは出力しない\n\n【追加の希望】\n${instructions}\n\n【記事末の問いかけ】\n${question}`;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const helper = document.createElement('textarea');
    helper.value = text;
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    document.body.append(helper);
    helper.select();
    document.execCommand('copy');
    helper.remove();
  }
}

function setStatus(message, error = false) {
  const target = $('publish-status');
  target.textContent = message;
  target.classList.toggle('is-error', error);
}

$('publishedAt').value = today();
loadDraft();
if (!$('publishedAt').value) $('publishedAt').value = today();
fields.forEach((field) => $(field)?.addEventListener('input', saveDraft));
$('category').addEventListener('change', saveDraft);

$('copy-prompt').addEventListener('click', async () => {
  try {
    await copyText(makePrompt());
    $('copy-prompt').textContent = 'コピーしました';
    window.setTimeout(() => { $('copy-prompt').textContent = 'AIへの依頼文をコピー'; }, 1800);
  } catch (error) {
    alert(error.message);
  }
});

$('clear-draft').addEventListener('click', () => {
  if (!window.confirm('入力した下書きをこのブラウザから消します。よろしいですか？')) return;
  localStorage.removeItem(STORAGE_KEY);
  fields.forEach((field) => { if ($(field)) $(field).value = ''; });
  $('publishedAt').value = today();
  $('preview').innerHTML = '<p>ここに記事の見た目が表示されます。</p>';
});

$('show-preview').addEventListener('click', () => {
  $('preview').innerHTML = renderMarkdown($('body').value);
});

$('download-markdown').addEventListener('click', () => {
  try {
    const { markdown, slug } = createMarkdown();
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${slug}.md`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  } catch (error) {
    alert(error.message);
  }
});

$('check-github').addEventListener('click', async () => {
  try {
    const key = $('publish-key').value.trim();
    if (!key) throw new Error('公開キーを入力してから診断してください。');
    setStatus('GitHub接続を確認しています…');
    const response = await fetch('/api/github-status', {
      method: 'POST',
      headers: { 'X-Publish-Key': key },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'GitHub接続診断に失敗しました。');
    setStatus(result.message || 'GitHub接続を確認しました。', !result.ok);
  } catch (error) {
    setStatus(error.message, true);
  }
});

$('make-key').addEventListener('click', async () => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const key = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  $('publish-key').value = key;
  await copyText(key);
  setStatus('公開キーを作成してコピーしました。Cloudflareの PUBLISH_API_KEY に同じ値を登録してください。');
});

$('publish').addEventListener('click', async () => {
  try {
    const key = $('publish-key').value.trim();
    if (!key) throw new Error('公開キーを入力してください。');
    const payload = createMarkdown();
    if (!window.confirm(`「${payload.title}」をGitHubへ公開します。よろしいですか？`)) return;
    setStatus('GitHubへ反映しています…');
    const response = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Publish-Key': key },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || '公開に失敗しました。Cloudflare設定を確認してください。');
    setStatus(`GitHubへ反映しました。Cloudflare Pagesの自動デプロイ完了後に公開されます。${result.commitUrl ? ' GitHubのコミット画面を開けます。' : ''}`);
    if (result.commitUrl) {
      const link = document.createElement('a');
      link.href = result.commitUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'GitHubのコミットを確認する →';
      link.className = 'text-link';
      $('publish-status').append(document.createElement('br'), link);
    }
  } catch (error) {
    setStatus(error.message, true);
  }
});
