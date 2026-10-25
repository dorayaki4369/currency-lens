# Changesets

拡張機能（`@cl/browser-extension`）の利用者に見える変更を含む Pull Request では、このディレクトリへ changeset を1つ追加します。
リポジトリ直下で `pnpm changeset` を実行し、変更の種類と説明を入力すると作れます。

```markdown
---
"@cl/browser-extension": patch
---

換算カードで長い通貨名が切れないようにしました。
```

- 変更の種類は、不具合の修正なら `patch`、機能の追加なら `minor`、既存の使い方を壊す変更なら `major` にします。
- 説明は CHANGELOG と GitHub Release にそのまま載るため、利用者が読んで分かる日本語で書きます。
- 拡張機能の version を持つのは `@cl/browser-extension` だけです。`packages/currency` の変更が拡張機能の振る舞いを変える場合も、`@cl/browser-extension` の changeset を書きます。
- Worker、CI、文書、テストだけの変更には不要です。

リリースの手順は `docs/deployment.md` にあります。
