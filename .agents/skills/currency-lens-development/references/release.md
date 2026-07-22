# Release

## ブランチ

1. `feature/*` から `develop` へ Pull Request を作ります。
2. 必須 CI と会話解決を通し、feature は squash merge します。
3. `develop` から `main` へ Pull Request を作ります。
4. `main` への head branch guard と必須 CI を通し、merge commit で昇格します。

一人開発では self approval ができないため、required approval は0件にします。
Pull Request と CI は必須のままです。

## Worker

`main` 更新で Cloudflare Workers Builds が `pnpm --filter @cl/server run deploy` を実行します。
GitHub Actions からは Worker をデプロイせず、`CLOUDFLARE_ACCOUNT_ID` と `CLOUDFLARE_API_TOKEN` を GitHub secrets に置きません。
Cloudflare の production branch は `main`、root directory はリポジトリ直下、build command は空、deploy command は上記コマンドとします。
Node.js はリポジトリ直下の `.node-version` から検出させ、Build variable は `PNPM_VERSION=11.13.0` だけを設定します。
`OPEN_EXCHANGE_RATE_APP_ID` は Cloudflare Worker secret を正本とし、Wrangler の `secrets.required` で存在を検査します。
R2 bucket、custom domain、GitHub 連携は初回だけ人間が確認・作成します。
Build watch paths は設定せず、`main` の全 commit に Cloudflare Check Run を作ります。
Cloudflare 側の設定変更は過去の `main` push を再処理しません。
既存 SHA に check がない場合は、設定を修正したうえで通常の Pull Request 経路から新しい `main` push を発生させ、その SHA の check 成功を確認します。
Deploy Hook は build の起動に使えても、既存 SHA への GitHub Check Run の追加を前提にした復旧手段として扱いません。
Deploy Hook URL は認証情報として扱い、リポジトリ、Issue、Pull Request、チャット、CI ログへ記録しません。

## ブラウザストア

`v*` の GitHub Release 公開で Chrome／Firefox の ZIP を作り、WXT submit で審査へ提出します。
タグの version と `apps/browser-extension/package.json` の version を一致させます。
release tag は現在の `main` HEAD と一致させます。
提出 job より先に、同じ commit の `Workers Builds: currency-lens` 成功を待ち、公開中の `/v1/latest` と旧 `/latest` をクライアントの Zod schema で検証します。
Cloudflare の check がない、失敗した、timeout した、または公開 API が契約を満たさない場合は、ストア credentials を参照する前に停止します。

v1 の `base`、`rates`、`timestamp` は後方互換に保ちます。
項目追加を含む破壊的変更は `/v2/latest` のような新しい route へ分け、旧 route の廃止は配布済み拡張機能の利用状況を確認してから人間が判断します。

次の値は GitHub Actions の Repository secrets に登録します。

Chrome Web Store:

- `CHROME_EXTENSION_ID`
- `CHROME_CLIENT_ID`
- `CHROME_CLIENT_SECRET`
- `CHROME_REFRESH_TOKEN`

Firefox Add-ons:

- `FIREFOX_EXTENSION_ID`
- `FIREFOX_JWT_ISSUER`
- `FIREFOX_JWT_SECRET`

初回 listing、説明、画像、プライバシー項目、公開範囲は各ストアの Dashboard で人間が設定します。
Firefox の sources ZIP は、秘密ファイルを含まず、展開先で `pnpm install --frozen-lockfile` と Firefox build を再現できることを確認します。
