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
  -> GET /latest
  -> Background の stale-while-revalidate cache
```

## 正本

- 通貨コード、記号、minor unit: `packages/currency/src/index.ts`
- OXR response: `packages/oxr/src/schema.ts`
- 拡張機能 config／rate cache: `apps/browser-extension/lib/storage.ts`
- runtime message: `apps/browser-extension/lib/messages.ts`
- 公開 API response: Worker と拡張機能が共有する Zod schema。重複する場合は変更時に両側を同時にテストします。

## 公開契約

レートは USD 基準の文字列辞書として保持します。
浮動小数点の表示は対象通貨の minor unit を基準にし、暗号通貨はメタデータの桁を上限として有効数字を失いすぎないようにします。

レートの時刻は次の意味を分けます。

- `sourceTimestamp`: Open Exchange Rates が示すレート時刻です。
- `fetchedAt`: 拡張機能が Worker から正常応答を取得した時刻です。
- `isStale`: source timestamp が現在から24時間を超えている状態です。

通貨記号が曖昧な場合は、ユーザーの `symbolOverrides`、ページ locale、ブラウザ locale、通貨データの既定値の順で解決します。
