# Currency Lens Worker

`apps/server`は、Open Exchange Ratesから取得した為替レートを検証してR2へ保存し、ブラウザ拡張機能へ配信するCloudflare Workerです。拡張機能が受け取るのは、検証済みのレートだけです。R2は外部に公開しません。

セットアップと共通のコマンドは[ルートのREADME](../../README.md)、外部サービスの設定は[デプロイとストア公開](../../docs/deployment.md)にあります。

## 動作

### レートの取得と保存

Cron Triggerが1時間ごとにOpen Exchange Ratesからレートを取得し、Zodで検証します。検証に通ったレートは、R2の次の2か所へ保存します。

- 提供元の時刻をファイル名に含むアーカイブ
- 最新のレートを置く`latest.json`

ログにはレートの値やsecretを出さず、保存先、件数、提供元の時刻などだけを残します。

### レートの配信

`GET /v1/latest`は、R2の`latest.json`を読んで検証し直し、`base`、`rates`、`timestamp`を返します。`timestamp`はWorkerが取得した時刻ではなく、Open Exchange Ratesが返した提供元の時刻です。旧版の拡張機能のため、`GET /latest`も同じ形式で返します。

CORSで許可するのは、Chrome・Firefox拡張機能のoriginからのGETだけです。

### R2が空のとき

R2が空で`OPEN_EXCHANGE_RATE_APP_ID`が設定されている場合は、最初のリクエストでOpen Exchange Ratesから取得し、R2に保存してから返します。同時に複数のリクエストが来ても、同じWorkerインスタンスの中では取得を1回にまとめます。

### 失敗したとき

次の場合は`503`を返します。

- R2の読み取りか検証に失敗した
- R2が空で、secretがないか、取得・保存に失敗した

R2のデータが壊れている場合は、初回取得の処理で上書きしません。

## ローカル開発

リポジトリ直下で依存関係を入れます。

```bash
pnpm install --frozen-lockfile
```

レートを取得するには、リポジトリ直下の`.env`にOpen Exchange RatesのApp IDを書きます。`pnpm -C apps/server dev`はこのファイルを読み込みます。

```dotenv
OPEN_EXCHANGE_RATE_APP_ID=your-app-id
```

`.env`がなくてもWorkerは起動しますが、App IDがないためレートを取得できず、ローカルのR2は空のままです。`apps/server`の中に`.env`や`.dev.vars`を置いても読み込みません。

```bash
pnpm -C apps/server dev
```

Workerは`http://localhost:8787`で起動し、本番と同じ処理でR2に保存済みのレートを返します。

```bash
curl --fail-with-body http://localhost:8787/v1/latest
```

ローカルではCronが自動で動かないため、レートを取得し直すときは次のリクエストで`scheduled`処理を手動で実行します。この入口は、開発コマンドに付けた`--test-scheduled`で有効になっています。

```bash
curl --fail-with-body "http://localhost:8787/__scheduled?cron=0+*+*+*+*"
```

## 検証とビルド

ふだんはリポジトリ直下の共通コマンドを使います。

```bash
pnpm check
pnpm test
pnpm build
```

Workerだけをビルドする場合と、型定義を生成し直す場合は次のコマンドを使います。

```bash
pnpm -C apps/server build
pnpm -C apps/server typegen
```

`typegen`は、`wrangler.jsonc`から`worker-configuration.d.ts`を生成し直します。R2のbinding、変数、互換日などを変えたときに実行します。

## デプロイ

Workerは、`main`が更新されたときにCloudflare Workers Buildsがデプロイします。初回設定と障害対応のとき以外は、ローカルから本番へデプロイしません。

R2 Bucketの作成、Open Exchange Ratesのsecretの登録、Custom Domainの設定、CloudflareとGitHubの接続は、リポジトリの外で行う作業です。手順は[デプロイとストア公開](../../docs/deployment.md)にあります。
