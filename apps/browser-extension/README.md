# Currency Lensブラウザ拡張機能

`apps/browser-extension`は、通常のWebページで選択した金額をお気に入り通貨へ換算するChrome・Firefox向け拡張機能です。WXT、React、Shadow DOM向けのプレーンCSSで構築しています。

共通のセットアップと品質検査は[ルートREADME](../../README.md)、Workerを含むデータフローは[アーキテクチャ](../../docs/architecture.md)を参照してください。

## 利用時の動作

Content Scriptは選択テキストから通貨記号または通貨コードと金額をローカルで検出します。1回の選択で扱うのは先頭から最大3件です。アイコンを押すと、検出した金額を最大5件のお気に入り通貨へ換算します。結果は最大15件です。

対象は通常のWebページです。UIはShadow DOM内へ描画するため、WebページのCSSが換算結果へ入り込むことも、Currency Lensのスタイルがページへ漏れることもありません。ブラウザの設定画面や拡張機能ストアなど、Content Scriptを実行できないページは対象外です。

選択テキストは外へ出しません。Background Scriptへ送るのは、Content Scriptで解析した後の金額、通貨コード、換算先通貨だけです。Background Scriptはキャッシュ済みのレートで計算するため、換算のたびに閲覧内容をネットワークへ送る処理もありません。

## 設定と為替レート

お気に入り通貨は最大5件で、`browser.storage.sync`に保存します。記号の解釈、テーマ、通貨アイコンとコードの表示設定も同じ設定データに含まれます。保存済み設定が古い形式なら移行し、検証できない場合は既定値へ戻します。

為替レートはBackground ScriptだけがCurrency Lens Workerの`GET /latest`から取得し、Zodで検証して`browser.storage.local`へ保存します。インストール時、ブラウザ起動時、Background Scriptの初期化時に不足または古いレートを更新し、その後は1時間ごとのalarmで再取得します。

更新に失敗しても、最後に検証できたキャッシュは削除しません。提供元時刻から24時間を超えたレートで換算した場合は、結果と設定画面に古いレートであることを表示します。まだ有効なキャッシュが一度もない場合は換算できません。特定の通貨ペアだけレートがない場合は、その組み合わせだけを利用不可として返します。

## 構成

| 領域                        | 責務                                                           |
| --------------------------- | -------------------------------------------------------------- |
| `entrypoints/content`       | 選択範囲の監視、ローカルでの金額検出、Shadow DOM内のUI表示     |
| `entrypoints/background.ts` | メッセージ検証、設定とレートの管理、換算、定期更新             |
| `entrypoints/popup`         | お気に入り通貨などの設定、レート時刻と警告の表示               |
| `lib/currency-detection.ts` | 通貨コード・記号・数値表記の検出                               |
| `lib/messages.ts`           | Content Script、Popup、Background Script間の実行時検証付き契約 |
| `lib/rates.ts`              | Workerレスポンスの検証、鮮度判定、換算と表示桁数               |
| `lib/storage.ts`            | 設定と最後に成功したレートキャッシュの検証・保存               |

検出と表示に対応する通貨コードの正本は`packages/currency`です。Workerが未知のレートコードを配信しても、拡張機能はこの正本に含まれる通貨だけを選択・換算対象にします。

## ローカル開発

リポジトリ直下で依存関係を導入し、人間がルートの`.env`へ開発用レートAPIを設定してから、対象ブラウザの開発サーバーを起動します。

```dotenv
API_ENDPOINT=http://localhost:8787
```

```bash
pnpm install --frozen-lockfile
pnpm ext dev
```

Firefoxで確認する場合は次のコマンドを使います。

```bash
pnpm ext dev:firefox
```

WXTが生成する開発版をブラウザへ読み込んで、通常のHTTPまたはHTTPSページでテキスト選択、アイコン、換算結果、設定保存を確認してください。開発版と配布用ビルドは同じ`API_ENDPOINT`をベースURLとして使い、`/latest`へ接続します。配布時の値はGitHub ActionsのRepository variableから渡します。

AI Agentが起動する場合は、環境ファイルを読まない`pnpm ext dev:agent`または`pnpm ext dev:firefox:agent`を使います。

## ビルド

Chrome版とFirefox版は別々に生成します。

```bash
pnpm ext build
pnpm ext build:firefox
```

ストア提出用ZIPとFirefox向けsources ZIPは次のコマンドで作成します。

```bash
pnpm ext zip
pnpm ext zip:firefox
```

通常の品質検査はリポジトリ直下で`pnpm validate`を実行します。ストアの初回登録と認証情報の設定は外部作業です。公開経路は[デプロイとストア公開](../../docs/deployment.md)にあります。

ビルドと品質検査は環境ファイルを読みません。ローカルでは、例えば`API_ENDPOINT=https://cl.dryk.net pnpm validate`のようにprocess environmentへ値を渡します。
