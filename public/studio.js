const $ = (id) => document.getElementById(id);
const fields = ['title', 'category', 'publishedAt', 'slug', 'description', 'tags', 'question', 'notes', 'instructions', 'body'];
const STORAGE_KEY = 'pokemon-break-room-studio-v2';
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
  const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('pokemon-break-room-studio-v1');
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
  return String(value).replace(/[&<>'"]/g, (character) => ({
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
  const lines = String(markdown).replace(/^---[\s\S]*?---\s*/m, '').split('\n');
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
      closeParagraph();
      closeList();
      closeQuote();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    const list = line.match(/^[-*]\s+(.+)$/);
    if (list) {
      closeParagraph();
      closeQuote();
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      html.push(`<li>${inlineMarkdown(list[1])}</li>`);
      continue;
    }
    const quote = line.match(/^>\s?(.+)$/);
    if (quote) {
      closeParagraph();
      closeList();
      if (!inQuote) {
        html.push('<blockquote>');
        inQuote = true;
      }
      html.push(`<p>${inlineMarkdown(quote[1])}</p>`);
      continue;
    }
    closeList();
    closeQuote();
    paragraph.push(line);
  }
  closeParagraph();
  closeList();
  closeQuote();
  return html.join('\n') || '<p>本文を貼り付けると、ここに記事本文が表示されます。</p>';
}

function cleanBody(value) {
  return String(value).replace(/^---[\s\S]*?---\s*/m, '').trim();
}

function slugFromInput() {
  const current = $('slug')?.value.trim().toLowerCase() || '';
  if (current) return current.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const date = $('publishedAt')?.value || today();
  return `pokemon-note-${date.replaceAll('-', '')}`;
}

function yamlText(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
}

function makeDescription(body) {
  const input = $('description')?.value.trim() || '';
  if (input) return input.slice(0, 180);
  const plain = cleanBody(body).replace(/[#>*_`\-]/g, '').replace(/\s+/g, ' ').trim();
  return (plain || 'ポケモンについて気軽に語る記事です。').slice(0, 170);
}

function formatDate(value) {
  const date = value ? new Date(`${value}T00:00:00`) : new Date();
  return new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

function createMarkdown() {
  const title = $('title')?.value.trim() || '';
  const body = cleanBody($('body')?.value || '');
  const category = $('category')?.value || 'favorite';
  const tags = ($('tags')?.value || '').split(',').map((tag) => tag.trim()).filter(Boolean);
  const question = $('question')?.value.trim() || '';
  const publishedAt = $('publishedAt')?.value || today();
  const slug = slugFromInput();
  if (!title || !body) throw new Error('公開タイトルと記事本文を入力してください。');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('URL末尾は半角英小文字・数字・ハイフンだけで入力してください。');
  const frontmatter = [
    '---',
    `title: "${yamlText(title)}"`,
    `description: "${yamlText(makeDescription(body))}"`,
    `publishedAt: ${publishedAt}`,
    `category: "${category}"`,
    `ogImage: "/og/${slug}.png"`,
    'tags:',
    ...(tags.length ? tags.map((tag) => `  - "${yamlText(tag)}"`) : ['  - "ポケモン"']),
    ...(question ? [`question: "${yamlText(question)}"`] : []),
    'draft: false',
    '---',
    '',
  ].join('\n');
  return {
    markdown: `${frontmatter}${body}\n`,
    slug,
    title,
    category,
    description: makeDescription(body),
    question,
    tags,
    publishedAt,
    ogImage: `/og/${slug}.png`,
  };
}

function renderArticlePreview() {
  const target = $('preview');
  if (!target) return;
  const title = $('title')?.value.trim() || '公開タイトルがここに入ります';
  const category = $('category')?.value || 'favorite';
  const description = makeDescription($('body')?.value || '');
  const tags = ($('tags')?.value || '').split(',').map((tag) => tag.trim()).filter(Boolean);
  const question = $('question')?.value.trim() || '記事末の問いかけを入力すると、ここに表示されます。';
  const body = $('body')?.value || '';
  const tagHtml = tags.length
    ? `<div class="preview-article__tags">${tags.map((tag) => `<span>#${escapeHtml(tag)}</span>`).join('')}</div>`
    : '';

  target.innerHTML = `
    <div class="preview-article">
      <header class="preview-article__header">
        <div class="preview-article__meta"><span class="category-pill category--${escapeHtml(category)}">${escapeHtml(categoryNames[category] || 'ポケモンの話')}</span><time>${escapeHtml(formatDate($('publishedAt')?.value))}</time></div>
        <h1>${escapeHtml(title)}</h1>
        <p class="preview-article__description">${escapeHtml(description)}</p>
        ${tagHtml}
      </header>
      <div class="preview-article__body prose">${renderMarkdown(body)}</div>
      <section class="preview-article__question">
        <p class="eyebrow">LET'S TALK</p>
        <h2>${escapeHtml(question)}</h2>
        <p>気が向いたときに、自分の思い出や好きな理由も言葉にしてみてください。</p>
      </section>
      <section class="preview-article__profile">
        <span aria-hidden="true">●</span>
        <div>
          <p class="eyebrow">ABOUT THIS BLOG</p>
          <h2>ポケモン好きの休憩所</h2>
          <p>ピカチュウが好きで、シンオウ地方に思い入れがある個人ブログです。</p>
        </div>
      </section>
    </div>`;
}

function wrapCanvasText(context, text, maxWidth, maxLines) {
  const lines = [];
  let current = '';
  for (const character of String(text)) {
    const candidate = current + character;
    if (current && context.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = character;
      if (lines.length === maxLines - 1) break;
    } else {
      current = candidate;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  const consumed = lines.join('').length;
  if (String(text).length > consumed && lines.length) {
    let last = lines[lines.length - 1];
    while (last && context.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last}…`;
  }
  return lines.slice(0, maxLines);
}

function makeOgImageBase64(payload) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 630;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('OGP画像の作成を開始できませんでした。');

  const background = context.createLinearGradient(0, 0, 1200, 630);
  background.addColorStop(0, '#fffaf1');
  background.addColorStop(1, '#ffedca');
  context.fillStyle = background;
  context.fillRect(0, 0, 1200, 630);

  context.globalAlpha = 0.78;
  context.fillStyle = '#ffd36c';
  context.beginPath();
  context.arc(1070, 110, 94, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;

  context.fillStyle = '#dcebd0';
  context.beginPath();
  context.moveTo(0, 510);
  context.bezierCurveTo(160, 405, 350, 470, 514, 604);
  context.lineTo(0, 630);
  context.closePath();
  context.fill();

  context.fillStyle = '#d8e8d4';
  context.beginPath();
  context.moveTo(927, 630);
  context.bezierCurveTo(1016, 486, 1133, 436, 1200, 470);
  context.lineTo(1200, 630);
  context.closePath();
  context.fill();

  // Decorative round mark; no official artwork is used.
  context.save();
  context.shadowColor = 'rgba(183, 135, 74, 0.18)';
  context.shadowBlur = 22;
  context.shadowOffsetY = 12;
  context.fillStyle = '#fffdf9';
  context.strokeStyle = '#3f3f3f';
  context.lineWidth = 12;
  context.beginPath();
  context.arc(992, 342, 123, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
  context.save();
  context.beginPath();
  context.arc(992, 342, 117, Math.PI, 0);
  context.closePath();
  context.fillStyle = '#f28c72';
  context.fill();
  context.strokeStyle = '#3f3f3f';
  context.lineWidth = 12;
  context.beginPath();
  context.moveTo(869, 342);
  context.lineTo(1115, 342);
  context.stroke();
  context.fillStyle = '#fffdf9';
  context.beginPath();
  context.arc(992, 342, 34, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();

  const category = categoryNames[payload.category] || 'ポケモンの話';
  context.fillStyle = '#e4edd9';
  context.beginPath();
  context.roundRect(96, 92, 188, 48, 22);
  context.fill();
  context.fillStyle = '#527146';
  context.font = '700 23px sans-serif';
  context.fillText(category, 120, 124);

  context.fillStyle = '#3f3f3f';
  context.font = '700 56px sans-serif';
  const titleLines = wrapCanvasText(context, payload.title, 680, 3);
  titleLines.forEach((line, index) => context.fillText(line, 96, 220 + index * 78));

  context.strokeStyle = '#eadfce';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(96, 442);
  context.lineTo(780, 442);
  context.stroke();

  context.fillStyle = '#6f706c';
  context.font = '22px sans-serif';
  const descriptionLines = wrapCanvasText(context, payload.description, 680, 2);
  descriptionLines.forEach((line, index) => context.fillText(line, 96, 492 + index * 34));

  context.fillStyle = '#50735f';
  context.font = '700 23px sans-serif';
  context.fillText('ポケモン好きの休憩所', 96, 588);

  return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
}

function makePrompt() {
  const title = $('title')?.value.trim() || '';
  const notes = $('notes')?.value.trim() || '';
  if (!title || !notes) throw new Error('公開タイトルと下書き用メモを入力してください。');
  const category = categoryNames[$('category')?.value] || 'ポケモンの話';
  const instructions = $('instructions')?.value.trim() || '断定しすぎず、個人の感想として自然に書いてください。';
  const question = $('question')?.value.trim() || '未入力';
  return `あなたは「ポケモン好きの休憩所」の編集者です。以下のメモをもとに、日本語のブログ記事本文を作成してください。\n\n【記事テーマ】\n${title}\n\n【カテゴリ】\n${category}\n\n【箇条書きメモ】\n${notes}\n\n【書き方の条件】\n- 読者を見下さず、強さや知識量を競う文章にしない\n- 個人ブログらしく、やわらかく読みやすい文体\n- 見出しは2〜4個。過度なSEO表現は使わない\n- 事実として断定できない内容は、推測・感想として分ける\n- 作品名・ポケモン名などの固有情報を補う場合、確認できないことを捏造しない\n- 本文は900〜1,500字を目安にする\n- 本文だけをMarkdown形式で出力する。記事タイトル、説明文、Frontmatterは出力しない\n- 記事末の問いかけは本文に書かない。公開時に別欄から自動表示する\n\n【追加の希望】\n${instructions}\n\n【記事末に自動表示する問いかけ】\n${question}`;
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
  if (!target) return;
  target.textContent = message;
  target.classList.toggle('is-error', error);
}

const publishedAtInput = $('publishedAt');
if (publishedAtInput) publishedAtInput.value = today();
loadDraft();
if (publishedAtInput && !publishedAtInput.value) publishedAtInput.value = today();
fields.forEach((field) => $(field)?.addEventListener('input', saveDraft));
$('category')?.addEventListener('change', saveDraft);

$('copy-prompt')?.addEventListener('click', async () => {
  try {
    await copyText(makePrompt());
    $('copy-prompt').textContent = 'コピーしました';
    window.setTimeout(() => { $('copy-prompt').textContent = 'AIへの依頼文をコピー'; }, 1800);
  } catch (error) {
    alert(error.message);
  }
});

$('clear-draft')?.addEventListener('click', () => {
  if (!window.confirm('入力した下書きをこのブラウザから消します。よろしいですか？')) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem('pokemon-break-room-studio-v1');
  fields.forEach((field) => { if ($(field)) $(field).value = ''; });
  if ($('publishedAt')) $('publishedAt').value = today();
  if ($('preview')) $('preview').innerHTML = '<p>ここに公開時に近い記事の見た目が表示されます。</p>';
});

$('show-preview')?.addEventListener('click', () => {
  renderArticlePreview();
});

$('download-markdown')?.addEventListener('click', () => {
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

const checkGithubButton = $('check-github');
if (checkGithubButton) {
  checkGithubButton.addEventListener('click', async () => {
    try {
      const key = $('publish-key')?.value.trim();
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
}

$('make-key')?.addEventListener('click', async () => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const key = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  if ($('publish-key')) $('publish-key').value = key;
  await copyText(key);
  setStatus('公開キーを作成してコピーしました。Cloudflareの PUBLISH_API_KEY に同じ値を登録してください。');
});

$('publish')?.addEventListener('click', async () => {
  try {
    const key = $('publish-key')?.value.trim();
    if (!key) throw new Error('公開キーを入力してください。');
    const payload = createMarkdown();
    payload.ogImageBase64 = makeOgImageBase64(payload);
    if (!window.confirm(`「${payload.title}」をGitHubへ公開します。よろしいですか？`)) return;
    setStatus('記事とOGP画像をGitHubへ反映しています…');
    const response = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Publish-Key': key },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || '公開に失敗しました。Cloudflare設定を確認してください。');
    setStatus(`記事とOGP画像をGitHubへ反映しました。Cloudflare Pagesの自動デプロイ完了後に公開されます。${result.commitUrl ? ' GitHubのコミット画面を開けます。' : ''}`);
    if (result.commitUrl) {
      const link = document.createElement('a');
      link.href = result.commitUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'GitHubのコミットを確認する →';
      link.className = 'text-link';
      $('publish-status')?.append(document.createElement('br'), link);
    }
  } catch (error) {
    setStatus(error.message, true);
  }
});
