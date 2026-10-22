# Currency Lensブラウザ拡張機能

`apps/browser-extension`は、Webページで選択した金額を登録した通貨へ換算するChrome・Firefox向けの拡張機能です。WXT、React、Zustand、TanStack Router、Tailwind CSS、shadcn/uiで作っています。

セットアップと共通のコマンドは[ルートのREADME](../../README.md)、Workerを含むデータの流れは[アーキテクチャ](../../docs/architecture.md)にあります。

## 動作

### ページ上の換算

1. Content Scriptが、選択テキストから通貨記号か通貨コードと金額を検出します。検出は拡張機能の中だけで行います。
2. 選択範囲の近くにロゴのボタンを表示します。
3. ボタンを押すと、選択範囲で最初に見つかった金額を、登録した最大5件の通貨へ換算して換算カードに表示します。
4. 換算カードで換算元の金額や通貨を書き換えると、その内容で換算し直します。

Content ScriptからBackground Scriptへ送るのは、検出した金額、換算元の通貨コード、換算後の通貨コードだけで、選択テキストそのものは送りません。換算は保存済みのレートで行うため、換算のたびにネットワークへ通信することもありません。

UIはShadow DOMの中に描画します。ページのCSSが換算カードへ入り込むことも、Currency LensのCSSがページへ漏れることもありません。ブラウザの設定画面や拡張機能ストアなど、Content Scriptを実行できないページでは動作しません。

### Popup

Popupのトップでは、金額と換算元の通貨を入力して、登録した通貨へ換算できます。編集モードでは、換算後の通貨を追加、削除、並べ替えできます。並べ替えはドラッグハンドルか、キーボードの上下矢印キーで行います。同じ操作はページ上の換算カードでもでき、変更は`browser.storage.sync`へ自動で保存します。

ヘッダー右端の設定ボタンから設定一覧を開き、次の詳細画面へ移ります。

- 外観（テーマ）
- 通貨変換設定（曖昧な通貨記号の解釈）
- 対応通貨一覧（閲覧のみ）

画面の切り替えにはTanStack Routerのメモリ履歴を使うため、PopupのURLは変わりません。各画面はファイルベースのルートとして実装し、ビルドではルートごとに別のチャンクへ分割します。

保存済みの設定が古い形式の場合は新しい形式へ移行し、検証できない場合は既定値に戻します。

### 表示

- 換算後の金額は小数点以下2桁に丸めます。表示幅に収まらない場合は、仮数を小数点以下2桁に丸めた指数表記にします。
- 通貨の選択候補と対応通貨一覧はISOコードの昇順で並べます。登録した通貨は、ユーザーが並べ替えた順序を保ちます。
- UIとmanifestの名前・説明は日本語と英語に対応し、ブラウザの言語に合わせて切り替えます。通貨名は`Intl.DisplayNames`で同じ言語にします。地域名も同じ言語で検索できます。

### 為替レート

レートを取得するのはBackground Scriptだけです。Workerの`GET /v1/latest`から取得し、Zodで検証して`browser.storage.local`へ保存します。インストール時、ブラウザの起動時、Background Scriptの初期化時に、レートがないか古ければ取得し、その後は1時間ごとに取得し直します。

取得に失敗しても、最後に取得できたレートは消しません。レートの提供時刻から24時間を超えている場合は、Popupのトップと換算カードに古いレートであることを表示します。一度もレートを取得できていない間は換算できません。特定の通貨のレートだけがない場合は、その通貨への換算だけを利用不可にします。

換算できる通貨は、`packages/currency`に収録された通貨だけです。Workerが未知の通貨のレートを返しても、選択や換算の対象にはしません。

## コードの構成

| パス                        | 役割                                                                       |
| --------------------------- | -------------------------------------------------------------------------- |
| `components/conversion`     | 換算元の編集、換算後の一覧、並べ替え、レートの日時                         |
| `components/currency`       | 通貨の検索、対応通貨一覧、国旗・通貨アイコン、通貨の表示                   |
| `components/layout`         | 複数の画面で使うブランド表示とセクション見出し                             |
| `components/ui`             | shadcn/uiの基本部品と、それを組み合わせた汎用部品                          |
| `entrypoints/content`       | 選択範囲の監視、金額の検出、Shadow DOMへのUIの描画                         |
| `entrypoints/background.ts` | メッセージの検証、設定とレートの管理、換算、定期的なレート取得             |
| `entrypoints/popup`         | Popupのルート、手入力での換算、設定画面、レートの表示                      |
| `lib/currency-detection.ts` | 通貨コード、通貨記号、数値表記の検出                                       |
| `lib/messages.ts`           | Content Script、Popup、Background Scriptの間でやりとりするメッセージの形式 |
| `lib/rates.ts`              | Workerの応答の検証、鮮度の判定、換算                                       |
| `lib/storage.ts`            | 設定と、最後に取得できたレートの検証・保存                                 |
| `stores`                    | 画面の間で共有する設定ストアと、`browser.storage.sync`との同期             |

アプリケーションコードとテストは、`@/`（このディレクトリを指す）から内部モジュールをimportします。Nodeが直接起動する設定ファイルやスクリプトと、TanStack Routerが自動生成するファイルは、`@/`を解決できないため、相対パスなどその実行環境が解決できるパスを使います。

### UIの共通部品

- 通貨の表示は`CurrencyIdentity`、入力欄の装飾は`form-control.css`、カードの余白は`Card`が受け持ちます。各画面は配置と表示の種類だけを指定します。
- Popupの見出しと選択後のボタンは、`AppLogo`を通して`assets/icon.svg`のロゴを使います。換算カードにはロゴを置きません。
- 選択後のボタンは、テーマにかかわらず不透明な濃い色の背景にし、ページの背景が透けないようにします。

相対単位の基準と、`px`を使う箇所の考え方は[CSSの設計方針](../../docs/architecture.md#相対単位とpxの使い分け)にあります。

## ローカル開発

リポジトリ直下で依存関係を入れ、開発サーバーを起動します。

```bash
pnpm install --frozen-lockfile
pnpm -C apps/browser-extension dev          # Chrome
pnpm -C apps/browser-extension dev:firefox  # Firefox
```

ルートの`.env`に`API_ENDPOINT`がなければ、ローカルWorkerの`http://localhost:8787`へ接続します。別のレートAPIを使う場合だけ、ルートの`.env`に`API_ENDPOINT`を書きます。

Chrome向けの開発サーバーは`http://localhost:3000/sandbox.html`を自動で開きます。このURLがずれないよう、3000番ポートを固定で使い、ポートが使用中なら起動を失敗させます。

WXTが生成した開発版をブラウザへ読み込み、通常のHTTPかHTTPSのページで、テキストの選択、ボタン、換算結果、設定の保存を確認します。

### UIを変更したとき

リポジトリ直下で`pnpm test:unit`、`pnpm test:integration`、`pnpm test:e2e`を実行します。各テストの役割と、手で確認する項目は[画面品質の確認手順](../../docs/design-qa.md)にあります。

### Popupのルートを追加・削除・改名したとき

型付きのルートツリー`routeTree.gen.ts`を生成し直します。CIも同じ生成を行い、コミットされた`routeTree.gen.ts`が古くないことを検査します。

```bash
pnpm -C apps/browser-extension routes:generate
```

## ビルド

ビルドは`.env`を読まないため、`API_ENDPOINT`を直接渡します。

```bash
API_ENDPOINT=https://cl.dryk.net pnpm -C apps/browser-extension build          # Chrome
API_ENDPOINT=https://cl.dryk.net pnpm -C apps/browser-extension build:firefox  # Firefox
```

ストア提出用のZIPと、Firefox向けのソースコードZIPは次のコマンドで作ります。

```bash
API_ENDPOINT=https://cl.dryk.net pnpm -C apps/browser-extension zip
API_ENDPOINT=https://cl.dryk.net pnpm -C apps/browser-extension zip:firefox
```

ストアへの提出は、GitHub Releaseを起点にGitHub Actionsが行います。初回登録と認証情報の設定を含む手順は[デプロイとストア公開](../../docs/deployment.md)にあります。
