# Currency Lens

Currency Lensは、Webページで選択した金額をお気に入りの通貨へ換算するChrome・Firefox向けブラウザ拡張機能です。ページ内の価格を書き換えず、必要な箇所だけをGoogle翻訳のような小さな画面で確認できます。

## できること

- 通常のWebページで、通貨記号または通貨コードを含むテキストを選択して換算できます。
- 1回の選択から最大3件の金額を検出し、最大5件のお気に入り通貨へまとめて換算します。結果は最大15件です。
- `$`のように複数通貨で使われる記号は、ページやブラウザのロケールとユーザー設定を使って解釈します。
- 表示用UIはShadow DOM内に置き、閲覧中のページとCurrency Lensのスタイルが互いに影響しないようにします。
- 為替レートの取得に失敗しても、最後に検証できたレートを残します。レートの提供時刻から24時間を超えた場合は、古いレートであることを画面に表示します。

Chrome Web StoreとFirefox Add-onsの公開ページは次のとおりです。

- [Chrome Web Store](https://chrome.google.com/webstore/detail/currency-lens/cfpmgblhfmfomcgkpkghcgkcfblbpgkm)
- [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/currency-lens)

## 使い方

1. 拡張機能の設定画面で、換算先にしたい通貨を最大5件登録します。
2. Webページ上で、`$19.99`や`1,200 JPY`のような金額を含むテキストを選択します。
3. 選択範囲の近くに表示されるCurrency Lensのアイコンを押します。
4. 検出した金額とお気に入り通貨の組み合わせを換算結果で確認します。

ブラウザの設定画面、拡張機能ストアなど、ブラウザがContent Scriptの実行を禁止しているページでは動作しません。

## プライバシー

選択したテキストはContent Script内で解析し、Webページの外へ送りません。Background Scriptへ渡すのは、検出後の金額、通貨コード、換算先通貨だけです。Cloudflare Workerへの通信も為替レートの取得に限られ、選択テキストや閲覧ページの内容は送信しません。

設定は`browser.storage.sync`、検証済みの為替レートは`browser.storage.local`に保存します。Open Exchange Ratesの認証情報はCloudflare Workerだけが保持し、拡張機能には含めません。

## 開発環境

このリポジトリはpnpm workspaceによるモノリポです。タスク実行、整形、lint、型検査、テストにはVite+を使い、各アプリのビルドはWXTとWranglerが担当します。

- Node.js 24
- pnpm 11.13.0
- TypeScript 7
- Vite+
- WXT、React 19、Shadow DOM向けのプレーンCSS
- Cloudflare Workers、Hono、R2
- Zod 4、Vitest 4

Voltaを使う場合は、リポジトリの`package.json`に記載したNode.jsとpnpmのバージョンが選ばれます。

### 構成

```text
currency-lens/
├── apps/
│   ├── browser-extension/  # WXTで構築するChrome・Firefox拡張機能
│   └── server/             # 為替レートを配信するCloudflare Worker
├── packages/
│   ├── currency/           # 検出・表示に使う通貨メタデータ
│   └── oxr/                # Open Exchange Ratesクライアントと検証スキーマ
├── docs/
│   ├── architecture.md     # データフロー、正本、境界、失敗時の挙動
│   └── deployment.md       # GitHub、Cloudflare、ストア公開の設定
├── vite.config.ts          # Vite+の共通設定
└── pnpm-workspace.yaml
```

実装上の責務とデータフローは[アーキテクチャ](docs/architecture.md)、外部サービスの初期設定と公開手順は[デプロイとストア公開](docs/deployment.md)を参照してください。

## セットアップ

依存関係を導入します。

```bash
pnpm install --frozen-lockfile
```

人間がローカル開発を行う場合は、リポジトリ直下の`.env`へ必要な値を設定します。既存の項目がある場合は不足分だけ追加してください。

```dotenv
API_ENDPOINT=http://localhost:8787
OPEN_EXCHANGE_RATE_APP_ID=your-app-id
```

`API_ENDPOINT`はレートAPIのベースURLです。開発版と配布版は同じ変数名を使い、拡張機能が`/latest`を付けて接続します。ローカル開発では`.env`、GitHub Actionsによるストア提出用ビルドではRepository variableから値を渡します。

ブラウザ拡張機能だけを起動する場合は、対象ブラウザに合わせて次のいずれかを実行します。

```bash
pnpm ext dev
pnpm ext dev:firefox
```

Workerだけを起動する場合は、先に後述のローカル用secretを人間が用意してから実行します。

```bash
pnpm srv dev
```

全workspaceの開発タスクをまとめて起動する場合は`pnpm dev`を使います。これらの人間向け開発コマンドは、ルートの`.env`を明示的に読み込みます。各アプリに固有の手順は[ブラウザ拡張機能のREADME](apps/browser-extension/README.md)と[WorkerのREADME](apps/server/README.md)にあります。

### 機密情報

ローカル開発に必要な変数名は、このREADMEと各アプリの文書を正本とします。`.env`の実際の値はGitへ追加しません。

AI Agentは`.env`、`.env.*`、`.dev.vars`、`.dev.vars.*`を絶対に読み取りません。検索、内容表示、差分確認、コピー元としての参照も禁止です。Agentがローカル起動を必要とする場合は、環境ファイルを読まずに`API_ENDPOINT=http://localhost:8787`を渡す`pnpm dev:agent`を使います。このモードではOpen Exchange Ratesのsecretを渡さないため、空のローカルR2を自動初期化できません。

Cloudflare Worker、R2 Bucket、Custom Domain、Chrome Web Store、Firefox Add-onsの初回設定は、リポジトリ内のコードだけでは完了しない外部作業です。[デプロイとストア公開](docs/deployment.md)に従い、Cloudflareの管理画面とGitHub Environmentで設定してください。

## 開発コマンド

| コマンド             | 用途                                                 |
| -------------------- | ---------------------------------------------------- |
| `pnpm dev`           | `.env`を読み、人間向けの開発タスクをまとめて起動する |
| `pnpm dev:agent`     | 環境ファイルを読まずAgent向け開発タスクを起動する    |
| `pnpm format`        | リポジトリ全体を整形する                             |
| `pnpm format:check`  | 整形差分がないか確認する                             |
| `pnpm lint`          | Vite+で静的解析する                                  |
| `pnpm typecheck`     | TypeScript 7で型を検査する                           |
| `pnpm test`          | Vitestのテストを実行する                             |
| `pnpm test:coverage` | カバレッジを計測する                                 |
| `pnpm build`         | 全workspaceをビルドする                              |
| `pnpm validate`      | 品質検査、テスト、ビルドをまとめて実行する           |

`pnpm build`と`pnpm validate`は環境ファイルを読みません。ローカルで実行するときは、`API_ENDPOINT`をprocess environmentへ明示的に渡してください。GitHub Actionsでは、CIは既知の本番URL、ストア提出用ビルドはRepository variableを使います。WorkerのデプロイはCloudflare Workers Buildsが担当し、`API_ENDPOINT`を必要としません。

Chrome版とFirefox版を個別にビルドする場合は、次のコマンドを使います。

```bash
pnpm ext build
pnpm ext build:firefox
```

## ブランチと公開

通常の開発は`develop`へPull Requestを作成し、リリース時は`develop`から`main`へのPull Requestで昇格させます。`main`へ直接変更を入れる運用は想定していません。

`develop`または`main`へのpushとPull Requestでは、GitHub Actionsがformat、lint、型検査、テスト、ビルドを実行します。必須CIを通って`main`が更新されると、Cloudflare Workers BuildsがWorkerを自動デプロイします。ブラウザ拡張機能は安定版GitHub Releaseを起点にChrome Web StoreとFirefox Add-onsへ提出します。
