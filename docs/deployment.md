# デプロイとストア公開

品質検査、Cloudflare Workerのデプロイ、ブラウザ拡張機能のストア提出は、すべてGitHub Actionsが実行します。何をいつ実行するかは`.github/workflows/`、GitHubに登録する設定はリポジトリのSettingsが正本です。この文書には、そこから読み取れない設定の理由と、リポジトリの外で行う作業だけを書きます。

## GitHubの設定の理由

- feature branchから`develop`へも、`develop`から`main`へも、merge commitで取り込みます。squashすると、merge済みのbranchの上に作ったbranchで同じ変更が別のcommitとして残り、conflictの原因になるためです。
- 「Require branches to be up to date before merging」は両branchで無効にします。`main`では、昇格のmerge commitが`main`にだけ作られるため、最新化を必須にすると次の昇格ができなくなります。`develop`では、auto-mergeを予約したPull Requestが、別のPull Requestが入るたびに手動の最新化を待たないようにするためです。別々にCIを通ったPull Requestの組み合わせで壊れた場合は、`develop`へのpushで動くCIと、昇格のPull RequestのCIで止まります。
- 必須の承認数は0です。レビューする人がいないためです。auto-mergeは書き込み権限を持つ人なら承認なしで有効にできるため、collaboratorを追加するときは承認数を1以上にし、auto-mergeの扱いも見直します。
- fork Pull Requestのworkflow実行は、外部の人すべてについて承認を必須にします。secretは渡りませんが、外部のコードでCIを動かす前に内容を確かめるためです。
- `production` Environmentは`main`だけに制限し、承認者は置きません。`main`へのmergeで自動的にデプロイしつつ、Cloudflareのtokenを`main`以外のbranchのWorkflowから読めなくするためです。
- ストア用のsecretはRepository secretsに置きます。今は環境ごとに認証情報や承認者を分けていないためです。Environmentで守らない代わりに、`main`と`develop`のRulesetでWorkflowの書き換えを防ぎます。分けることになったら、ストア用のEnvironmentを考え直します。
- `API_ENDPOINT`は公開されているURLなので、secretではなくRepository variableにしています。

## Workflowを変更するとき

外部のActionは`.github/workflows/actions.lock`に記録したcommitで実行します。`uses`を追加・変更したら、[gh-actions-lock](https://github.com/github/gh-actions-lock)の`gh actions-lock`でlockfileを更新し、Workflowと同じcommitに含めます。lockfileは手で編集しません。

## Cloudflareの初期設定

1. `open-exchange-rates-data` R2 bucketを作成します。
2. Worker `currency-lens`に`OPEN_EXCHANGE_RATE_APP_ID`をsecretとして設定します。この値はGitHub Actionsへ渡しません。
3. `dryk.net` zoneがActiveで、`cl.dryk.net`に競合するCNAMEがないことを確認します。Custom Domainは`apps/server/wrangler.jsonc`が正本で、デプロイ時にCloudflareがDNS recordと証明書を作ります。
4. `Edit Cloudflare Workers`テンプレートからAPI tokenを発行し、対象のaccountと`dryk.net` zoneだけに範囲を絞ります。Workers KVは使わないので、その権限は外してかまいません。
5. Worker `currency-lens`のSettings、BuildsでGitHub repositoryと接続していないことを確認します。接続が残っていると、Workerが二重にデプロイされます。

## ストアの初期設定

WXTは既存listingの更新を自動化しますが、最初のlistingは作成しません。Chrome Web Storeとaddons.mozilla.orgで初回登録、説明、画像、プライバシー情報を手動で設定してください。プライバシーポリシーのURLには、Workerが配信する`https://cl.dryk.net/privacy`を指定します。このページは`main`へのmerge後の`deploy Worker`で公開されます。

ChromeではChrome Web Store APIを有効にしたGoogle Cloud projectを用意し、listing所有者のGoogle accountでOAuth refresh tokenを発行します。Firefoxではaddons.mozilla.orgのAPI credentialsからJWT issuerとJWT secretを発行します。

Firefoxの更新提出には、成果物のmanifestに固定のadd-on IDが必要です。初回登録でIDが決まった後、`apps/browser-extension/wxt.config.ts`の`browser_specific_settings.gecko.id`へ同じ値を設定してから自動公開を有効にしてください。

## 公開手順

拡張機能のversionは[Changesets](https://changesets.dev/)で決めます。手で`package.json`のversionやtagを書くことはありません。

1. 利用者に見える変更を含むPull Requestには、`pnpm changeset`で`.changeset/*.md`を追加します。書き方は[.changeset/README.md](../.changeset/README.md)にあります。`develop`へのPull RequestのCIは、拡張機能のコードを変えたのにchangesetがない場合に失敗します。
2. リリースするときは、`develop`から作ったブランチで`pnpm changeset version`を実行します。溜まったchangesetから拡張機能のversionと`apps/browser-extension/CHANGELOG.md`が更新されるので、そのcommitを`develop`へのPull Requestにします。
3. `develop`から`main`へ昇格させます。
4. `main`へのpushで`Publish browser extension`が動きます。`v{version}`のtagがまだなければ、`deploy Worker`の成功と公開中のAPIを確かめてから両ストアへ提出し、成功後に`v{version}`のtagとGitHub Releaseを作ります。Releaseの本文はCHANGELOGの該当version、添付は提出したZIPです。tagがすでにあれば何もしません。

`Publish browser extension`を`main`から手動で実行すると、提出せずにWorkerとの互換性、credentialの登録漏れ、成果物を確かめるdry-runになります。

ChromeとFirefoxへの提出は一つのトランザクションではなく、一方だけ成功することがあります。提出かGitHub Releaseの作成が失敗すると、tagは作られません。tagがない間は、`main`へpushするたびに同じversionの提出を試み、ストアが同じversionを拒否して失敗します。

この状態になったら、Actions artifactと両ストアのdashboardを確認し、次のどちらかで解消します。

- まだ提出できていないストアがあれば、ストアのdashboardから同じZIPを手で提出します。
- 両ストアに提出済みと確認できたら、そのcommitへ`gh release create v{version} --target <commit> --notes-file <CHANGELOGの該当節>`でtagとReleaseを作ります。tagを手で作るのは、この復旧のときだけです。

Repository variable `API_ENDPOINT`の値を変えると、配布する拡張機能の接続先も変わります。変えるときは、WorkerのCustom Domain、Firefox審査用の`SOURCE_CODE_REVIEW.md`もあわせて確認します。

## デプロイが失敗した場合

`deploy Worker`が失敗したSHAでは、ストアの公開Workflowが止まります。原因を直したら、同じrunの`deploy Worker`を再実行するか、Pull Requestを通して`main`への新しいpushを起こします。再実行できるのは、そのSHAが今も`main`の先頭にある場合だけです。古いSHAでは、古いコードで本番を上書きしないよう`deploy Worker`が失敗します。

## 参考資料

- [WXT: Publishing](https://wxt.dev/guide/essentials/publishing.html)
- [Chrome Web Store API](https://developer.chrome.com/docs/webstore/using-api)
- [Cloudflare Workers: GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)
- [Cloudflare API token templates](https://developers.cloudflare.com/fundamentals/api/reference/template/)
