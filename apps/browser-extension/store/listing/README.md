# ストア掲載文

Chrome Web StoreとFirefox Add-ons（AMO）に載せる文言と掲載設定の正本です。AMOの掲載はリリースのたびにここから上書きされるため、AMOのdashboardで掲載文を直接書き換えません。

| 掲載項目                      | 正本                                                           | Chrome Web Storeへの反映                 | AMOへの反映                  |
| ----------------------------- | -------------------------------------------------------------- | ---------------------------------------- | ---------------------------- |
| 名前                          | `public/_locales/<言語>/messages.json`の`extensionName`        | リリース時の提出でmanifestから反映します | リリース時の提出で反映します |
| 短い説明（要約）              | `public/_locales/<言語>/messages.json`の`extensionDescription` | リリース時の提出でmanifestから反映します | リリース時の提出で反映します |
| 詳細説明                      | `description.<言語>.txt`                                       | dashboardへ手で貼り付けます              | リリース時の提出で反映します |
| AMOの既定言語、カテゴリ、タグ | `amo.json`                                                     | 対象外                                   | リリース時の提出で反映します |

AMOへは、`Publish browser extension`が`../amo-metadata.ts`でこれらの正本からAMOの掲載情報のJSONを作り、`wxt submit --firefox-amo-metadata-file`で新しいversionと一緒に送ります。言語は`_locales`のディレクトリ名（`en`、`ja`、`zh_CN`、`zh_TW`、`ko`、`es`、`fr`、`de`、`pt_BR`）で揃え、`../amo-metadata.ts`の`AMO_LOCALES`がAMOの言語コードへ対応させます。英語は`en-US`に入ります。AMOには地域を持たないスペイン語がないため、スペイン語の文言は`es-ES`、`es-MX`、`es-AR`、`es-CL`のすべてに入ります。

`listing.spec.ts`が、名前と短い説明の文字数、要約にURLがないこと、詳細説明のプライバシーポリシーへのリンク、`amo.json`のカテゴリとタグがAMOの受け付ける値であることを検査します。

## 文言を書くときの決まり

- 何ができるかを最初の1文で書き、「currency converter」「通貨換算」のような検索される語は、機能の説明として自然に入る範囲で使います。同じ語の繰り返しや、機能と関係のない語の羅列は、両ストアともキーワードスパムとして禁止しています。
- READMEの「できること」にない機能や、「リアルタイム」「最速」のような実際と違う表現・誇張は書きません。
- 詳細説明はプレーンテキストで書きます。Chromeは書式を解釈せず、AMOは一部のMarkdownを解釈するため、見出し行、番号付きの手順、`-`の箇条書きだけを使い、見出しや段落の間は空行で区切ります。

## 文字数とポリシー

| 項目     | Chrome Web Store                   | AMO                           |
| -------- | ---------------------------------- | ----------------------------- |
| 名前     | 75文字（manifestの`name`）         | 50文字                        |
| 短い説明 | 132文字（manifestの`description`） | 250文字、URLは不可            |
| カテゴリ | dashboardで選択                    | 2つまで（1つで足りれば1つ）   |
| タグ     | なし                               | 10個まで、AMOが用意した語だけ |

出典は、Chromeが[Manifest - name](https://developer.chrome.com/docs/extensions/reference/manifest/name)、[Manifest - Description](https://developer.chrome.com/docs/extensions/reference/manifest/description)、[Creating a great listing page](https://developer.chrome.com/docs/webstore/best-listing)、AMOが[Creating an appealing add-on listing](https://extensionworkshop.com/documentation/develop/create-an-appealing-listing/)（カテゴリの数もこのガイドに従います）、[Add-ons API の Edit](https://mozilla.github.io/addons-server/topics/api/addons.html#edit)、[Tags API](https://mozilla.github.io/addons-server/topics/api/tags.html)、[Categories API](https://mozilla.github.io/addons-server/topics/api/categories.html)、[addons-serverの`MAX_TAGS`](https://github.com/mozilla/addons-server/blob/master/src/olympia/constants/base.py)です。AMOのタグは`https://addons.mozilla.org/api/v5/addons/tags/`が返す一覧から選び、一覧が変わったら`listing.spec.ts`の写しも更新します。

## 反映手順

掲載文を変えるときは、Pull Requestで正本を変えます。両ストアへ届くのは次のリリースの提出時で、詳細説明や`amo.json`だけの変更はchangesetの対象外なので、それだけではリリースは作られません。Chrome Web Storeの詳細説明は提出処理が送らないため、リリース後にdeveloper dashboardのStore listingで、言語ごとの詳細説明へ`description.<言語>.txt`を貼り付けます。

AMOへの掲載情報の送信は、Firefoxの新しいversionのアップロードと検証が済んだ後、versionを作る直前に行われます。送信が失敗すると、Chromeへの提出が済んだままFirefoxの提出が止まるため、`docs/deployment.md`の提出失敗時の手順で復旧します。
