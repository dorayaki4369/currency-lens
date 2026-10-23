# デプロイとストア公開

品質検査、Cloudflare Workerのデプロイ、ブラウザ拡張機能のストア提出は、すべてGitHub Actionsが実行します。何をいつ実行するかは`.github/workflows/`、GitHubに登録する設定はリポジトリのSettingsが正本です。この文書には、そこから読み取れない設定の理由と、リポジトリの外で行う作業だけを書きます。

## GitHubの設定の理由

- feature branchから`develop`へも、`develop`から`main`へも、merge commitで取り込みます。squashすると、merge済みのbranchの上に作ったbranchで同じ変更が別のcommitとして残り、conflictの原因になるためです。
- 「Require branches to be up to date before merging」は無効にします。昇格のmerge commitは`main`にだけ作られるので、最新化を必須にすると次の昇格ができなくなるためです。Pull RequestのCIはmerge後の内容を検証するので、最新化しなくても検証は抜けません。
- 必須の承認数は0です。レビューする人がいないためで、collaboratorを追加するときは1以上にし、auto-mergeの扱いも見直します。
- `production` Environmentは`main`だけに制限し、承認者は置きません。`main`へのmergeで自動的にデプロイしつつ、Cloudflareのtokenを`main`以外のbranchのWorkflowから読めなくするためです。
- ストア用のsecretはRepository secretsに置きます。今は環境ごとに認証情報や承認者を分けていないためです。分けることになったら、ストア用のEnvironmentを考え直します。

## Cloudflareの初期設定

1. `open-exchange-rates-data` R2 bucketを作成します。
2. Worker `currency-lens`に`OPEN_EXCHANGE_RATE_APP_ID`をsecretとして設定します。この値はGitHub Actionsへ渡しません。
3. `dryk.net` zoneがActiveで、`cl.dryk.net`に競合するCNAMEがないことを確認します。Custom Domainは`apps/server/wrangler.jsonc`が正本で、デプロイ時にCloudflareがDNS recordと証明書を作ります。
4. `Edit Cloudflare Workers`テンプレートからAPI tokenを発行し、対象のaccountと`dryk.net` zoneだけに範囲を絞ります。Workers KVは使わないので、その権限は外してかまいません。
5. Worker `currency-lens`のSettings、BuildsでGitHub repositoryと接続していないことを確認します。接続が残っていると、Workerが二重にデプロイされます。

## ストアの初期設定

WXTは既存listingの更新を自動化しますが、最初のlistingは作成しません。Chrome Web Storeとaddons.mozilla.orgで初回登録、説明、画像、プライバシー情報を手動で設定してください。

ChromeではChrome Web Store APIを有効にしたGoogle Cloud projectを用意し、listing所有者のGoogle accountでOAuth refresh tokenを発行します。Firefoxではaddons.mozilla.orgのAPI credentialsからJWT issuerとJWT secretを発行します。

Firefoxの更新提出には、成果物のmanifestに固定のadd-on IDが必要です。初回登録でIDが決まった後、`apps/browser-extension/wxt.config.ts`の`browser_specific_settings.gecko.id`へ同じ値を設定してから自動公開を有効にしてください。

## 公開手順

1. `Publish browser extension`を`main`から手動で実行し、dry-runでWorkerとの互換性、credentialの登録漏れ、成果物を確かめます。
2. `apps/browser-extension/package.json`のversionを更新し、`develop`から`main`へ反映します。
3. `deploy Worker`が成功した現在のmain HEADへ`vMAJOR.MINOR.PATCH` tagを付け、同じtagで安定版GitHub Releaseを公開します。Workflowが検査に通ると、両ストアへ提出します。

ChromeとFirefoxへの提出は一つのトランザクションではなく、一方だけ成功することがあります。再実行する前にActions artifactと両ストアのdashboardを確認し、同じversionを再提出できる状態か判断してください。

`API_ENDPOINT`の値を変えると、配布する拡張機能の接続先も変わります。変えるときは、WorkerのCustom Domain、Firefox審査用の`SOURCE_CODE_REVIEW.md`もあわせて確認します。

## デプロイが失敗した場合

`deploy Worker`が失敗したSHAでは、ストアの公開Workflowが止まります。原因を直したら、同じrunの`deploy Worker`を再実行するか、Pull Requestを通して`main`への新しいpushを起こします。再実行できるのは、そのSHAが今も`main`の先頭にある場合だけです。古いSHAでは、古いコードで本番を上書きしないよう`deploy Worker`が失敗します。

## 参考資料

- [WXT: Publishing](https://wxt.dev/guide/essentials/publishing.html)
- [Chrome Web Store API](https://developer.chrome.com/docs/webstore/using-api)
- [Cloudflare Workers: GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)
- [Cloudflare API token templates](https://developers.cloudflare.com/fundamentals/api/reference/template/)
