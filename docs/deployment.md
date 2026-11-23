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

WXTは既存listingの更新を自動化しますが、最初のlistingは作成しません。Chrome Web Store、addons.mozilla.org、Microsoft Edge Add-onsで初回登録、説明、画像、プライバシー情報を手動で設定してください。掲載文と掲載設定の正本は[apps/browser-extension/store/listing/README.md](../apps/browser-extension/store/listing/README.md)にあります。AMOの名前、要約、詳細説明、サポート用のメールアドレスとURL、既定言語、カテゴリ、タグは、提出のたびにこの正本で上書きされるため、AMOのdashboardでは変更しません。プライバシーポリシーのURLには、Workerが配信する`https://cl.dryk.net/privacy`を指定します。このページは`main`へのmerge後の`deploy Worker`で公開されます。

ChromeではChrome Web Store APIを有効にしたGoogle Cloud projectを用意し、listing所有者のGoogle accountでOAuth refresh tokenを発行します。Firefoxではaddons.mozilla.orgのAPI credentialsからJWT issuerとJWT secretを発行します。

Firefoxの更新提出には、成果物のmanifestに固定のadd-on IDが必要です。初回登録でIDが決まった後、`apps/browser-extension/wxt.config.ts`の`browser_specific_settings.gecko.id`へ同じ値を設定してから自動公開を有効にしてください。

### Microsoft Edge Add-ons

Edge Add-onsのAPIは公開済みの拡張機能の更新だけを受け付け、新しい拡張機能の登録はPartner Centerで行います。そのため、次の手順を終えてsecretを登録するまで、`Publish browser extension`はEdgeへの提出を飛ばし、Chrome・Firefoxだけに提出します。

1. Microsoft accountで[Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/public/login?ref=dd)のMicrosoft Edge programに登録します。登録料はかかりません。個人として公開するなら、account typeはIndividualを選びます。
2. 公開中のversionのGitHub Releaseから`*-edge.zip`を取り出し、Partner Centerの「Create new extension」でアップロードします。Chrome用のZIPではなく、このZIPを使います。Edge用のビルドは、「このアプリについて」からChrome Web Storeのレビューページへ誘導しないためです。
3. 次の項目を入力して提出します。
   - Availability：Visibilityは`Public`、Marketsは既定のすべての市場のままにします。
   - Properties：Categoryに`Search tools`を選びます。Websiteには`https://github.com/dorayaki4369/currency-lens`を入れます。
   - Privacy：Privacy Policy URLに`https://cl.dryk.net/privacy`を入れ、収集するデータは選ばずにdisclosureを認証します。
   - Store listings：言語ごとに`apps/browser-extension/store/listing/description.<言語>.txt`を詳細説明へ貼り付け、ロゴ（300×300推奨）と、Actions artifactの宣伝画像やタイルを登録します。
4. 審査は最大7営業日かかります。待っている間に、Partner Centerの拡張機能の「Extension overview」にある「Extension identity」からProduct IDを控えます。
5. Partner Centerの「Publish API」で「enable the new experience」の「Enable」を押してから、「Create API credentials」でClient IDとAPI keyを発行します。API keyには有効期限があり、Publish APIのページに表示されます。
6. Repository secretsに`EDGE_PRODUCT_ID`、`EDGE_CLIENT_ID`、`EDGE_API_KEY`を登録し、`main`で`Publish browser extension`を手動実行して、dry-runの`publish Edge package`が成功することを確かめます。dry-runは3つが登録されていることだけを確かめ、値が正しいかは本番の提出まで分かりません。

API keyの期限が切れると、`publish Edge package`が401で失敗します。期限が近づいたらPublish APIのページで新しいAPI keyを発行し、`EDGE_API_KEY`を更新します。

## 公開手順

拡張機能のversionは[Changesets](https://changesets.dev/)で決めます。手で`package.json`のversionやtagを書くことはありません。

1. 利用者に見える変更を含むPull Requestには、`pnpm changeset`で`.changeset/*.md`を追加します。書き方は[.changeset/README.md](../.changeset/README.md)にあります。`develop`へのPull RequestのCIは、拡張機能のコードを変えたのにchangesetがない場合に失敗します。
2. リリースするときは、`develop`から作ったブランチで`pnpm changeset version`を実行します。溜まったchangesetから拡張機能のversionと`apps/browser-extension/CHANGELOG.md`が更新されるので、そのcommitを`develop`へのPull Requestにします。
3. `develop`から`main`へ昇格させます。
4. `main`へのpushで`Publish browser extension`が動きます。`v{version}`のtagがまだなければ、`deploy Worker`の成功と公開中のAPIを確かめてからChromeとFirefoxへ提出し、成功後に`v{version}`のtagとGitHub Releaseを作ります。Releaseの本文はCHANGELOGの該当version、添付は提出したZIPとEdge用のZIPです。tagがすでにあれば何もしません。
5. Edgeのsecretが登録されていれば、ChromeとFirefoxへの提出が成功した後に、`publish Edge package`がEdge用のZIPをアップロードして審査へ出します。審査を通ると自動で公開されます。

`Publish browser extension`を`main`から手動で実行すると、提出せずにWorkerとの互換性、credentialの登録漏れ、成果物を確かめるdry-runになります。

### ストア掲載用の宣伝画像

提出とdry-runのどちらでも、`render store promo images` jobが1280×800の宣伝画像をUIの言語ごとに4枚作り、Actions artifactの`store-promo-images-{run id}`へ言語別のフォルダで保存します。画像はE2Eが言語ごとに保存するレビュー用画像からpopup、換算カード、レートのグラフを切り抜いて作るので、そのversionの画面がそのまま載ります。グラフは、E2Eの起動時にローカルのWorkerへ書き込むテスト用の履歴で描きます。宣伝画像で換算する通貨を変えるときは、`test/e2e/global-setup.ts`の`HISTORY_RATES`にもその通貨を足します。Chrome Web Storeはスクリーンショットを言語ごとに登録できますが、Firefox Add-onsは1組しか登録できません。ストアへの掲載は自動化していないため、必要なときにartifactから取り出して各ストアのdashboardで差し替えます。このjobが失敗しても提出とGitHub Releaseは止まりません。ただしrunは失敗と表示されるため、提出とReleaseの結果は`publish Chrome and Firefox packages`と`record the release on GitHub`のjobで確かめます。

画像の構成は`apps/browser-extension/store/promo-images.ts`、言語ごとの文言は`apps/browser-extension/store/promo-copy.ts`にあります。変えるときは、`pnpm test:e2e`でレビュー用画像を作ってから`pnpm store:dev`でプレビューし、`pnpm store:images`で書き出した画像を確認します。ローカルとCIではフォントが異なり、macOSではヒラギノやPingFangなどのシステムフォント、CIではNoto Sans CJKで描画されます。

`pnpm store:images`は、言語に依存しないプロモーションタイル（小タイル440×280とマーキー1400×560）も`promo-tiles/`へ書き出します。Chrome Web Storeのプロモーション画像は言語ごとに登録できないため、タイルには文字を入れず、数字と記号だけで伝えます。

ストア掲載用の説明動画（日本語、28.5秒）は`apps/browser-extension/store/video/currency-lens-intro-ja.mp4`にあります。撮影元は同じフォルダの`index.html`と`scene.js`で、`index.html`をブラウザで開くと再生バーで時刻を動かして確かめられます。撮り直すときは`pnpm store:video`を実行します。字幕の対応通貨数は`scene.js`に書いてあるため、対応通貨を増減したときは数を直して撮り直します。Chrome系ブラウザ、libx264付きのffmpeg、Tailwind CSSを読み込むための`cdn.jsdelivr.net`への接続が要ります。動画はChrome Web StoreへYouTubeのURLとして登録します。

ストアの掲載文の正本と反映手順は[ストア掲載文](../apps/browser-extension/store/listing/README.md)にあります。

ChromeとFirefoxへの提出は一つのトランザクションではなく、一方だけ成功することがあります。提出かGitHub Releaseの作成が失敗すると、tagは作られません。tagがない間は、`main`へpushするたびに同じversionの提出を試み、ストアが同じversionを拒否して失敗します。

この状態になったら、Actions artifactとChrome・Firefoxのdashboardを確認し、次のどちらかで解消します。

- まだ提出できていないストアがあれば、ストアのdashboardから同じZIPを手で提出します。
- ChromeとFirefoxに提出済みと確認できたら、そのcommitへ`gh release create v{version} --target <commit> --notes-file <CHANGELOGの該当節>`でtagとReleaseを作ります。tagを手で作るのは、この復旧のときだけです。

Edgeへの提出は、ChromeとFirefoxへの提出、tagの作成とは別のjobで行います。`publish Edge package`だけが失敗した場合は、tagとReleaseは作られているため、次のpushで同じversionが再提出されることはありません。API keyの期限切れなどの原因を直してから、同じrunの「Re-run failed jobs」で`publish Edge package`を再実行します。前のversionがまだ審査中だと、Edgeは新しい提出を受け付けないため、審査が終わってから再実行します。再実行できない古いrunなら、GitHub Releaseの`*-edge.zip`をPartner Centerから手で提出します。

Repository variable `API_ENDPOINT`の値を変えると、配布する拡張機能の接続先も変わります。変えるときは、WorkerのCustom Domain、Firefox審査用の`SOURCE_CODE_REVIEW.md`もあわせて確認します。

## デプロイが失敗した場合

`deploy Worker`が失敗したSHAでは、ストアの公開Workflowが止まります。原因を直したら、同じrunの`deploy Worker`を再実行するか、Pull Requestを通して`main`への新しいpushを起こします。再実行できるのは、そのSHAが今も`main`の先頭にある場合だけです。古いSHAでは、古いコードで本番を上書きしないよう`deploy Worker`が失敗します。

## 参考資料

- [WXT: Publishing](https://wxt.dev/guide/essentials/publishing.html)
- [Chrome Web Store API](https://developer.chrome.com/docs/webstore/using-api)
- [Publish a Microsoft Edge extension](https://learn.microsoft.com/microsoft-edge/extensions/publish/publish-extension)
- [Use the REST API to update an extension (Edge Add-ons API)](https://learn.microsoft.com/microsoft-edge/extensions/update/api/using-addons-api)
- [Cloudflare Workers: GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)
- [Cloudflare API token templates](https://developers.cloudflare.com/fundamentals/api/reference/template/)
