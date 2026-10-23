# デプロイとストア公開

この文書は、品質検査、Workerのデプロイ、ブラウザ拡張機能のストア提出を動かすための外部設定と、公開の手順をまとめたものです。

品質検査、Cloudflare Workerのデプロイ、ストア提出は、すべてGitHub Actionsが実行します。

GitHub Actionsの各Workflowは、依存関係を入れる前に環境ファイルがないことを確かめます。`.env`、`.env.*`、`.dev.vars`、`.dev.vars.*`のどれかが見つかった場合は、中身を読まずに停止します。値を含まない`.env.example`と`.dev.vars.example`は対象外です。

## 自動化

Node.jsのバージョンは`.node-version`、pnpmのバージョンは`package.json`の`packageManager`が正本です。ローカル（mise）とGitHub Actionsは、どちらもここから読みます。

| Workflow                | job             | 起動条件                                                       | 処理                                                                                |
| ----------------------- | --------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `ci.yml`                | `quality`       | `develop`または`main`へのpushとPull Request                    | format、lint、型検査、テスト、ビルド                                                |
| `ci.yml`                | `deploy Worker` | `main`へのpushで`quality`が成功した後                          | productionへWorkerをデプロイ                                                        |
| `publish-extension.yml` | `preflight`ほか | `vMAJOR.MINOR.PATCH`の安定版GitHub Release公開、または手動実行 | Worker成功と公開API契約を確認後、Chrome版とFirefox版をビルドしてWXTで両ストアへ提出 |

- 外部のActionはcommit SHAで固定し、Dependabotが更新を提案します。
- `deploy Worker`は、同じSHAで`quality`が成功したときだけ実行します。`main`へのpushで動くCIは、実行中のrunを新しいpushで取り消しません。デプロイは`worker-production`のconcurrency groupで1件ずつ実行し、待機中の古いrunは新しいpushのrunに置き換わります。
- ストア公開Workflowには、権限として`checks: read`だけを追加します。release commitと同じSHAで、`deploy Worker`のCheck Runが成功していることを確かめるためです。

## GitHubの設定

### ブランチルール

`main`と`develop`にRulesetを設定し、次の制約を有効にします。個人開発でもPull Requestは必須にしますが、レビューする人がいないため、必須の承認数は0にしています。共同開発に移ったら1以上にしてください。

| 設定                                | `develop` | `main` | 理由                                               |
| ----------------------------------- | --------- | ------ | -------------------------------------------------- |
| Pull Request必須                    | 有効      | 有効   | 直接pushを禁止する                                 |
| 必須承認数                          | 0         | 0      | 個人開発でもPR経由を強制し、自己承認待ちを避ける   |
| 必須check `CI / quality`            | 有効      | 有効   | format、lint、型、テスト、buildを必須にする        |
| head branchを最新にする             | 有効      | 無効   | `develop`は最新化し、`main`はPRのmerge結果をCIする |
| 未解決conversationを残したmerge禁止 | 有効      | 有効   | 指摘を解消してからmergeする                        |
| 許可するmerge方法                   | merge     | merge  | 積み上げたbranchでも同じcommitを共有できる         |
| force push／branch削除              | 禁止      | 禁止   | 履歴と配布元branchを保護する                       |

feature branchから`develop`へも、`develop`から`main`へも、merge commitで取り込みます。squashすると、merge済みのbranchの上に作ったbranchで同じ変更が別のcommitとして残り、conflictの原因になるためです。`main`向けのPull Requestは、headが同じリポジトリの`develop`でなければ`ci.yml`が失敗します。このため、`main`へ入る経路は`develop`からの昇格だけになります。

`main`では「Require branches to be up to date before merging」を無効にします。昇格のmerge commitは`main`にだけ作られるため、一度昇格すると`develop`は履歴の上で`main`より古くなります。ここで最新化を必須にすると、次の昇格ができなくなるためです。最新化を求めなくても、`main`向けPull RequestのCIは、GitHubが作るmerge後の内容をcheckoutして検証します。

Rulesetを先に有効にすると、まだ存在しないcheckを待ち続けます。Workflowを一度成功させてから必須checkへ追加してください。

Dependabotの更新先も`develop`に固定しています。WorkflowとDependabot設定をmainへ反映した後、Dependabotを有効にする前に`develop`を作成してください。

### Actionsの設定変数

Repository variableとして次を登録します。公開されているURLなので、secretではなくvariableにしています。ChromeとFirefoxの配布用ビルドは、どちらもこの値を使います。Pull RequestのCIはこのvariableを使わず、Workflowに書いた本番のURLを使います。

| variable       | 値                    | 用途                     |
| -------------- | --------------------- | ------------------------ |
| `API_ENDPOINT` | `https://cl.dryk.net` | レートAPIの本番ベースURL |

配布する拡張機能は、この値に`/v1/latest`を付けて接続します。値を変えると拡張機能の接続先も変わるため、変えるときはWorkerのCustom Domain、Firefox審査用の`SOURCE_CODE_REVIEW.md`、リリースの成果物もあわせて確認します。

### Workerデプロイ用のproduction Environment

`production` Environmentを作り、Deployment branches and tagsで`main`だけを許可します。完全自動でデプロイするため、required reviewerとwait timerは設定しません。`main`以外のbranchで動くWorkflowは、このEnvironmentのsecretを読めません。

次のEnvironment secretsを登録します。

| secret                  | 用途                           |
| ----------------------- | ------------------------------ |
| `CLOUDFLARE_ACCOUNT_ID` | デプロイ先のCloudflare account |
| `CLOUDFLARE_API_TOKEN`  | WranglerによるWorkerのデプロイ |

API tokenはCloudflareの`Edit Cloudflare Workers`テンプレートから作り、対象のaccountと`dryk.net` zoneだけに範囲を絞ります。R2 bucketをCIで作成・削除しないので、R2 Storage Writeは追加しません。

### ストア公開用Repository secrets

今は環境ごとにストアの認証情報、承認者、公開条件を分けていないため、ストア用のGitHub Environmentは作りません。Workflowの手動実行は`main`からだけ受け付けます。自動提出は、現在の`main`を指す`v*`の安定版GitHub Releaseからだけ受け付けます。

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

ストア用のsecretは、Pull Requestや通常のCIには渡しません。渡すのは、公開Workflowの中でsecretの登録を確かめるstepと、WXTで提出するstepだけです。

secretを使うWorkflow自体を書き換えられないよう、`main`と`develop`ではPull Requestの必須化、必須check、未解決conversationがあるときのmerge禁止を続けます。stagingとproductionで認証情報や承認者を分けることになったら、そのときにストア用のGitHub Environmentの導入を考え直します。

## Cloudflareの初期設定

自動デプロイを有効にする前に、Cloudflare上で次を確認します。

1. `open-exchange-rates-data` R2 bucketを作成します。
2. Worker `currency-lens`に`OPEN_EXCHANGE_RATE_APP_ID`をsecretとして設定します。
3. `dryk.net` zoneがActiveで、`cl.dryk.net`に競合するCNAMEがないことを確認します。
4. Worker `currency-lens`のSettings、BuildsでGitHub repositoryと接続していないことを確認します。接続が残っていると、`main`へのpushのたびにWorkerが二重にデプロイされます。

`OPEN_EXCHANGE_RATE_APP_ID`の値はGitHub Actionsへ渡しません。Wrangler設定の`secrets.required`がWorker側にsecretがあることを検証し、通常のデプロイでは既存値を維持します。

Custom Domainの設定は`apps/server/wrangler.jsonc`を正本とします。Cloudflareはデプロイ時に`cl.dryk.net`のDNS recordと証明書を作成します。

### デプロイが失敗した場合

`deploy Worker`が失敗したSHAでは、ストアの公開Workflowが止まります。原因を直したら、GitHub Actionsで同じrunの`deploy Worker`を再実行するか、通常どおり`feature/*`から`develop`、`develop`から`main`へPull Requestを通して`main`への新しいpushを起こします。

## ストアの初期設定

WXTは既存listingの更新を自動化しますが、最初のlistingは作成しません。Chrome Web Storeとaddons.mozilla.orgで初回登録、説明、画像、プライバシー情報を手動で設定してください。

ChromeではChrome Web Store APIを有効にしたGoogle Cloud projectを用意し、listing所有者のGoogle accountでOAuth refresh tokenを発行します。Firefoxではaddons.mozilla.orgのAPI credentialsからJWT issuerとJWT secretを発行します。

Firefoxの更新提出には、成果物のmanifestに固定のadd-on IDが必要です。初回登録でIDが決まった後、`apps/browser-extension/wxt.config.ts`の`browser_specific_settings.gecko.id`へ同じ値を設定してから自動公開を有効にしてください。

Firefoxへ渡すsources ZIPは、リポジトリ直下の`package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、拡張機能本体、`packages/currency`を含める必要があります。`wxt.config.ts`の`zip.sourcesRoot`とsource対象ルールを設定し、不要なサーバーコードや生成物を除外してください。Workflowはsources ZIPを展開し、依存関係の導入とFirefox版の再ビルドを行い、提出用ZIPとファイル単位で一致しなければ公開を止めます。

## 公開手順

最初に、GitHub Actionsの`Publish browser extension`を`main`から手動で実行し、Workerとの互換性、credentialの登録漏れ、成果物を確かめます。手動実行は常にdry-runです。

- 本番と同じく、同じcommitで`deploy Worker`が成功するのを待ちます。
- 公開中の`/v1/latest`と旧`/latest`を、配布版のZod schemaと、拡張機能originからのCORSの条件で検査します。
- WXTがストアAPIの認証を確かめますが、ZIPのアップロードや審査への提出はしません。

実際に公開するときは次の順で進めます。

1. `apps/browser-extension/package.json`のversionを更新し、`develop`から`main`へ反映します。
2. `deploy Worker`が成功した現在のmain HEADへ`vMAJOR.MINOR.PATCH` tagを付け、同じtagで安定版GitHub Releaseを公開します。
3. credentialを持たないpreflight jobが、tagとpackage versionと現在のmain HEADの一致、同じSHAの`deploy Worker`の成功、公開中の現行・旧API契約を検査します。`deploy Worker`のcheckが未作成なら最大15分待ち、失敗、timeout、HTTP、JSON、Zod、CORSのいずれかが不正なら公開を止めます。
4. preflightが検証した同じSHAをpublish jobがcheckoutし、ZIP数と環境ファイルの非混入を検査します。
5. WXTがChrome Web Storeとaddons.mozilla.orgへ提出します。審査に通ると、各ストアの既存公開設定に従って公開されます。

本番提出の起動条件は安定版GitHub Releaseの公開だけです。同じversionの二重提出を避けるため、手動実行から本番提出への切り替えは許可していません。

`/v1/latest`と旧`/latest`は、`base`、`rates`、`timestamp`だけを持つ同じstrict schemaとして後方互換に保ちます。トップレベル項目の追加を含む破壊的変更は、既存routeを書き換えず`/v2/latest`のような新しいrouteへ追加します。旧routeの廃止時期は自動化せず、対応する配布済み拡張機能が利用されなくなったことを確認したうえで判断します。

ChromeとFirefoxへの提出は一つのトランザクションではありません。一方だけ成功した後にもう一方が失敗する場合があります。再実行する前にActions artifactと両ストアのdashboardを確認し、同じversionを再提出できる状態か判断してください。

## 参考資料

- [WXT: Publishing](https://wxt.dev/guide/essentials/publishing.html)
- [Chrome Web Store API](https://developer.chrome.com/docs/webstore/using-api)
- [Firefox Extension Workshop: web-ext](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/)
- [Cloudflare Workers: GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)
- [Cloudflare Workers: Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [GitHub Actions: Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
- [GitHub Actions: Managing environments for deployment](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
- [GitHub Actions: Using secrets in GitHub Actions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions)
