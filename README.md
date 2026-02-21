# Currency Lens

Webページ上の通貨をその場で換算するブラウザ拡張機能

## プロダクトビジョン

### 背景・課題

海外のECサイトやサービスを利用する際、表示された価格を自分の通貨に換算するために別タブで検索したり、電卓アプリを開いたりする手間が発生します。
既存の通貨変換拡張機能の多くはページ全体の価格を自動的に書き換えるため、元の価格が見えなくなったり、誤検出による表示崩れが起きたりする問題があります。

### Currency Lensが目指すもの

**テキストを選択するだけで、即座に自分の通貨に換算できる体験**を提供します。

ページの表示を変えることなく、知りたい価格だけをピンポイントで確認できるシンプルなツールです。

### ターゲットユーザー

- 海外ECサイトで買い物をする人
- 海外旅行の計画・滞在中に現地価格を把握したい人
- 暗号通貨の価格を法定通貨で確認したい人
- 日常的に複数通貨を扱うビジネスパーソン

## コア機能

- **テキスト選択ベースの通貨検出・変換** — 価格を含むテキストを選択するだけで通貨を自動検出し換算
- **200+通貨対応** — 主要法定通貨に加え、BTC・ETHなどの暗号通貨にも対応
- **最新為替レートの自動取得** — [Open Exchange Rates](https://openexchangerates.org)から定期的にレートを更新
- **お気に入り通貨の設定** — よく使う通貨をすばやく切り替え
- **軽量動作** — 必要なときだけ動作し、ページパフォーマンスに影響しない

## 差別化ポイント

| 特徴           | Currency Lens                  | 従来の通貨変換拡張機能                 |
| -------------- | ------------------------------ | -------------------------------------- |
| 変換方式       | テキスト選択でピンポイント変換 | ページ全体の価格を自動書き換え         |
| ページへの影響 | なし（元の表示を維持）         | DOM書き換えによる表示崩れのリスク      |
| 暗号通貨対応   | BTC、ETHなど対応               | 法定通貨のみが多い                     |
| 動作タイミング | ユーザー操作時のみ             | ページ読み込み時に自動実行             |

## 将来の展望

- 為替レートの履歴・トレンド表示

## インストール

- [Chrome Web Store](https://chrome.google.com/webstore/detail/currency-lens/cfpmgblhfmfomcgkpkghcgkcfblbpgkm)
- [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/currency-lens)

## アーキテクチャ概要

本プロジェクトは **pnpm ワークスペース + Turborepo** によるモノリポ構成です。

```text
currency-lens/
├── apps/
│   ├── browser-extension/   # ブラウザ拡張機能（WXT + React）
│   └── server/              # 為替レート取得サーバー（Cloudflare Workers + Hono）
├── packages/
│   ├── currency/            # 通貨メタデータ（コード・シンボル・小数桁数）
│   ├── oxr/                 # Open Exchange Rates API クライアント（Zod バリデーション付き）
│   └── eslint-config/       # 共有 ESLint 設定
├── pnpm-workspace.yaml
└── turbo.json
```

### パッケージ間の依存関係

```mermaid
graph LR
    EXT[browser-extension] --> CUR[@cl/currency]
    SRV[server] --> OXR[@cl/oxr]
    OXR --> CUR
```

### apps/browser-extension

[WXT](https://wxt.dev) フレームワークで構築したブラウザ拡張機能です。Chrome・Firefox に対応しています。

| エントリーポイント | 役割 |
| --- | --- |
| Content Script | ページ上のテキスト選択を検知し、通貨を検出してポップアップUIを表示する |
| Background Script | 為替レートの管理と通貨換算の計算を行う |
| Popup | 基本通貨やお気に入り通貨などの設定画面 |

Content Script と Background Script は**メッセージパッシング**で通信し、設定やレートキャッシュは **Browser Storage** に保存します。

### apps/server

[Cloudflare Workers](https://workers.cloudflare.com) 上で動作する為替レート取得サーバーです。

- **Cron Trigger** で定期的に [Open Exchange Rates API](https://openexchangerates.org) から最新レートを取得
- 取得したレートデータは **R2 Bucket** に保存
- ブラウザ拡張機能はこの R2 Bucket から直接レートデータを取得

### packages/currency (`@cl/currency`)

通貨に関するメタデータ（通貨コード・シンボル・小数桁数など）を提供する共有パッケージです。ブラウザ拡張機能とサーバーの両方から利用されます。

### packages/oxr (`@cl/oxr`)

[Open Exchange Rates API](https://openexchangerates.org) の型安全なクライアントライブラリです。Zod によるレスポンスバリデーションを備えています。サーバーから利用されます。

### packages/eslint-config (`@cl/eslint-config`)

プロジェクト全体で共有する ESLint 設定です。

### 全体構成図

```mermaid
graph TB
    subgraph "ブラウザ拡張機能"
        CS[Content Script<br/>通貨検出・UI表示]
        BG[Background Script<br/>通貨換算・レート管理]
        PU[Popup<br/>設定画面]
        ST[(Browser Storage<br/>設定・レートキャッシュ)]

        CS -- メッセージパッシング --> BG
        PU -- メッセージパッシング --> BG
        BG -- 読み書き --> ST
    end

    subgraph "サーバー（Cloudflare Workers）"
        SC[Cron Trigger<br/>定期実行スケジューラー]
        R2[(R2 Bucket<br/>レートデータ保存)]

        SC -- 保存 --> R2
    end

    subgraph "外部サービス"
        OXR[Open Exchange Rates API]
    end

    subgraph "共有パッケージ"
        PKG_CUR[@cl/currency<br/>通貨メタデータ]
        PKG_OXR[@cl/oxr<br/>OXR APIクライアント]
    end

    SC -- レート取得 --> OXR
    CS -. 使用 .-> PKG_CUR
    BG -. 使用 .-> PKG_CUR
    SC -. 使用 .-> PKG_OXR
```
