# ストア掲載文

Chrome Web StoreとFirefox Add-ons（AMO）に載せる文言と掲載設定の正本です。ストアのdashboardで掲載文を直接書き換えた場合は、このディレクトリにも同じ変更を入れます。

| 掲載項目                      | 正本                                                            | ストアへの反映                                                             |
| ----------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 名前                          | `public/_locales/{en,ja}/messages.json`の`extensionName`        | manifestに含まれ、`main`へのリリース時の提出で両ストアへ届きます。         |
| 短い説明（要約）              | `public/_locales/{en,ja}/messages.json`の`extensionDescription` | Chromeは提出時にmanifestから反映します。AMOの要約はdashboardで設定します。 |
| 詳細説明                      | `description.en.txt`、`description.ja.txt`                      | 両ストアのdashboardへ手で貼り付けます。                                    |
| AMOの既定言語、カテゴリ、タグ | `amo.json`                                                      | AMOのdashboardで手で設定します。                                           |

`listing.spec.ts`が、名前と短い説明の文字数、詳細説明のプライバシーポリシーへのリンク、`amo.json`の値をストアの制限に照らして検査します。

## 文言を書くときの決まり

- 何ができるかを最初の1文で書き、「currency converter」「通貨換算」のような検索される語は、機能の説明として自然に入る範囲で使います。同じ語の繰り返しや、機能と関係のない語の羅列は、両ストアともキーワードスパムとして禁止しています。
- READMEの「できること」にない機能や、「最速」「最高」のような比較・誇張の表現は書きません。
- 詳細説明はプレーンテキストで書きます。Chromeは書式を解釈せず、AMOは一部のMarkdownを解釈するため、どちらでも読める見出し行と`-`の箇条書きだけを使います。

## 文字数とポリシー

| 項目     | Chrome Web Store                   | AMO                           |
| -------- | ---------------------------------- | ----------------------------- |
| 名前     | 75文字（manifestの`name`）         | 50文字                        |
| 短い説明 | 132文字（manifestの`description`） | 250文字                       |
| カテゴリ | dashboardで選択                    | 2つまで（1つで足りれば1つ）   |
| タグ     | なし                               | 10個まで、AMOが用意した語だけ |

出典は、Chromeが[Manifest - name](https://developer.chrome.com/docs/extensions/reference/manifest/name)、[Manifest - Description](https://developer.chrome.com/docs/extensions/reference/manifest/description)、[Creating a great listing page](https://developer.chrome.com/docs/webstore/best-listing)、AMOが[Creating an appealing add-on listing](https://extensionworkshop.com/documentation/develop/create-an-appealing-listing/)（カテゴリの数もこのガイドに従います）、[Tags API](https://mozilla.github.io/addons-server/topics/api/tags.html)、[Categories API](https://mozilla.github.io/addons-server/topics/api/categories.html)、[addons-serverの`MAX_TAGS`](https://github.com/mozilla/addons-server/blob/master/src/olympia/constants/base.py)です。AMOのタグは`https://addons.mozilla.org/api/v5/addons/tags/`が返す一覧から選びます。

## 反映手順

名前と短い説明はmanifestの一部なので、changesetを付けたPull Requestで変え、通常のリリースで提出します。それ以外は次の手順でdashboardから反映します。

1. Chrome Web Storeのdeveloper dashboardで、Store listingの英語と日本語の詳細説明へ`description.{en,ja}.txt`を貼り付けます。
2. AMOのEdit Product Pageで、既定の言語を`amo.json`の`default_locale`にします。そのうえで英語と日本語それぞれに、名前、要約（`extensionDescription`）、説明（`description.{en,ja}.txt`）を入力します。
3. 同じ画面で、カテゴリとタグを`amo.json`のとおりに設定します。

`Publish browser extension`が使うWXTの提出処理（publish-browser-extension）は、`--firefox-amo-metadata-file`を渡すと、新しいversionの提出前にAMOの掲載情報も同じJSONで更新できます。今は使っておらず、AMOの掲載情報は提出で変わりません。
