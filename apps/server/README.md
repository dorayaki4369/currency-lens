# Currency Lens Worker

`apps/server`は、Open Exchange Ratesから取得した為替レートを検証してR2へ保存し、ブラウザ拡張機能へ配信するCloudflare Workerです。拡張機能が受け取るのは、検証済みのレートだけです。R2は外部に公開しません。

セットアップと共通のコマンドは[ルートのREADME](../../README.md)、外部サービスの設定は[デプロイとストア公開](../../docs/deployment.md)にあります。

## 動作

### レートの取得と保存

Cron Triggerが1時間ごとにOpen Exchange Ratesからレートを取得し、Zodで検証します。検証に通ったレートは、R2の次の2か所へ保存します。

- 提供元の時刻をファイル名に含むアーカイブ
- 最新のレートを置く`latest.json`

ログにはレートの値やsecretを出さず、保存先、件数、提供元の時刻などだけを残します。

### レート履歴の集約

保存の後、同じCron Triggerでレート履歴の集約ファイルを更新します。集約ファイルは、アーカイブから作り直せる派生データです。更新に失敗しても、最新レートの保存は成功として扱い、エラーの名前とメッセージだけをログに残します。壊れた集約ファイルは、次の実行で空から作り直し、作り直したキーをログに残します。

| R2のキー                    | 内容                                                                       |
| --------------------------- | -------------------------------------------------------------------------- |
| `history/hourly.tsv`        | 直近121時間の1時間ごとのレート（全通貨）                                   |
| `history/daily/YYYY-MM.tsv` | UTCの各日の最後のアーカイブを終値とした、1か月分の日ごとのレート（全通貨） |
| `history/backfill.json`     | 過去の日を遡って埋める処理の、次に調べる日付                               |

`.tsv`の集約ファイルは、1行目がJSONの見出し（`{"version":1,"start":...}`または`{"version":1,"month":...}`）で、2行目以降が`通貨コード<TAB>[値,...]`の形です。値は有効数字6桁に丸め、欠けている枠は`null`です。`GET /v1/history`は要求された通貨の行だけを解析するので、全通貨のJSONを解析するより CPU 時間がかかりません。

1回の実行では、最新のレートを書き込むほか、次の修復を上限つきで行います。Workers Freeプランの CPU 時間とサブリクエスト数の上限に収めるためです。

- 1時間ごとのレートが欠けている枠を6件まで、アーカイブから埋めます。半分は新しい枠から、残りは古い枠を順番に選び、アーカイブにない枠が古い枠の修復を妨げないようにします。
- 直近3日の終値が欠けていれば、アーカイブから埋めます。
- 365日前までの日を古い方へ4日ずつ調べ、終値を埋めます。現在の形式のキー（`2026-11-21T09:00:00.000Z.json`）がなければ、旧形式のキー（`latest/{ミリ秒}/USD.json`）を探します。

アーカイブにない時間や日は空のままです。Open Exchange Ratesから過去のレートを取り直す処理は、[Issue #79](https://github.com/dorayaki4369/currency-lens/issues/79)で扱います。

### レートの配信

`GET /v1/latest`は、R2の`latest.json`を読んで検証し直し、`base`、`rates`、`timestamp`を返します。`timestamp`はWorkerが取得した時刻ではなく、Open Exchange Ratesが返した提供元の時刻です。旧版の拡張機能のため、`GET /latest`も同じ形式で返します。

`GET /v1/history?resolution=hourly|daily&symbols=JPY,EUR`は、USD基準のレート履歴を返します。`symbols`には重複のない通貨コードを1〜6件、カンマで区切って指定します。

```json
{
  "base": "USD",
  "resolution": "daily",
  "start": "2025-11-21T00:00:00.000Z",
  "rates": { "JPY": [149.1, null, 149.5] }
}
```

- `hourly`は、現在の時刻を含む直近121時間を1時間ごとに返します。`start`は最初の枠の開始時刻です。
- `daily`は、今日を含む直近366日をUTCの1日ごとに返します。各日の値はその日の最後のアーカイブで、最後の要素だけは今日の最新のレートです。
- 値のない枠は`null`です。どの枠にも値がない通貨は`rates`に含めません。
- 応答はCache APIで5分間保存します。キャッシュのキーでは`symbols`の並び順をそろえます。キャッシュの読み書きに失敗しても、応答は変えません。

不正なクエリには`400`、集約ファイルの読み取りや検証の失敗には`503`を返します。

CORSで許可するのは、Chrome・Firefox拡張機能のoriginからのGETだけです。

### ランディングページ

`GET /`は、Currency Lens の紹介とストアへのリンク、レート API の案内を載せたランディングページを返します。`public/index.html`をWorkersの静的アセットとして配信するため、Workerのコードは動きません。プライバシーポリシーと同じく、scriptや外部リソースを持たず、`public/_headers`のContent-Security-Policyで読み込みと埋め込みを禁止します。

### プライバシーポリシー

`GET /privacy`は、ストアの掲載情報から参照するプライバシーポリシーを返します。`public/privacy.html`をWorkersの静的アセットとして配信するため、Workerのコードは動きません。scriptや外部リソースを持たず、`public/_headers`のContent-Security-Policyで読み込みと埋め込みを禁止します。

配信とヘッダーは、Wranglerの`createTestHarness()`で手元にWorkerを起動して確かめます（`test/static-assets.spec.ts`）。

### R2が空のとき

R2が空で`OPEN_EXCHANGE_RATE_APP_ID`が設定されている場合は、最初のリクエストでOpen Exchange Ratesから取得し、R2に保存してから返します。同時に複数のリクエストが来ても、同じWorkerインスタンスの中では取得を1回にまとめます。

### 失敗したとき

`GET /v1/latest`は、次の場合に`503`を返します。

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
curl --fail-with-body "http://localhost:8787/v1/history?resolution=hourly&symbols=JPY,EUR"
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

Workerは、`main`が更新されたときにGitHub ActionsのCIがデプロイします。初回設定と障害対応のとき以外は、ローカルから本番へデプロイしません。

R2 Bucketの作成、Open Exchange Ratesのsecretの登録、Custom Domainの設定、デプロイ用のAPI tokenの登録は、リポジトリの外で行う作業です。手順は[デプロイとストア公開](../../docs/deployment.md)にあります。
