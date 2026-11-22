# Release

Workflow の挙動は `.github/workflows/`、GitHub の設定はリポジトリの Settings、リポジトリの外で行う作業は `docs/deployment.md` が正本です。
この文書は、リリースに関わる作業で Agent が守る条件だけをまとめます。

## ブランチ

1. `feature/*` から `develop` へ Pull Request を作ります。
2. 必須 CI を通し、未解決の conversation をなくしてから merge commit で取り込みます。
3. `develop` から `main` へ Pull Request を作ります。
4. 必須 CI を通し、merge commit で `main` へ取り込みます。

squash merge は使いません。
merge 済みのブランチの上に作ったブランチで同じ変更が別の commit として残り、conflict の原因になるためです。

## Worker

- Worker は `ci.yml` の `deploy Worker` がデプロイします。Cloudflare Workers Builds の Git 連携は使いません。
- Cloudflare の認証情報は `production` Environment の secret だけに置き、Repository secrets には置きません。
- `OPEN_EXCHANGE_RATE_APP_ID` は Cloudflare Worker secret だけに置きます。

デプロイが失敗したときは、`docs/deployment.md` の「デプロイが失敗した場合」に従います。

## ブラウザストア

version は Changesets が決め、`publish-extension.yml` が `main` への push で `v{version}` の tag がない version だけを提出し、成功後に tag と GitHub Release を作ります。
`package.json` の version、`CHANGELOG.md`、tag、GitHub Release を手で作ったり書き換えたりしません。version を上げるときは `pnpm changeset version` の結果を `develop` への Pull Request にします。
拡張機能のコードを変える Pull Request には changeset を付けます。`packages/currency` の変更が拡張機能の振る舞いを変える場合も、`@cl/browser-extension` の changeset を書きます。
提出前の検査は `publish-extension.yml` が行うので、検査を省く手順を作りません。
手動実行は dry-run だけにし、本番提出へ切り替える入力を足しません。同じ version を二重に提出しないためです。
ストア掲載用の宣伝画像は、`publish-extension.yml` の `render store promo images` job が UI の言語ごとのレビュー用画像から作り、言語別のフォルダで Actions artifact に保存します。リポジトリへ画像をコミットせず、ストアへの掲載は人間が行います。
ストアの掲載文と AMO の掲載設定の正本は `apps/browser-extension/store/listing/` です。
名前と短い説明は `public/_locales` の manifest 文言が正本です。
AMO の掲載情報は、`publish-extension.yml` が `store/amo-metadata.ts` で正本から作り、`--firefox-amo-metadata-file` で提出のたびに上書きします。
Chrome Web Store の詳細説明だけは、人間が dashboard へ反映します。
UI の文言や機能を変えたときは、掲載文と `store/promo-copy.ts` の宣伝画像の文言も同じ変更に合わせます。
UI の言語を追加するときは、`lib/locales/`、`public/_locales/`、`store/listing/`、`store/amo-metadata.ts` の対応表、`store/promo-copy.ts` をそろえて追加します。

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
- 旧 route を廃止するかどうかの判断（対応する配布済み拡張機能が使われなくなったことを確かめてから判断します）
