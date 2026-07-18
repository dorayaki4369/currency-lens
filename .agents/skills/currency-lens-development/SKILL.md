---
name: currency-lens-development
description: Currency Lens のブラウザ拡張機能、為替レート Worker、通貨検出・換算、設定画面、WXT、Cloudflare Workers、CI/CD、Chrome Web Store／Firefox Add-ons 公開を実装、修正、検証、リリースするときに使います。
---

# Currency Lens Development

Currency Lens 固有の境界、検証順、リリース条件を一貫して扱います。
一般的な TypeScript 実装原則は既存の software-* と typescript-* Skill を重ねて適用します。

## 最初に確認すること

1. ルートの `AGENTS.md` を読みます。
2. `.env`、`.env.*`、`.dev.vars`、`.dev.vars.*` は名前や場所を問わず絶対に読みません。
3. [references/architecture-and-contracts.md](references/architecture-and-contracts.md) から、変更対象の正本と契約を確認します。
4. 次の除外付きコマンドで作業中の差分を確認し、依頼範囲と重なる変更を整理します。禁止対象を表示し得る無条件の `git status` や `git diff` は実行しません。

```text
git status --short -- . ':(exclude,glob)**/.env' ':(exclude,glob)**/.env.*' ':(exclude,glob)**/.dev.vars' ':(exclude,glob)**/.dev.vars.*'
```

## 変更先を決める

- 金額文字列の解析、曖昧な通貨記号、換算、storage、runtime message は `apps/browser-extension/lib/` が所有します。
- 選択操作と換算カードは `apps/browser-extension/entrypoints/content/` が所有します。
- お気に入りや記号の既定値を管理する画面は `apps/browser-extension/entrypoints/popup/` が所有します。
- Open Exchange Rates との通信契約は `packages/oxr/` が所有します。
- 公開レート API、R2、定期更新は `apps/server/` が所有します。
- 通貨コード、記号、表示桁は `packages/currency/` が正本です。
- 実際に複数の配備単位で使う契約だけを共有 package へ置きます。

## 実装する

外部入力は Zod で境界検証します。
特に browser storage、runtime message、HTTP response、R2 JSON を型アサーションだけで通しません。

次の不変条件を保ちます。

- 選択テキストはローカル解析だけに使い、Worker へ送信しません。
- 一度に検出する金額は出現順で最大3件です。
- お気に入りは重複なしで最大5通貨です。
- レート取得に失敗しても最後の正常値を消しません。
- source timestamp、取得時刻、stale 状態を混同しません。
- Content Script の CSS は Shadow DOM 内へ閉じます。
- Chrome と Firefox の両方で使える WebExtensions API を優先します。

UI を変更するときは frontend-design と browser Skill も使います。
popup と換算カードを実ブラウザで開き、スクリーンショットを撮って少なくとも1回は見た目を批評してから完了します。

## 検証する

変更中は対象を絞り、完了前はルートで次を実行します。

```text
pnpm format
pnpm validate
```

検出変更では US／EU／空白区切り、4桁以上、複数文字記号、コード、部分一致、曖昧記号、上限をテストします。
storage／message 変更では正常値、不正値、旧設定移行、fresh／stale、通信失敗後の保持をテストします。
Worker 変更では R2 の正常／空／破損、OXR の非2xx／timeout／不正JSON、定期更新をテストします。
UI 変更では loading、empty、error、success、保存失敗、Escape、外側クリック、focus、reduced motion を確認します。

## リリースする

[references/release.md](references/release.md) を読み、開発ブランチ、Worker、ストア公開の順序と人間が用意する credentials を確認します。
初回ストア掲載や credentials 作成を自動化済みと誤認しません。
外部状態を実際に確認できない場合は、ローカル実装完了と外部設定待ちを分けて報告します。
