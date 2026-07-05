# ポケモン好きの休憩所

GitHub + Cloudflare Pagesで公開する、Astro製の静的ブログです。

- 公開サイト：記事・カテゴリ・RSS・サイトマップ
- 管理用ページ：`/studio/`
  - 箇条書きメモからAI用依頼文を生成
  - 生成したMarkdownを確認・プレビュー
  - Markdownをダウンロード
  - Cloudflare設定後はGitHubへ直接公開

## リポジトリ名・Cloudflareプロジェクト名

どちらも **`pokemon-break-room`** にしてください。

公開URLは次の形になります。

```text
https://pokemon-break-room.pages.dev
```

## 最初に行うこと

1. このZIPを展開する
2. 中身をGitHubの新規リポジトリ `pokemon-break-room` へアップロードする
3. Cloudflare Pagesでそのリポジトリを接続する
4. Cloudflareのビルド設定を入力する
   - Production branch: `main`
   - Build command: `npm run build`
   - Build output directory: `dist`
5. 公開後に `/studio/` を開く

詳しい手順は [SETUP.md](./SETUP.md) を読んでください。

## 記事を手動で追加する場合

`src/content/blog/` に以下の形のMarkdownファイルを追加します。

```md
---
title: "記事タイトル"
description: "検索やSNSに表示する説明文"
publishedAt: 2026-07-05
category: "favorite"
tags:
  - "タグ"
draft: false
---

# 見出し

本文
```

カテゴリは `favorite` / `memories` / `battle` / `chat` / `lounge` のいずれかです。

## ローカル確認（任意）

Node.js 20以上があるPCで、次を実行します。

```bash
npm install
npm run dev
```

公開用の確認は `npm run build` です。
