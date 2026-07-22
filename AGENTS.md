# Currency Lens 開発ガイド

このリポジトリでは、このファイルを人間と Agent の共通ルールとします。
`CLAUDE.md` は互換用のシンボリックリンクであり、内容の正本は `AGENTS.md` です。

## プロダクト

Currency Lens は、Web ページ上で選択した金額を、ユーザーのお気に入り通貨へその場で換算する Chrome／Firefox 拡張機能です。
選択後に小さな Lens ボタンを表示し、クリックすると元のページを書き換えずに換算カードを開きます。
為替レートは Cloudflare Worker が Open Exchange Rates から取得し、R2 に保存します。

## 構成

- `apps/browser-extension`: WXT、React、Shadow DOM向けのプレーンCSSによる拡張機能です。
- `apps/server`: Hono、Cloudflare Workers、R2 による公開レート API です。
- `packages/currency`: 通貨コード、記号、表示桁などのメタデータです。
- `packages/oxr`: Open Exchange Rates の境界検証付きクライアントです。
- `.agents/skills/currency-lens-development`: このリポジトリ固有の開発・検証・リリース手順です。

依存方向は、拡張機能から `@cl/currency`、Worker から `@cl/oxr` です。
アプリケーション固有の実装を共有パッケージへ先回りで移しません。

## シークレットの絶対禁止事項

Agent は、ファイル名が `.env`、`.env.*`、`.dev.vars`、`.dev.vars.*` に一致するファイルを、場所や目的を問わず絶対に読みません。
`cat`、`sed`、`rg`、シェル展開、IDE、サブプロセス、テスト、ビルド、Wrangler などを経由した間接読み取りも禁止します。
Agent は、これらのファイルを作成、編集、コピー、名前変更、削除、表示、ログ出力しません。
必要な変数名は `README.md` と `docs/` だけから確認し、値は GitHub Environments、Cloudflare secrets、ブラウザストアの secrets で管理します。
コマンドが `.env*` または `.dev.vars*` を暗黙に読む可能性がある場合は実行せず、明示的に読み込まない経路へ直します。
サブエージェントへ作業を委譲するときも、この禁止事項を必ず伝えます。

## 開発コマンド

パッケージ管理には pnpm だけを使います。
ルートで次を実行します。

- `pnpm dev`: ルートの `.env` を明示的に読む人間専用の開発コマンドです。Agent は実行しません。
- `pnpm dev:agent`: 環境ファイルを読まず、拡張機能と Worker の開発タスクを開始します。
- `pnpm format`: Oxfmt で整形します。
- `pnpm format:check`: 整形差分がないことを確認します。
- `pnpm lint`: Oxlint の厳格ルールを実行します。
- `pnpm typecheck`: TypeScript 7 で型検査します。
- `pnpm test`: Vitest を一度実行します。
- `pnpm build`: process environment の `API_ENDPOINT`を使い、全ワークスペースを依存順にビルドします。環境ファイルは読みません。
- `pnpm check`: format、lint、typecheck をまとめて確認します。
- `pnpm validate`: format、lint、typecheck、test、build を一通り確認します。build用の`API_ENDPOINT`が必要です。

依存を変更したら `pnpm install --frozen-lockfile=false` で lockfile を同期します。Agentは完了前に`API_ENDPOINT=https://cl.dryk.net pnpm validate`を実行します。

## 実装ルール

外部入力は境界で Zod により検証し、型アサーションだけで信用しません。
ブラウザの storage、runtime message、HTTP response、R2 の JSON はすべて外部入力です。
金額検出、換算、鮮度判定、表示形式は可能な限り純粋関数にし、ブラウザ API、DOM、fetch、R2 は薄い境界へ寄せます。
関数には役割が分かる短いコメントを書きますが、コードの逐語説明は避けます。
公開入口を上に置き、呼び出し順に読み下せる配置にします。
回復可能な失敗は判別可能な結果として返し、予期しない失敗だけを境界で捕捉します。

拡張機能の Content Script UI は Shadow DOM 内へ描画し、ホストページへ CSS を漏らしません。
選択テキストはローカルだけで解析し、サーバーへ送信しません。
通常の Web ページだけを MVP 対象とし、PDF、canvas、フォーム入力、ブラウザ内部ページ、クロスオリジン iframe は対象外です。
お気に入りは最大5通貨、1回の選択から検出する金額は最大3件です。

## テストと画面確認

バグ修正では、可能なら修正前に失敗する再現テストを先に置きます。
純粋ロジックは Vitest、React の状態と操作は DOM テスト、配置・見た目・ホストページへの CSS 影響は実ブラウザで確認します。
UI を変更したら popup と換算カードのスクリーンショットを撮り、狭い幅、長い通貨名、loading、empty、error、success、キーボード操作、reduced motion を確認します。
スクリーンショットや生成物へ秘密情報を含めません。

## Git とリリース

通常の作業は `feature/*` から `develop` への Pull Request で行います。
`main` へは `develop` からの Pull Request だけを許可し、必須 CI を通します。
feature Pull Request は squash、`develop` から `main` への昇格は merge commit を使います。
`main` 更新時に Cloudflare Workers Builds から Worker を自動デプロイし、`v*` の GitHub Release 公開時に Chrome Web Store と Firefox Add-ons へ提出します。
初回のストア掲載、Cloudflare の Git 連携と Worker secret、ストア credentials、GitHub Environment の設定は人間が行います。

## 文書同期

仕様、設定、コマンド、デプロイ条件を変えたら、同じ Pull Request で `README.md` と `docs/`、必要ならリポジトリ Skill を更新します。
検証していない外部状態を完了済みと書きません。
