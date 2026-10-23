# Release

外部設定の値と手順の全体は `docs/deployment.md` が正本です。
この文書は、リリースに関わる作業で Agent が守る条件だけをまとめます。

## ブランチ

1. `feature/*` から `develop` へ Pull Request を作ります。
2. 必須 CI を通し、未解決の conversation をなくしてから merge commit で取り込みます。
3. `develop` から `main` へ Pull Request を作ります。
4. 必須 CI を通し、merge commit で `main` へ取り込みます。

`main` 向けの Pull Request は、head が同じリポジトリの `develop` でなければ CI が失敗します。
必須の承認数は0件です。
Pull Request と CI は必須です。
Ruleset が許可する merge 方法は、`develop` と `main` のどちらも merge commit だけです。
squash すると、merge 済みのブランチの上に作ったブランチで同じ変更が別の commit として残り、conflict の原因になるためです。

## Worker

- `main` が更新されると、`ci.yml` の `deploy Worker` job が、同じ SHA の `quality` の成功後に `pnpm --filter @cl/server run deploy` を実行します。
- `CLOUDFLARE_ACCOUNT_ID` と `CLOUDFLARE_API_TOKEN` は、`main` だけに制限した `production` Environment の secret に置きます。Repository secrets には置きません。
- Cloudflare Workers Builds の Git 連携は使いません。連携が残っていると Worker が二重にデプロイされます。
- `OPEN_EXCHANGE_RATE_APP_ID` は Cloudflare Worker secret だけに置きます。Wrangler の `secrets.required` が、secret があることを検査します。
- `main` への push で動く CI は、実行中の run を取り消しません。デプロイ中の run を止めないためです。待機中の古い run は、新しい push の run に置き換わります。

### デプロイが失敗した commit の復旧

原因を直したら、同じ run の `deploy Worker` を再実行するか、通常の Pull Request の経路で `main` へ新しい push を起こし、その SHA の `deploy Worker` が成功したことを確かめます。

## ブラウザストア

`v*` の GitHub Release を公開すると、Chrome と Firefox の ZIP を作り、WXT の submit で審査へ提出します。

提出の前に、次をすべて満たすことを確かめます。

- tag の version が `apps/browser-extension/package.json` の version と一致する
- release tag が現在の `main` の HEAD を指す
- 同じ commit で `deploy Worker` が成功している
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

- R2 bucket、Custom Domain の初回設定
- Cloudflare の API token の発行と、`production` Environment への secret の登録
- ストアの credentials を GitHub Actions の Repository secrets に登録すること
- 各ストアの初回 listing、説明、画像、プライバシー項目、公開範囲の設定
- 旧 route を廃止するかどうかの判断
