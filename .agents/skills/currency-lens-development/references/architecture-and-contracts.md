# Architecture and Contracts

## データフロー

```text
選択テキスト
  -> Content Script で金額と通貨をローカル検出
  -> Background へ検証済み message
  -> storage.local の最後の正常レートで換算
  -> Shadow DOM の換算カード

Open Exchange Rates
  -> Cloudflare Worker の scheduled／cache miss
  -> Zod 検証
  -> R2 latest.json
  -> GET /v1/latest
  -> Background の stale-while-revalidate cache
```

WXT は開発時と配布時のどちらも `API_ENDPOINT` を API のベース URL とし、HTTPS または loopback の HTTP だけを許可します。
Background Script は検証済みのベース URL に `/v1/latest` を付けてレートを取得します。
配布用ビルドは GitHub Actions の Repository variable から同じ環境変数名へ値を渡します。
Agent のローカル起動は `pnpm dev:agent` を使い、環境ファイルを読みません。

## 正本

- 通貨コード、記号、minor unit: `packages/currency/src/index.ts`
- OXR response: `packages/oxr/src/schema.ts`
- 拡張機能 config／rate cache: `apps/browser-extension/lib/storage.ts`
- runtime message: `apps/browser-extension/lib/messages.ts`
- 公開 API response: Worker と拡張機能が共有する Zod schema。重複する場合は変更時に両側を同時にテストします。

## 公開契約

レートは USD 基準の文字列辞書として保持します。
浮動小数点の表示は対象通貨の minor unit を基準にし、暗号通貨はメタデータの桁を上限として有効数字を失いすぎないようにします。

`/v1/latest` と旧 `/latest` は、`base`、`rates`、`timestamp` だけを持つ同じ strict schema として維持します。
トップレベル項目の追加を含む破壊的変更は既存 route へ入れず、`/v2/latest` のような新しい route を追加します。
旧 route は対応する配布済み拡張機能が残る間は削除せず、廃止時期は利用状況を確認した人間が判断します。

レートの時刻は次の意味を分けます。

- `sourceTimestamp`: Open Exchange Rates が示すレート時刻です。
- `fetchedAt`: 拡張機能が Worker から正常応答を取得した時刻です。
- `isStale`: source timestamp が現在から24時間を超えている状態です。

通貨記号が曖昧な場合は、ユーザーの `symbolOverrides`、ページ locale、ブラウザ locale、通貨データの既定値の順で解決します。
