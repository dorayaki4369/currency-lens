# Currency Lens 開発ガイド

このファイルは、このリポジトリで作業する Agent のルールです。

## プロダクト

Currency Lens は、Web ページ上で選択した金額を、ユーザーが設定した換算先通貨へその場で換算する Chrome／Firefox 拡張機能です。
金額を選択すると小さな Lens ボタンを表示し、クリックすると元のページを書き換えずに換算カードを開きます。
為替レートは Cloudflare Worker が Open Exchange Rates から取得し、R2 に保存します。

MVP の対象は通常の Web ページだけです。
PDF、canvas、フォーム入力、ブラウザ内部ページ、クロスオリジン iframe は対象外です。

## 構成

| パス                                       | 内容                                                                                                  |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `apps/browser-extension`                   | WXT、React、TanStack Router、Tailwind CSS、shadcn/ui による拡張機能です。                             |
| `apps/server`                              | Hono、Cloudflare Workers、R2 による公開レート API です。                                              |
| `packages/currency`                        | 通貨コード、記号、表示桁などのメタデータです。                                                        |
| `packages/oxr`                             | Open Exchange Rates のクライアントです。                                                              |
| `.agents/skills/currency-lens-development` | このリポジトリ固有の開発・検証・リリース手順です。`.claude/skills` はここへのシンボリックリンクです。 |

依存方向は、拡張機能から `@cl/currency`、Worker から `@cl/oxr` の2本だけです。
アプリケーション固有の実装を、使う予定が見えないうちに共有パッケージへ移しません。

## コマンド

パッケージ管理には pnpm だけを使い、ルートで実行します。

| コマンド                | 内容                                                                                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`              | 拡張機能と Worker の開発サーバーを起動します。                                                                                                                         |
| `pnpm test:unit`        | Vitest で unit テストを一度実行します。`pnpm test` も同じです。                                                                                                        |
| `pnpm test:integration` | Vitest の Browser Mode で、実ブラウザの結合テストを実行します。                                                                                                        |
| `pnpm test:coverage`    | unit を実行し、4指標がファイルごとに100%であることを検証します。                                                                                                       |
| `pnpm test:e2e`         | Chrome 向けにビルドし、Firefox 版と審査用 sources ZIP を作ったうえで、成果物の構成と、Chromium へ読み込んだ拡張機能の主要導線を検証します。`API_ENDPOINT` が必要です。 |
| `pnpm build`            | 拡張機能と Worker をビルドします。環境変数 `API_ENDPOINT` が必要です。                                                                                                 |
| `pnpm check`            | 整形、lint、型検査をまとめて確認します。`pnpm check --fix` で自動修正します。                                                                                          |
| `pnpm validate`         | check、coverage、integration、build を順に実行します。`API_ENDPOINT` が必要です。                                                                                      |

依存を変更したら、`pnpm install --frozen-lockfile=false` で lockfile を同期します。

### 環境変数

必要な環境変数名は `.env.example` と `README.md` で確認します。
環境ファイルはリポジトリ直下の `.env` だけに置きます。

`pnpm dev` は `.env` があれば読み込みます。
`.env` がない場合や `API_ENDPOINT` が空の場合は、拡張機能の接続先をローカル Worker の `http://localhost:8787` にします。
`pnpm build` は環境ファイルを読まず、`API_ENDPOINT` が未設定ならエラーで止まります。

環境ファイルを読むコマンドを追加するときは、`node --env-file-if-exists` のように読み込み先を明示します。
ツールが自動で環境ファイルを探す経路や、アプリ配下の環境ファイルを読む経路は追加しません。

## 実装ルール

### コード全般

- 外部入力は境界で Zod により検証し、型アサーションだけで信用しません。ブラウザの storage、runtime message、HTTP response、R2 の JSON はすべて外部入力です。
- 金額検出、換算、鮮度判定、表示形式はできるだけ純粋関数にし、ブラウザ API、DOM、fetch、R2 は薄い境界へ寄せます。
- 回復可能な失敗は判別可能な結果として返し、予期しない失敗だけを境界で捕捉します。
- 関数には役割が分かる短いコメントを書き、コードを逐語的に説明するコメントは書きません。
- 公開する関数をファイルの上に置き、呼び出し順に読み下せる配置にします。

### 拡張機能

- Content Script の UI は Shadow DOM 内へ描画し、ホストページへ CSS を漏らしません。
- 選択テキストはローカルだけで解析し、サーバーへ送信しません。
- 検出処理は金額候補を出現順に返し、画面と Background Script へ渡すのは先頭の1件だけです。
- 換算先通貨は最大5つです。
- アプリケーションコードとテストでは、`@/` を `apps/browser-extension` のルートとして import します。Node が直接起動する設定やスクリプト、自動生成ファイルは、その実行環境が解決できるパスを使います。

## テスト

### 階層ごとの責務

テストは unit、integration、E2E の3階層です。
UI 専用やアクセシビリティ専用の階層は作らず、各階層で次を検証します。

| 階層        | 実行環境                                            | 検証すること                                                                                      |
| ----------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| unit        | Vitest                                              | 純粋関数、React コンポーネントの名前・role・状態・キーボード操作・focus・コールバック             |
| integration | Vitest Browser Mode（実ブラウザ）                   | DOM をまたぐ処理、ライト・ダーク表示、配置、動き、画面遷移、Shadow DOM、axe-core の検査           |
| E2E         | Playwright（ビルド済み拡張機能、ローカルの Worker） | Popup と Content Script の主要導線、Worker を通したレートの取得、ルート分割などビルド成果物の構成 |

読み上げ順、操作の分かりやすさ、実際のスクリーンリーダーでの案内は自動検査では分からないため、手動で確認します。

### 置き場所と名前

- `apps/browser-extension/components` 配下のコンポーネントには、同じディレクトリへ同名の `*.test.tsx` を置きます。対象を直接 import して公開動作を検証し、統合テスト経由の実行やカバレッジ到達では代替しません。
- `apps/browser-extension/entrypoints/popup/routes` 配下のルートにも、同じディレクトリへ同名の `*.test.tsx` を置きます。ルート生成はこの名前を除外します。
- `apps/browser-extension/test` には、複数の階層で共有するハーネスと、integration と E2E のテストだけを置きます。
- テストファイル名は `*.spec.ts(x)` か `*.test.tsx` にし、`*.vitest.ts` のようにツール名を入れません。
- テストの設定、コマンド、テスト専用の依存は、ルートの `vite.config.ts`、`playwright.config.ts`、`package.json` にまとめ、各パッケージには置きません。

### バグ修正

再現できる場合は、修正の前に、バグを再現して失敗するテストを書きます。

## UI を変更したとき

1. `pnpm test:unit`、`pnpm test:integration`、`pnpm test:e2e` のうち、影響するテストを通します。
2. integration と E2E が `apps/browser-extension/test/__screenshots__/review/` へ保存するレビュー用画像で、影響画面の見た目を確認します。
3. ホバー、キーボード操作、動きは、ビルド済み拡張機能か `pnpm dev` で起動した拡張機能で確認します。

確認する観点は、Popup の各設定画面と換算カードの、狭い幅、長い通貨名、loading、empty、error、success、キーボード操作、reduced motion です。

レビュー用画像は、既存の integration と E2E のテストが検証した画面から保存します。
画像を作るためだけのテストは作りません。
スクリーンショットや生成物に秘密情報を含めません。

## Git とリリース

### ブランチ

- 通常の作業は `feature/*` から `develop` への Pull Request で行い、merge commit で取り込みます。
- `main` へは `develop` からの Pull Request だけを許可し、必須 CI を通して merge commit で取り込みます。

### デプロイ

- `main` が更新されると、CI の `deploy Worker` job が、同じ commit の品質検査の成功後に Worker をデプロイします。
- `v*` の GitHub Release を公開すると、Chrome Web Store と Firefox Add-ons へ提出します。
- 提出の前に、release tag と同じ commit の `deploy Worker` の成功を待ちます。そのうえで、公開中の `/v1/latest` と旧 `/latest` を配布版クライアントの Zod schema で検証します。

### API の互換性

`/v1/latest` の契約は後方互換に保ちます。
項目の追加も破壊的変更として扱い、`/v2/latest` のような新しい route へ分けます。

### Agent が行わないこと

- 旧 route の廃止の判断
- 初回のストア掲載
- Cloudflare の API token の発行と Worker secret の設定
- ストアの認証情報、GitHub Actions の Environment／Repository variables／secrets の設定

これらは人間が行います。

## 作業を終える前に

1. 仕様、設定、コマンド、デプロイ条件を変えた場合は、同じ Pull Request で `README.md` と `docs/`、必要ならリポジトリ Skill を更新します。
2. `API_ENDPOINT=https://cl.dryk.net pnpm validate` を実行し、通ることを確認します。
3. 報告では、検証していない外部の状態を完了済みと書きません。
