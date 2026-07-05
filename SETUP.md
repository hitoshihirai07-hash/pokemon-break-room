# GitHub・Cloudflare Pages 設定手順

この手順は、PCのブラウザだけで行えます。ローカルでのコマンド操作は必須ではありません。

## 1. GitHubリポジトリを作る

1. GitHubにログインする。
2. 右上の `+` → **New repository** を選ぶ。
3. 次の通り入力する。
   - Repository name: `pokemon-break-room`
   - Description: `ポケモン好きの休憩所`
   - Visibility: `Public`
4. `Add a README file` は選ばない。
5. **Create repository** を押す。
6. 作成直後の画面で **uploading an existing file** を押す。
7. ZIPを展開したフォルダの中身を、すべてドラッグ＆ドロップする。
   - `pokemon-break-room` フォルダそのものではなく、その中にある `src`、`public`、`functions`、`package.json` などをアップロードする。
8. 画面下の **Commit changes** を押す。

## 2. Cloudflare Pagesへ接続する

1. Cloudflareにログインする。
2. 左メニューの **Workers & Pages** を開く。
3. **Create application** → **Pages** → **Connect to Git** を選ぶ。
4. GitHub連携が初めてなら、GitHubアカウントを連携する。
5. `pokemon-break-room` を選ぶ。
6. 設定は以下にする。

| 項目 | 入力値 |
|---|---|
| Project name | `pokemon-break-room` |
| Production branch | `main` |
| Framework preset | `Astro`（出る場合） |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | 空欄 |

7. **Save and Deploy** を押す。
8. ビルドが成功すると、`https://pokemon-break-room.pages.dev` で公開される。

## 3. Cloudflareの自動公開を確認する

GitHubの `main` ブランチへ記事やサイトの変更を追加すると、Cloudflare Pagesが自動で新しい公開版を作ります。

手動でテストする場合は、GitHubで `src/content/blog/` にMarkdownを1件追加して `Commit changes` を押してください。Cloudflare Pagesの `Deployments` で進行状況を見られます。

## 4. 記事作成室を使う（無料の基本運用）

1. 公開サイトの末尾に `/studio/` を付けて開く。
   - 例：`https://pokemon-break-room.pages.dev/studio/`
2. 記事テーマ・カテゴリ・箇条書きメモを入力する。
3. **AIへの依頼文をコピー** を押す。
4. このChatGPTに貼り付けて、本文の下書きを作る。
5. 下書き本文を記事作成室の「生成済みの本文」に貼る。
6. **記事をプレビュー** で確認する。
7. **Markdownを保存** を押すと、GitHubへ手動追加できる記事ファイルが取得できる。

この段階までは、GitHubトークンやCloudflareシークレットの設定は不要です。

## 5. 公開ボタンでGitHubへ反映する（任意・一度だけ設定）

この設定を行うと、記事作成室の **GitHubへ公開** から、記事Markdownが `src/content/blog/` に自動追加・更新されます。GitHubへの反映がCloudflare Pagesの自動デプロイを起動します。

### 5-1. GitHubのFine-grained personal access tokenを作る

1. GitHub右上のアイコン → **Settings**。
2. 左下の **Developer settings** → **Personal access tokens** → **Fine-grained tokens**。
3. **Generate new token** を選ぶ。
4. 次のように設定する。
   - Token name: `pokemon-break-room-publisher`
   - Expiration: 90日または任意の期間
   - Resource owner: 自分のアカウント
   - Repository access: **Only select repositories** → `pokemon-break-room`
   - Repository permissions → **Contents: Read and write**
5. トークンを作成し、表示された文字列をコピーする。
   - この文字列は、画面を閉じると再表示できないので、一時的に安全な場所へ保管する。

### 5-2. Cloudflare Pagesにシークレットを登録する

Cloudflareの **Workers & Pages** → `pokemon-break-room` → **Settings** → **Variables and Secrets** を開きます。

Production環境に、次の4つを追加します。

| 変数名 | 種別 | 値 |
|---|---|---|
| `GITHUB_TOKEN` | Secret | 5-1で作ったGitHubトークン |
| `GITHUB_OWNER` | Variable | GitHubのユーザー名 |
| `GITHUB_REPO` | Variable | `pokemon-break-room` |
| `GITHUB_BRANCH` | Variable | `main` |
| `PUBLISH_API_KEY` | Secret | 自分で作る長いランダム文字列 |

`PUBLISH_API_KEY` は、記事作成室の **公開キーを作る** を押して作成できます。作った文字列をCloudflareの `PUBLISH_API_KEY` に貼り付けて保存してください。

> `GITHUB_TOKEN` と `PUBLISH_API_KEY` は必ず **Secret** として登録します。公開ページ、GitHubリポジトリ、JavaScriptファイルには書かないでください。

シークレットを追加・変更したあとは、Cloudflare Pagesの **Deployments** から最新のデプロイを **Retry deployment** して反映します。

### 5-3. 公開ボタンを試す

1. `/studio/` を開く。
2. テーマ・メモ・本文を入力する。
3. `PUBLISH_API_KEY` と同じ公開キーを入力する。
4. **GitHubへ公開** を押す。
5. GitHubの `src/content/blog/` にMarkdownが追加される。
6. Cloudflare Pagesの自動デプロイ完了後、公開サイトに記事が表示される。

## 6. 記事を修正・非公開にする

### 修正

同じURL末尾（slug）を指定してもう一度公開すると、同名のMarkdownファイルを更新します。

### 非公開

GitHubで該当Markdownを開き、次の行を変更してCommitします。

```md
draft: true
```

### 削除

GitHubで該当Markdownを削除してCommitします。Cloudflare Pagesの次回デプロイ後に公開ページから消えます。

## 7. 独自ドメイン（必要になってから）

独自ドメインは後から追加できます。Cloudflare Pagesのプロジェクト → **Custom domains** から設定します。最初は `pages.dev` の無料URLのままで問題ありません。

## 8. つまずいたとき

- ビルドに失敗する：CloudflareのBuild commandが `npm run build`、Build output directoryが `dist` か確認する。
- 記事が表示されない：Markdownの `draft: false`、カテゴリ名、日付形式を確認する。
- 公開ボタンが401：`PUBLISH_API_KEY` と入力した公開キーが完全に一致しているか確認する。
- 公開ボタンが502：GitHubトークンの対象リポジトリと `Contents: Read and write` 権限を確認する。
- URLが違う：Cloudflareのプロジェクト名を変えた場合は `astro.config.mjs` の `site` も新しい公開URLに変更してCommitする。
