# デプロイとストア公開

このリポジトリでは、品質検査、Cloudflare Workersへのデプロイ、ブラウザ拡張機能のストア提出をGitHub Actionsで実行します。各Workflowは依存関係を導入する前に`.env`、`.env.*`、`.dev.vars`、`.dev.vars.*`の存在だけを検査し、見つけた場合は内容を読まずに停止します。外部サービスの認証情報はGitHub Environmentのsecretから、使用するstepにだけ渡します。

## Workflow

| ファイル                | 起動条件                                                       | 処理                                                   |
| ----------------------- | -------------------------------------------------------------- | ------------------------------------------------------ |
| `ci.yml`                | `develop`または`main`へのpushとPull Request                    | format、lint、型検査、テスト、ビルド                   |
| `deploy-worker.yml`     | `main`へのpush、または手動実行                                 | 同じ品質検査に通ったmainのWorkerをproductionへデプロイ |
| `publish-extension.yml` | `vMAJOR.MINOR.PATCH`の安定版GitHub Release公開、または手動実行 | Chrome版とFirefox版をビルドし、WXTで両ストアへ提出     |

全WorkflowはNode.js 24とpnpm 11を使います。外部Actionはcommit SHAで固定し、Dependabotが更新を提案します。

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

### production Environment

`production` Environmentを作り、デプロイ可能なbranchを`main`だけに制限します。完全自動デプロイを維持する場合、required reviewerとwait timerは設定しません。

次のEnvironment secretsを登録します。

| secret                  | 用途                           |
| ----------------------- | ------------------------------ |
| `CLOUDFLARE_ACCOUNT_ID` | デプロイ先のCloudflare account |
| `CLOUDFLARE_API_TOKEN`  | WranglerによるWorkerデプロイ   |

API tokenにはCloudflareの`Edit Cloudflare Workers`テンプレートを使い、対象accountと`dryk.net` zoneだけに範囲を絞ります。R2 bucket自体をCIで作成・削除しない限り、R2 Storage Writeは追加しません。

### browser-stores Environment

`browser-stores` Environmentを作り、選択可能なbranch/tagを`main`と`v*` tagに制限します。`main`は手動dry-run、`v*`はGitHub Releaseからの提出に使います。

次のEnvironment secretsを登録します。名前はWXTの`submit`コマンドが使用する環境変数と一致させています。

| secret                 | 用途                                      |
| ---------------------- | ----------------------------------------- |
| `CHROME_EXTENSION_ID`  | Chrome Web Storeの拡張機能ID              |
| `CHROME_CLIENT_ID`     | Chrome Web Store API用OAuth client ID     |
| `CHROME_CLIENT_SECRET` | Chrome Web Store API用OAuth client secret |
| `CHROME_REFRESH_TOKEN` | Chrome Web Store API用OAuth refresh token |
| `FIREFOX_EXTENSION_ID` | addons.mozilla.orgの拡張機能ID            |
| `FIREFOX_JWT_ISSUER`   | addons.mozilla.org APIのJWT issuer        |
| `FIREFOX_JWT_SECRET`   | addons.mozilla.org APIのJWT secret        |

ストア用secretはPull Requestや通常のCIには渡りません。GitHub Environmentにrequired reviewerを設定すると公開前の手動承認を追加できますが、その場合はRelease公開後の処理が承認待ちになります。

## Cloudflareの初期設定

自動デプロイを有効にする前に、Cloudflare上で次を確認します。

1. `open-exchange-rates-data` R2 bucketを作成します。
2. Worker `currency-lens`に`OPEN_EXCHANGE_RATE_APP_ID`をsecretとして設定します。
3. `dryk.net` zoneがActiveで、`cl.dryk.net`に競合するCNAMEがないことを確認します。
4. `pnpm --filter @cl/server deploy`を実行できる権限でAPI tokenを発行します。

`OPEN_EXCHANGE_RATE_APP_ID`の値はGitHub Actionsへ渡しません。Wrangler設定の`secrets.required`がWorker側にsecretがあることを検証し、通常のデプロイでは既存値を維持します。

Custom Domainの設定は`apps/server/wrangler.jsonc`を正本とします。Cloudflareはデプロイ時に`cl.dryk.net`のDNS recordと証明書を作成します。

## ストアの初期設定

WXTは既存listingの更新を自動化しますが、最初のlistingは作成しません。Chrome Web Storeとaddons.mozilla.orgで初回登録、説明、画像、プライバシー情報を手動で設定してください。

ChromeではChrome Web Store APIを有効にしたGoogle Cloud projectを用意し、listing所有者のGoogle accountでOAuth refresh tokenを発行します。Firefoxではaddons.mozilla.orgのAPI credentialsからJWT issuerとJWT secretを発行します。

Firefoxの更新提出には、成果物のmanifestに固定のadd-on IDが必要です。初回登録でIDが決まった後、`apps/browser-extension/wxt.config.ts`の`browser_specific_settings.gecko.id`へ同じ値を設定してから自動公開を有効にしてください。

Firefoxへ渡すsources ZIPは、リポジトリ直下の`package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、拡張機能本体、`packages/currency`を含める必要があります。`wxt.config.ts`の`zip.sourcesRoot`とsource対象ルールを設定し、不要なサーバーコードや生成物を除外してください。Workflowはsources ZIPを展開し、依存関係の導入とFirefox版の再ビルドを行い、提出用ZIPとファイル単位で一致しなければ公開を止めます。

## 公開手順

最初にGitHub Actionsの`Publish browser extension`を`main`から手動実行し、credentialの登録漏れと成果物を検証します。手動実行は常にdry-runとなり、ストアAPIへ接続せず、ZIPもアップロードしません。そのため、credentialの失効や値の誤りは初回の本番提出まで検出できません。

実際に公開するときは次の順で進めます。

1. `apps/browser-extension/package.json`のversionを更新し、`develop`から`main`へ反映します。
2. mainに含まれる対象commitへ`vMAJOR.MINOR.PATCH` tagを付け、同じtagで安定版GitHub Releaseを公開します。
3. Workflowがtagとpackage versionの一致、mainへの包含、ZIP数、環境ファイルがZIPへ混入していないことを検査します。
4. WXTがChrome Web Storeとaddons.mozilla.orgへ提出します。審査に通ると、各ストアの既存公開設定に従って公開されます。

本番提出の起動条件は安定版GitHub Releaseの公開だけです。同じversionの二重提出を避けるため、手動実行から本番提出への切り替えは許可していません。

ChromeとFirefoxへの提出は一つのトランザクションではありません。一方だけ成功した後にもう一方が失敗する場合があります。再実行する前にActions artifactと両ストアのdashboardを確認し、同じversionを再提出できる状態か判断してください。

## 参考資料

- [WXT: Publishing](https://wxt.dev/guide/essentials/publishing.html)
- [Chrome Web Store API](https://developer.chrome.com/docs/webstore/using-api)
- [Firefox Extension Workshop: web-ext](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/)
- [Cloudflare Workers: GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)
- [Cloudflare Workers: Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [GitHub Actions: Deployments and environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
