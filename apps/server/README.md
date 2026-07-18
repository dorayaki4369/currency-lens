# Currency Lens Worker

`apps/server`は、Open Exchange Ratesから取得した為替レートを検証してR2へ保存し、ブラウザ拡張機能へ配信するCloudflare Workerです。役割は、検証済みのレートだけを拡張機能へ渡すことです。R2は公開しません。

リポジトリ全体の準備と共通コマンドは[ルートREADME](../../README.md)、外部サービスの設定は[デプロイとストア公開](../../docs/deployment.md)を参照してください。

## 動作

1時間ごとのCron TriggerがOpen Exchange Ratesを呼び出し、レスポンスをZodで検証します。検証に通ったデータは、提供元の時刻を名前に含むアーカイブと`latest.json`の両方へ保存します。ログにレート本体やsecretは出さず、保存先、件数、提供元時刻などのメタデータだけを残します。

`GET /latest`はR2の`latest.json`を読み、再度検証してから`base`、`rates`、`timestamp`を返します。`timestamp`はWorkerが取得した時刻ではなく、Open Exchange Ratesが返した提供元時刻です。CORSで許可するのはChrome・Firefox拡張機能のoriginとGETだけです。

R2が空で、`OPEN_EXCHANGE_RATE_APP_ID`が設定されている場合は、最初の`GET /latest`がOpen Exchange Ratesから取得してR2を初期化します。同時に複数の初回リクエストが来ても、同じWorkerインスタンス内では1回の取得にまとめます。

R2のデータが壊れている場合、secretがない場合、Open Exchange Ratesへの接続またはR2への保存に失敗した場合は`503`を返します。壊れたR2データを初回取得で上書きすることはありません。

## ローカル開発

最初にリポジトリ直下で依存関係を導入します。

```bash
pnpm install --frozen-lockfile
```

`example.env`は人間がローカル用secretの変数名を確認するための見本です。package scriptは`wrangler.no-secrets`を明示してWranglerの既定ファイル探索を止めるため、ローカル起動に必要な値は人間がshellのprocess environmentへ設定してください。`wrangler.no-secrets`には値を追加しません。

AI Agentは`.env`、`.env.*`、`.dev.vars`、`.dev.vars.*`を絶対に読み取りません。値の確認やファイル作成が必要になった時点で作業を止め、人間に設定を依頼します。

```bash
pnpm srv dev
```

Wranglerは`http://localhost:8787`でWorkerを起動します。現在のレート配信は次のリクエストで確認できます。

```bash
curl --fail-with-body http://localhost:8787/latest
```

`--test-scheduled`を有効にしているため、ローカルのCron Triggerは次のリクエストで実行できます。

```bash
curl --fail-with-body "http://localhost:8787/__scheduled?cron=0+*+*+*+*"
```

## 検証とビルド

通常はリポジトリ直下の共通コマンドを使います。

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Workerだけを扱うコマンドは次のとおりです。

```bash
pnpm srv typecheck
pnpm srv build
pnpm srv typegen
```

`typegen`は`wrangler.jsonc`から`worker-configuration.d.ts`を再生成します。R2 binding、変数、互換日などWranglerの設定を変更したときに実行してください。

## 外部設定とデプロイ

R2 Bucketの作成、Open Exchange Ratesのsecret登録、Custom Domainの設定、Cloudflare API tokenの発行は外部作業です。Workerのデプロイは`main`更新後のGitHub Actionsを正規経路とし、初回設定と障害対応以外でローカルから本番デプロイしません。必要な設定と確認順は[デプロイとストア公開](../../docs/deployment.md)にまとめています。
