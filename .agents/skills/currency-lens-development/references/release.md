# Release

外部設定の値と手順の全体は `docs/deployment.md` が正本です。
この文書は、リリースに関わる作業で Agent が守る条件だけをまとめます。

## ブランチ

1. `feature/*` から `develop` へ Pull Request を作ります。
2. 必須 CI を通し、未解決の conversation をなくしてから squash merge します。
3. `develop` から `main` へ Pull Request を作ります。
4. 必須 CI を通し、merge commit で `main` へ取り込みます。

`main` 向けの Pull Request は、head が同じリポジトリの `develop` でなければ CI が失敗します。
必須の承認数は0件です。
Pull Request と CI は必須です。

## Worker

- `main` が更新されると、Cloudflare Workers Builds が `pnpm --filter @cl/server run deploy` を実行します。
- GitHub Actions から Worker をデプロイしません。`CLOUDFLARE_ACCOUNT_ID` と `CLOUDFLARE_API_TOKEN` を GitHub secrets に置きません。
- `OPEN_EXCHANGE_RATE_APP_ID` は Cloudflare Worker secret だけに置きます。Wrangler の `secrets.required` が、secret があることを検査します。
- Build watch paths は設定しません。`main` のすべての commit に Cloudflare Check Run を作るためです。

### Check Run がない commit の復旧

Cloudflare の設定を直しても、過去の `main` への push は処理し直されません。
対象の SHA に Check Run がない場合は、設定を直したうえで、通常の Pull Request の経路で `main` へ新しい push を起こし、その SHA の Check Run が成功したことを確かめます。

Deploy Hook は、既存の SHA に Check Run が付くとは限らないため、復旧の手段にしません。
Deploy Hook の URL は認証情報なので、リポジトリ、Issue、Pull Request、チャット、CI ログに書きません。

## ブラウザストア

`v*` の GitHub Release を公開すると、Chrome と Firefox の ZIP を作り、WXT の submit で審査へ提出します。

提出の前に、次をすべて満たすことを確かめます。

- tag の version が `apps/browser-extension/package.json` の version と一致する
- release tag が現在の `main` の HEAD を指す
- 同じ commit で `Workers Builds: currency-lens` が成功している
- 公開中の `/v1/latest` と旧 `/latest` が、配布するクライアントの Zod schema を満たす

どれかを満たさない場合、Workflow はストアの credentials を参照する前に停止します。

### API の互換性

`/v1/latest` の `base`、`rates`、`timestamp` は後方互換に保ちます。
項目の追加も破壊的変更として扱い、`/v2/latest` のような新しい route へ分けます。

### Firefox の sources ZIP

sources ZIP に秘密情報を含めません。
展開した先で `pnpm install --frozen-lockfile` と Firefox 版のビルドを再現できることを確かめます。

## 人間が行うこと

Agent は次の作業を行わず、必要になったら人間に依頼します。

- R2 bucket、Custom Domain、Cloudflare と GitHub の連携の初回設定
- ストアの credentials を GitHub Actions の Repository secrets に登録すること
- 各ストアの初回 listing、説明、画像、プライバシー項目、公開範囲の設定
- 旧 route を廃止するかどうかの判断
