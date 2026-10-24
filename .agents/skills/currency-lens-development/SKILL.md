---
name: currency-lens-development
description: Currency Lens のブラウザ拡張機能、為替レート Worker、通貨検出・換算、設定画面、WXT、Cloudflare Workers、CI/CD、Chrome Web Store／Firefox Add-ons 公開を実装、修正、検証、リリースするときに使います。
---

# Currency Lens Development

Currency Lens の変更先の決め方、変更の種類ごとのテスト観点、検証とリリースの手順をまとめます。
AGENTS.md のルールを前提とし、ここでは繰り返しません。
TypeScript の一般的な実装原則は、software-* と typescript-* の Skill を併用します。

## 最初に確認すること

1. ルートの `AGENTS.md` を読みます。
2. [references/architecture-and-contracts.md](references/architecture-and-contracts.md) で、変更対象の正本と契約を確認します。
3. 作業中の差分を確認し、依頼の範囲と重なる変更を把握します。

## 変更先を決める

| 変更する内容                                                     | 変更先                                         |
| ---------------------------------------------------------------- | ---------------------------------------------- |
| 金額文字列の解析、曖昧な通貨記号、換算、storage、runtime message | `apps/browser-extension/lib/`                  |
| 選択操作、換算カード                                             | `apps/browser-extension/entrypoints/content/`  |
| 換算先通貨、外観、曖昧な通貨記号の解釈、対応通貨一覧             | `apps/browser-extension/entrypoints/popup/`    |
| Open Exchange Rates との通信                                     | `packages/oxr/`                                |
| 公開レート API、R2、定期的なレート取得                           | `apps/server/`                                 |
| 通貨コード、記号、換算の精度                                     | `packages/currency/`                           |
| 換算後の金額の表示桁                                             | `apps/browser-extension/lib/i18n.ts`           |

共有パッケージへ置くのは、実際に複数の配備単位（拡張機能と Worker）で使う契約だけです。

## 実装で守ること

AGENTS.md の実装ルールに加えて、次を守ります。

- レートの取得に失敗しても、最後に取得できたレートを消しません。
- レートの提供時刻（`sourceTimestamp`）、拡張機能が取得した時刻（`fetchedAt`）、古さの判定（`isStale`）を混同しません。
- ブラウザ API は、Chrome と Firefox の両方で使える WebExtensions API を優先します。

## 変更の種類ごとのテスト観点

| 変更                | テストする観点                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| 金額の検出          | US／EU／空白区切り、4桁以上、複数文字の記号、通貨コード、部分一致、曖昧な記号、件数の上限      |
| storage／message    | 正常値、不正値、旧設定の移行、fresh／stale、通信失敗後のレートの保持                           |
| Worker              | R2 の正常／空／破損、OXR の非2xx／timeout／不正な JSON、定期的な取得                           |
| UI                  | loading、empty、error、success、保存の失敗、Escape、外側のクリック、focus、reduced motion      |

UI を変更するときは、frontend-design と browser の Skill も使います。
各コンポーネントのライト・ダーク表示、Popup の各設定画面、換算カードを、少なくとも1回は実ブラウザで見て評価します。
崩れがあれば直し、もう一度確認してから完了とします。
静的な見た目は integration と E2E が保存するレビュー用画像で、操作や動きは `pnpm dev` で起動した拡張機能で確認します。

## 検証する

作業中は対象のテストに絞って実行します。
完了前に、ルートで次を実行します。

```text
pnpm check --fix
API_ENDPOINT=https://cl.dryk.net pnpm validate
API_ENDPOINT=https://cl.dryk.net pnpm test:e2e
```

`pnpm validate` は、check、unit のカバレッジ、integration、build をまとめて実行します。

## リリースする

[references/release.md](references/release.md) を読み、ブランチ、Worker、ストア公開の順序と、人間が行う作業を確認します。
初回のストア掲載や credentials の作成を、自動化済みと考えません。
外部の状態を実際に確かめられない場合は、ローカルの実装が完了したことと、外部の設定を待っていることを分けて報告します。
