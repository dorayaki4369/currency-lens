# Currency Lens

Currency Lensは、Webページで選択した金額を、登録した通貨へその場で換算するChrome・Firefox向けの拡張機能です。ページ内の価格は書き換えず、選択した箇所の近くに小さな換算カードを開きます。

対応ブラウザは、デスクトップ版のChromeと、Firefox 140以降です。Firefox for Androidには対応していません。

- [Chrome Web Store](https://chrome.google.com/webstore/detail/currency-lens/cfpmgblhfmfomcgkpkghcgkcfblbpgkm)
- [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/currency-lens)

## 使い方

1. 拡張機能のPopupで、換算後に表示したい通貨を最大5件登録します。変更はその場で保存されます。
2. Webページ上で、`$19.99`や`1,200 JPY`のような金額を含むテキストを選択します。
3. 選択範囲の近くに出るCurrency Lensのロゴ（青い虫眼鏡と黄色いドル記号）を押します。
4. 換算カードに、登録した通貨での金額が表示されます。

ブラウザの設定画面や拡張機能ストアなど、ブラウザが拡張機能の実行を禁止しているページでは動作しません。

## できること

- **金額の検出**: 通貨記号、通貨コード、または「円」「dollars」のような各言語の通貨名を含むテキストから金額を見つけます。選択範囲に複数の金額がある場合は、最初の1件を換算します。
- **曖昧な記号の解釈**: `$`のように複数の通貨で使われる記号は、ユーザー設定、ページの言語、ブラウザの言語の順に手がかりにして通貨を決めます。記号ごとの解釈はPopupの設定から変えられます。
- **Popupでの換算**: Popupのトップでは、金額と換算元の通貨を自由に入力して換算できます。換算後の通貨の追加、削除、並べ替えも同じ画面でできます。
- **換算カードでの再換算**: ページ上の換算カードでも、換算元の金額と通貨を書き換えて換算し直せます。
- **表示**: 換算後の金額は小数点以下2桁に丸め、表示幅に収まらない場合は指数表記にします。UIは日本語と英語に対応し、ブラウザの言語に合わせて切り替えます。
- **ページとの分離**: 換算カードはShadow DOMの中に描画するため、閲覧中のページとCurrency Lensのスタイルは互いに影響しません。
- **レートの保持**: レートの取得に失敗しても、最後に取得できたレートで換算を続けます。レートの提供時刻から24時間以上たった場合は、古いレートであることを画面に表示します。

## プライバシー

選択したテキストは拡張機能の中だけで解析し、外部へ送信しません。拡張機能がサーバーへ送る通信は為替レートの取得だけで、閲覧中のページの内容は含みません。

設定は`browser.storage.sync`、為替レートは`browser.storage.local`に保存します。Open Exchange Ratesの認証情報はCloudflare Workerだけが持ち、拡張機能には含めません。

ストアに掲載するプライバシーポリシーは、Workerが<https://cl.dryk.net/privacy>で配信します。原本は`apps/server/public/privacy.html`です。拡張機能やWorkerが扱う情報を変えたときは、あわせて更新します。

## 開発

### ディレクトリ構成

```text
currency-lens/
├── apps/
│   ├── browser-extension/  # WXTで構築するChrome・Firefox拡張機能
│   └── server/             # 為替レートを配信するCloudflare Worker
├── packages/
│   ├── currency/           # 通貨コード、記号、表示桁のメタデータ
│   └── oxr/                # Open Exchange Ratesのクライアント
├── docs/
│   ├── architecture.md     # データフロー、正本、境界、失敗時の動作
│   ├── deployment.md       # GitHub、Cloudflare、ストア公開の設定
│   └── design-qa.md        # テストの配置と画面の確認手順
├── vite.config.ts          # 整形、lint、テストの共通設定
└── pnpm-workspace.yaml
```

各アプリの詳細は[ブラウザ拡張機能のREADME](apps/browser-extension/README.md)と[WorkerのREADME](apps/server/README.md)にあります。

### 使っている技術

- Node.js 24.11.1、pnpm 11.24.0、TypeScript 7
- Vite+（タスク実行、整形、lint、型検査、テスト）
- 拡張機能: WXT、React 19、Zustand、TanStack Router、Tailwind CSS、shadcn/ui
- Worker: Cloudflare Workers、Hono、R2
- 検証: Zod 4、Vitest 4、Playwright

### セットアップ

Node.jsとpnpmのバージョンは[mise](https://mise.jdx.dev/lang/node.html#nvmrc-node-version-and-package-json-support)で管理します。Node.jsは`.node-version`、pnpmは`package.json`の`packageManager`からバージョンを読みます。

```bash
mise trust
mise install
mise exec -- pnpm install --frozen-lockfile
```

シェルでmiseを有効にしている場合は、以降の`pnpm`コマンドをそのまま実行できます。有効にしていない場合は`mise exec -- pnpm …`で実行します。

### 環境変数

ローカル開発で使う値は、リポジトリ直下の`.env`に書きます。変数名の一覧は`.env.example`にあります。

```dotenv
API_ENDPOINT=http://localhost:8787
OPEN_EXCHANGE_RATE_APP_ID=your-app-id
```

| 変数                        | 用途                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| `API_ENDPOINT`              | 拡張機能が接続するレートAPIのベースURLです。拡張機能はこれに`/v1/latest`を付けて接続します。 |
| `OPEN_EXCHANGE_RATE_APP_ID` | WorkerがOpen Exchange Ratesからレートを取得するためのApp IDです。                            |

`.env`は必須ではありません。`.env`がない場合、開発サーバーは`API_ENDPOINT`をローカルWorkerの`http://localhost:8787`にして起動します。ただし、App IDがないためWorkerはレートを取得できず、ローカルのR2は空のままです。

`pnpm build`と`pnpm validate`は`.env`を読みません。ローカルで実行するときは、`API_ENDPOINT=https://cl.dryk.net pnpm validate`のように値を直接渡します。GitHub Actionsでは、CIは本番のURL、ストア提出用のビルドはRepository variableの値を使います。

環境ファイルは、リポジトリ直下の`.env`だけに置きます。アプリ配下に`.env`や`.dev.vars`を置いても、どのコマンドも読みません。`.env.example`と`.dev.vars.example`以外の環境ファイルは、`.gitignore`とCIの検査によってGitへ追加できないようにしています。

AI Agentは、リポジトリ直下の`.env`と`.dev.vars`を読み書きできません。Claude Codeは`.claude/settings.json`の権限とサンドボックス、Codexは`.codex/config.toml`の権限で禁止しています。

### 開発サーバー

拡張機能とWorkerをまとめて起動します。

```bash
pnpm dev
```

Chrome向けの開発サーバーは`http://localhost:3000/sandbox.html`を自動で開きます。片方だけを起動する場合は次のコマンドを使います。

```bash
pnpm -C apps/browser-extension dev          # 拡張機能（Chrome）
pnpm -C apps/browser-extension dev:firefox  # 拡張機能（Firefox）
pnpm -C apps/server dev                     # Worker
```

ローカルのWorkerは、R2に保存済みのレートを返します。レートを取得し直す手順は[Workerのローカル開発](apps/server/README.md#ローカル開発)にあります。

### コマンド

ルートで実行します。

| コマンド                | 用途                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm dev`              | 拡張機能とWorkerの開発サーバーを起動する                                                                                       |
| `pnpm check`            | 整形、lint、型検査をまとめて確認する。`--fix`を付けると自動修正する                                                            |
| `pnpm test`             | unitテストを実行する（`pnpm test:unit`と同じ）                                                                                 |
| `pnpm test:integration` | 実ブラウザで結合テストを実行する                                                                                               |
| `pnpm test:coverage`    | unitテストのカバレッジ4指標が全ファイルで100%であることを検証する                                                              |
| `pnpm test:e2e`         | 拡張機能をビルドし、Chromiumへ読み込んで主要な操作を検証する。Firefox審査用のsources ZIPの中身も検証する。`API_ENDPOINT`が必要 |
| `pnpm build`            | 拡張機能とWorkerをビルドする。`API_ENDPOINT`が必要                                                                             |
| `pnpm validate`         | check、coverage、integration、buildを順に実行する。`API_ENDPOINT`が必要                                                        |
| `pnpm store:dev`        | ストア掲載用の宣伝画像を`http://127.0.0.1:4310/`でプレビューする。元になるレビュー用画像が必要                                 |
| `pnpm store:images`     | ストア掲載用の宣伝画像を`apps/browser-extension/.output/store-images/`へ書き出す。元になるレビュー用画像が必要                 |

拡張機能のビルドとストア提出用ZIPの作成は、[ブラウザ拡張機能のREADME](apps/browser-extension/README.md#ビルド)を参照してください。

### テストと画面の確認

テストはunit、integration、E2Eの3階層に分け、UI専用のテスト階層は作りません。どの階層で何を検証するか、UIを変更したときに何を確認するかは[画面品質の確認手順](docs/design-qa.md)にあります。

データフロー、設定やレートの正本、CSSの設計方針は[アーキテクチャ](docs/architecture.md)にあります。

## ブランチと公開

通常の開発は`develop`へのPull Requestで行い、リリース時に`develop`から`main`へのPull Requestで昇格させます。`main`へ直接変更を入れることはありません。

`develop`と`main`へのpushとPull Requestでは、GitHub Actionsが`pnpm check`、カバレッジ検証、integration、E2E、ビルドを別々のjobとして並列に実行し、unitのカバレッジをPull Requestへコメントします。`main`が更新されると、同じCIがすべてのjobの成功後にWorkerをデプロイします。拡張機能のversionと変更履歴は[Changesets](https://changesets.dev/)で管理します。利用者に見える変更を含むPull Requestには`pnpm changeset`でchangesetを追加し、`pnpm changeset version`で更新したversionが`main`に入ると、Chrome Web StoreとFirefox Add-onsへ提出されてtagとGitHub Releaseが作られます。手順は[デプロイとストア公開](docs/deployment.md#公開手順)にあります。

Cloudflare、R2、Custom Domain、各ストアの初回設定は、リポジトリの外で行う作業です。手順は[デプロイとストア公開](docs/deployment.md)にあります。
