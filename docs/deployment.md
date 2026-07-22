# デプロイとストア公開

このリポジトリでは、品質検査とブラウザ拡張機能のストア提出をGitHub Actions、Cloudflare WorkersへのデプロイをCloudflare Workers Buildsで実行します。GitHub Actionsの各Workflowは依存関係を導入する前に`.env`、`.env.*`、`.dev.vars`、`.dev.vars.*`の存在だけを検査し、見つけた場合は内容を読まずに停止します。ブラウザストアの認証情報はGitHubのRepository secretsから、存在確認とWXTによる提出のstepにだけ渡します。

## 自動化

| 実行基盤                  | 設定                    | 起動条件                                                       | 処理                                                                                |
| ------------------------- | ----------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| GitHub Actions            | `ci.yml`                | `develop`または`main`へのpushとPull Request                    | format、lint、型検査、テスト、ビルド                                                |
| GitHub Actions            | `publish-extension.yml` | `vMAJOR.MINOR.PATCH`の安定版GitHub Release公開、または手動実行 | Worker成功と公開API契約を確認後、Chrome版とFirefox版をビルドしてWXTで両ストアへ提出 |
| Cloudflare Workers Builds | CloudflareのWorker設定  | `main`へのpush                                                 | productionへWorkerをデプロイ                                                        |

GitHub Actionsの全WorkflowはNode.js 24とpnpm 11を使います。外部Actionはcommit SHAで固定し、Dependabotが更新を提案します。WorkerをデプロイするGitHub Actions Workflowは置かず、同じ`main`更新から二重にデプロイしないようにします。ストア公開Workflowには`checks: read`だけを追加し、release commitと同じSHAにCloudflareの成功したCheck Runがあることを検証します。

## GitHubの設定

### ブランチルール

`main`と`develop`にRulesetを設定し、次の制約を有効にします。個人開発でもPull Requestを必須にしつつ、レビュー担当者がいないため承認数は0とします。共同開発へ移行した時点で1以上へ変更してください。

| 設定                                | `develop` | `main` | 理由                                             |
| ----------------------------------- | --------- | ------ | ------------------------------------------------ |
| Pull Request必須                    | 有効      | 有効   | 直接pushを禁止する                               |
| 必須承認数                          | 0         | 0      | 個人開発でもPR経由を強制し、自己承認待ちを避ける |
| 必須check `CI / quality`            | 有効      | 有効   | format、lint、型、テスト、buildを必須にする      |
| head branchを最新にする             | 有効      | 有効   | base更新後の未検証mergeを防ぐ                    |
| 未解決conversationを残したmerge禁止 | 有効      | 有効   | 指摘を解消してからmergeする                      |
| force push／branch削除              | 禁止      | 禁止   | 履歴と配布元branchを保護する                     |

`ci.yml`は`main`向けPull Requestのheadが同じリポジトリの`develop`でなければ失敗するため、`develop`から`main`への昇格経路も同じcheckで強制されます。feature branchは`develop`へsquash mergeし、`develop`から`main`へはmerge commitを使います。

Rulesetを先に有効にすると、まだ存在しないcheckを待ち続けます。Workflowを一度成功させてから必須checkへ追加してください。

Dependabotの更新先も`develop`に固定しています。WorkflowとDependabot設定をmainへ反映した後、Dependabotを有効にする前に`develop`を作成してください。

### Actionsの設定変数

Repository variableとして次を登録します。公開URLなのでsecretではなくvariableとして管理し、Chrome／Firefoxの配布ビルドへ同じ値を渡します。Pull RequestのCIは公開設定から独立させ、既知の本番URLをWorkflow内で使います。

| variable       | 値                    | 用途                     |
| -------------- | --------------------- | ------------------------ |
| `API_ENDPOINT` | `https://cl.dryk.net` | レートAPIの本番ベースURL |

配布成果物はこの値へ`/v1/latest`を付けて接続します。値を変えると同じソースから生成される拡張機能の接続先も変わるため、変更時はWorkerのCustom Domain、Firefox用の`SOURCE_CODE_REVIEW.md`、リリース成果物を同時に確認します。

### Workerデプロイ用Environmentは不要

WorkerのデプロイはGitHub Actionsを経由しないため、GitHubの`production` Environment、`CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_API_TOKEN`は参照しません。Cloudflare Workers BuildsはGit連携時にデプロイ用のAPI tokenをCloudflare側で管理します。旧Workflow用に作成済みの場合は、Cloudflareの初回production buildが成功した後に削除できます。

### ストア公開用Repository secrets

現時点では環境ごとにストアの認証情報、承認者、公開条件を分けないため、GitHub Environmentは作成しません。Workflowの手動実行は`main`だけを受け付け、安定版の自動提出は現在の`main`を指す`v*` GitHub Releaseだけを受け付けます。

次のRepository secretsを登録します。名前はWXTの`submit`コマンドが使用する環境変数と一致させています。

| secret                 | 用途                                      |
| ---------------------- | ----------------------------------------- |
| `CHROME_EXTENSION_ID`  | Chrome Web Storeの拡張機能ID              |
| `CHROME_CLIENT_ID`     | Chrome Web Store API用OAuth client ID     |
| `CHROME_CLIENT_SECRET` | Chrome Web Store API用OAuth client secret |
| `CHROME_REFRESH_TOKEN` | Chrome Web Store API用OAuth refresh token |
| `FIREFOX_EXTENSION_ID` | addons.mozilla.orgの拡張機能ID            |
| `FIREFOX_JWT_ISSUER`   | addons.mozilla.org APIのJWT issuer        |
| `FIREFOX_JWT_SECRET`   | addons.mozilla.org APIのJWT secret        |

ストア用secretはPull Requestや通常のCIには渡さず、公開Workflowの存在確認とWXT提出stepだけへ明示的に渡します。Repository secretsへアクセスするWorkflow自体を保護するため、`main`と`develop`のPull Request必須ルール、必須check、未解決conversationの禁止を維持します。将来stagingとproductionで認証情報や承認者を分ける場合は、その時点でGitHub Environmentの導入を再検討します。

## Cloudflareの初期設定

自動デプロイを有効にする前に、Cloudflare上で次を確認します。

1. `open-exchange-rates-data` R2 bucketを作成します。
2. Worker `currency-lens`に`OPEN_EXCHANGE_RATE_APP_ID`をsecretとして設定します。
3. `dryk.net` zoneがActiveで、`cl.dryk.net`に競合するCNAMEがないことを確認します。
4. Worker `currency-lens`のSettings、BuildsからGitHub repositoryを接続します。

Workers Buildsは次の値で設定します。

| 設定                               | 値                                    |
| ---------------------------------- | ------------------------------------- |
| Repository                         | `dorayaki4369/currency-lens`          |
| Production branch                  | `main`                                |
| Builds for non-production branches | 無効                                  |
| Root directory                     | リポジトリ直下                        |
| Build command                      | 空欄                                  |
| Deploy command                     | `pnpm --filter @cl/server run deploy` |
| Node.js version file               | `.node-version`                       |
| Build variable `PNPM_VERSION`      | `11.13.0`                             |

Cloudflareの既定Node.jsとpnpmはリポジトリの`engines`より古いため、Node.jsはリポジトリ直下の`.node-version`から検出させ、pnpmだけBuild variableで固定します。deploy commandがWorkerのコンパイルも行うため、Build commandではモノリポ全体をビルドしません。品質検査は`main`へmergeする前の必須check `CI / quality`が担います。これにより、Workerデプロイへ不要なブラウザ拡張機能の`API_ENDPOINT`をCloudflareへ重複登録せずに済みます。

接続後はCloudflareがproduction build用のAPI tokenとGitHub checkを管理し、`main`へのpushを検知してデプロイします。Build watch pathsは設定しません。ストア公開Workflowがrelease SHAと同じ`Workers Builds: currency-lens`を必須にするため、Workerコードを変更しないcommitでもCloudflare Check Runが必要です。

`OPEN_EXCHANGE_RATE_APP_ID`の値はGitHub ActionsやWorkers Buildsのbuild variableへ渡しません。Wrangler設定の`secrets.required`がWorker側にsecretがあることを検証し、通常のデプロイでは既存値を維持します。

Custom Domainの設定は`apps/server/wrangler.jsonc`を正本とします。Cloudflareはデプロイ時に`cl.dryk.net`のDNS recordと証明書を作成します。

## ストアの初期設定

WXTは既存listingの更新を自動化しますが、最初のlistingは作成しません。Chrome Web Storeとaddons.mozilla.orgで初回登録、説明、画像、プライバシー情報を手動で設定してください。

ChromeではChrome Web Store APIを有効にしたGoogle Cloud projectを用意し、listing所有者のGoogle accountでOAuth refresh tokenを発行します。Firefoxではaddons.mozilla.orgのAPI credentialsからJWT issuerとJWT secretを発行します。

Firefoxの更新提出には、成果物のmanifestに固定のadd-on IDが必要です。初回登録でIDが決まった後、`apps/browser-extension/wxt.config.ts`の`browser_specific_settings.gecko.id`へ同じ値を設定してから自動公開を有効にしてください。

Firefoxへ渡すsources ZIPは、リポジトリ直下の`package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、拡張機能本体、`packages/currency`を含める必要があります。`wxt.config.ts`の`zip.sourcesRoot`とsource対象ルールを設定し、不要なサーバーコードや生成物を除外してください。Workflowはsources ZIPを展開し、依存関係の導入とFirefox版の再ビルドを行い、提出用ZIPとファイル単位で一致しなければ公開を止めます。

## 公開手順

最初にGitHub Actionsの`Publish browser extension`を`main`から手動実行し、Workerとの互換性、credentialの登録漏れ、成果物を検証します。手動実行も同じcommitのCloudflareデプロイ成功を待ち、公開中の`/v1/latest`と旧`/latest`を配布版クライアントのZod schemaと拡張機能originのCORS条件で検査します。手動実行は常にdry-runとなり、WXTがストアAPIの認証を確認しますが、ZIPのアップロードや審査提出は行いません。

実際に公開するときは次の順で進めます。

1. `apps/browser-extension/package.json`のversionを更新し、`develop`から`main`へ反映します。
2. Cloudflareの`Workers Builds: currency-lens`が成功した現在のmain HEADへ`vMAJOR.MINOR.PATCH` tagを付け、同じtagで安定版GitHub Releaseを公開します。
3. credentialを持たないpreflight jobが、tagとpackage versionと現在のmain HEADの一致、同じSHAのCloudflare成功、公開中の現行・旧API契約を検査します。Cloudflareのcheckが未作成なら最大15分待ち、失敗、timeout、HTTP、JSON、Zod、CORSのいずれかが不正なら公開を止めます。
4. preflightが検証した同じSHAをpublish jobがcheckoutし、ZIP数と環境ファイルの非混入を検査します。
5. WXTがChrome Web Storeとaddons.mozilla.orgへ提出します。審査に通ると、各ストアの既存公開設定に従って公開されます。

本番提出の起動条件は安定版GitHub Releaseの公開だけです。同じversionの二重提出を避けるため、手動実行から本番提出への切り替えは許可していません。

`/v1/latest`と旧`/latest`は、`base`、`rates`、`timestamp`だけを持つ同じstrict schemaとして後方互換に保ちます。トップレベル項目の追加を含む破壊的変更は、既存routeを書き換えず`/v2/latest`のような新しいrouteへ追加します。旧routeの廃止時期は自動化せず、対応する配布済み拡張機能が利用されなくなったことを確認したうえで判断します。

ChromeとFirefoxへの提出は一つのトランザクションではありません。一方だけ成功した後にもう一方が失敗する場合があります。再実行する前にActions artifactと両ストアのdashboardを確認し、同じversionを再提出できる状態か判断してください。

## 参考資料

- [WXT: Publishing](https://wxt.dev/guide/essentials/publishing.html)
- [Chrome Web Store API](https://developer.chrome.com/docs/webstore/using-api)
- [Firefox Extension Workshop: web-ext](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/)
- [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)
- [Cloudflare Workers Builds: Configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
- [Cloudflare Workers Builds: Build image](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/)
- [Cloudflare Workers Builds: GitHub integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/)
- [Cloudflare Workers Builds: Build watch paths](https://developers.cloudflare.com/workers/ci-cd/builds/build-watch-paths/)
- [Cloudflare Workers: Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [GitHub Actions: Using secrets in GitHub Actions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions)
