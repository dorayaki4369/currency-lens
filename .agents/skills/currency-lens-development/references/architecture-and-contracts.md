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
  -> Background の last-good cache（古いデータの要求時は更新完了を待って応答）

R2 のアーカイブ
  -> Cron Trigger が history/hourly.tsv と history/daily/YYYY-MM.tsv へ集約（上限つきの自己修復）
  -> GET /v1/history（USD 基準、最大6通貨）
  -> Background の GET_RATE_HISTORY（拡張機能側の Zod 検証、5分間のメモリキャッシュ）
  -> Popup の履歴ストア（解像度と通貨の組み合わせごと、Popup を閉じるまで保持）
  -> lib/ の純粋関数でクロスレート、期間、変化率、グラフの座標を計算
```

WXT は開発時と配布時のどちらも `API_ENDPOINT` を API のベース URL とし、HTTPS または loopback の HTTP だけを許可します。
Background Script は検証済みのベース URL に `/v1/latest` と `/v1/history` を付けてレートと履歴を取得します。
配布用ビルドは GitHub Actions の Repository variable から同じ環境変数名へ値を渡します。
`pnpm dev` は `API_ENDPOINT` が未設定ならローカル Worker の `http://localhost:8787` を使いますが、配布用ビルドでは必須のままです。

ローカル Worker は `apps/server/scripts/dev.ts` から起動し、`RATE_SOURCE` でレートの取得先を切り替えます。

| `RATE_SOURCE`          | 取得先                                                                                              | ローカル R2             |
| ---------------------- | --------------------------------------------------------------------------------------------------- | ----------------------- |
| 未設定、空、`mock`     | ループバックで起動するモックの Open Exchange Rates。`.env` の App ID は渡さず、ダミーの値を渡します | `.wrangler/mock-state`  |
| `live`                 | 本物の Open Exchange Rates。`.env` の `OPEN_EXCHANGE_RATE_APP_ID` を使います                         | `.wrangler/state`       |

それ以外の値では、Worker を起動せずにエラーで止まります。
モックは `apps/server/scripts/mock-rates.ts` の固定レートを、提供時刻を現在時刻にして返すため、拡張機能は fresh と判定します。
モックを使う間も Worker と拡張機能は本番と同じコードで動き、Cron の代わりの `__scheduled` もモックから取得します。
E2E はこの起動スクリプトを使わず、`apps/browser-extension/test/e2e/global-setup.ts` が独自のモックと Worker を起動します。
その前に、`apps/server/test/history-seed.ts` が作る決まった形の履歴を、Wrangler の `getPlatformProxy` でローカル R2 へ書き込みます。
履歴の集約ファイルの形式を変えるときは、この seed も同じ形式で作られることを `history-seed.spec.ts` で確かめます。

## 正本

- 通貨コード、記号、minor unit: `packages/currency/src/index.ts`
- OXR response: `packages/oxr/src/schema.ts`
- 拡張機能 config／rate cache: `apps/browser-extension/lib/storage.ts`
- runtime message: `apps/browser-extension/lib/messages.ts`
- 公開 API response: Worker と拡張機能が共有する Zod schema。重複する場合は変更時に両側を同時にテストします。
  `/v1/history` の拡張機能側の schema は `apps/browser-extension/lib/rate-history.ts` にあります。

## UIの状態管理

Popup と Content Script は別の実行コンテキストなので、Zustand ストアのメモリを共有しません。
共有する設定ストアと同期処理は `apps/browser-extension/stores/config.tsx` に置きます。
各 UI ルートは独立した設定ストアのインスタンスを生成し、設定の正本は `browser.storage.sync` のまま維持します。
設定ストアは実行時メッセージと `browser.storage.onChanged` で同期し、外部入力を既存の Zod スキーマで検証します。
`SET_CONFIG` は設定全体を置き換えるため、複数の UI ルートが同じ `storage.onChanged` を受信する前に並行保存した場合は、後に保存された設定全体を優先します。
現行契約は項目単位のマージやリビジョンによる競合検出を保証しません。

Popup の換算元とレート表示状態は内部ルートの切り替えを越えて保持するため、`entrypoints/popup/stores/conversion.tsx` の Popup 単位ストアに置きます。
換算元はレート画面の基準通貨を兼ねます。
レート履歴、グラフの期間、表示する通貨は、換算画面とレート画面で共有するため、`stores/rate-history.tsx` のストアに置きます。
Popup は開いている間に1つ、換算カードは開くたびに1つ作るため、換算カードの期間と通貨は開くたびに1か月とすべての通貨に戻ります。
レート画面、推移のグラフ、「換算｜レート」の切り替えは `components/rates` の共通部品で、Popup と換算カードが同じものを使います。
換算カードのレート画面の基準はカードの換算元で、保存された換算元の設定は変えません。
上昇と下降の既定の色は、表示の言語によらず上昇を緑、下降を赤にし、利用者が選んだ色は `getTrendPalette` が方向ごとに上書きします。
選んだ色は `browser.storage.sync` の `config` ではなく `chartColors` キーに保存し、`stores/chart-colors.tsx` のストアが `storage.onChanged` で同期します。
このストアは Popup と換算カードがそれぞれ持ち、共通部品は `useTrendPalette` で色を読みます。
`config` は strict schema で読むため、項目を足すと古い版が設定全体を既定値へ戻します。
`config` に新しい項目を加えるときは、古い版での読み込みを確かめるか、同じように別のキーへ分けます。
選んだ色は文字の色に使わず、軸のタグの文字は白か黒をコントラスト比で選びます。
Popup の各画面実装は対応する `entrypoints/popup/routes` のファイルが所有し、共有する Provider、状態、画面枠だけを `PopupApplication` に置きます。
WXT とブラウザ統合テストは同じ TanStack Router 設定を使い、画面ルートを自動コード分割します。Content Script は独立した entrypoint であり、このルート分割には含めません。
Content Script の換算操作は単一の `ContentApplication` が所有し、そのマウント期間を越えて保持しないため、`entrypoints/content/hooks/useConversionSession.ts` のローカル状態に置きます。
エントリーポイント固有の状態は一律にストアへ移さず、複数コンポーネントで共有するか、所有コンポーネントの生存期間を越えて保持する場合だけ `entrypoints/*/stores` に置きます。
入力途中や表示状態などの一時状態は永続化しません。

## 公開契約

レートは USD 基準の文字列辞書として保持します。
換算値は対象通貨の minor unit を基準に生成し、暗号通貨はメタデータの桁を上限として有効数字を保持します。Popupとページ上の換算カードでは、その換算値を通貨にかかわらず小数点以下2桁へ丸めます。通常表記が金額列の表示幅を超える場合は、仮数を小数点以下2桁に丸めた指数表記へ切り替えます。

`/v1/latest` と旧 `/latest` は、`base`、`rates`、`timestamp` だけを持つ同じ strict schema として維持します。
トップレベル項目の追加を含む破壊的変更は既存 route へ入れず、`/v2/latest` のような新しい route を追加します。
旧 route は対応する配布済み拡張機能が残る間は削除せず、廃止時期は利用状況を確認した人間が判断します。

`/v1/history` は `base`、`resolution`、`start`、`rates` だけを持ち、`/v1/latest` と同じく形の変更は新しい route へ分けます。
履歴の集約ファイルはアーカイブから作り直せる派生データです。集約の失敗で最新レートの保存を失敗させません。

レートの時刻は次の意味を分けます。

- `sourceTimestamp`: Open Exchange Rates が示すレート時刻です。
- `fetchedAt`: 拡張機能が Worker から正常応答を取得した時刻です。
- `isStale`: source timestamp から現在まで24時間以上経過している状態です。

通貨記号が曖昧な場合は、ユーザーの `symbolOverrides`、ページ locale、ブラウザ locale、通貨データの既定値の順で解決します。
