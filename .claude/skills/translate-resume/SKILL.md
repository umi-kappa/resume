---
name: translate-resume
description: |
  README.md（日本語職務経歴書）を英語に翻訳し、README.en.mdとして生成する。
  以下のような場面で使用:
  - 「英語版を作って」「英語に翻訳して」
  - 「README.en.mdを生成して」「英語の履歴書を更新して」
  - 「translate the resume」「generate English version」
  - README.mdの更新後に英語版を同期したいとき
---

# Translate Resume

README.md（日本語）を英語翻訳し、README.en.md として出力する。

## ワークフロー

1. README.md を読み込む
2. 翻訳ルールに従って英語に翻訳する
3. README.en.md として書き出す

## 翻訳ルール

### 構造・フォーマット
- Markdownの構造（見出しレベル、テーブル、リスト、リンク、画像）はそのまま維持する
- HTMLコメント（`<!-- ... -->`）は翻訳しない。すべて削除する
- 冒頭のリンクを `[日本語版](./README.md) *(日本語版からClaude Codeで自動翻訳)*` に差し替える
- 最終行の「最終更新日」は `*Last updated: Month D, YYYY*` の形式に変換する（例: 2026年3月2日 → March 2, 2026）

### 用語・表現
- 人名はローマ字表記を使う（例: 蔵下 雅之 → Masayuki Kurashita）
- 社名・サービス名は公式の英語名があればそれを使う。なければカタカナをローマ字に直す
  - 株式会社グロービー → Globee, Inc.
  - 株式会社アプトポッド → aptpod, Inc.
  - 株式会社アイシーエス → ICS Inc.
  - abceed はそのまま "abceed"
- 技術用語（TypeScript, Vue.js, React 等）はそのまま
- 習熟度の星表記はそのまま維持（⭐⭐⭐）
  - 「メインで使用」→ "Primary"
  - 「業務経験あり」→ "Professional experience"
- 「実務N年以上」→ "N+ years of professional experience"
- 役職の翻訳:
  - リードフロントエンドエンジニア → Lead Frontend Engineer
  - チームリーダー → Team Lead
  - フロントエンドエンジニア → Frontend Engineer
  - テクニカルライター → Technical Writer

### コンテンツの質
- 直訳ではなく、英語圏のレジュメとして自然に読める表現にする
- 「課題 → アプローチ → 成果」の構成は維持する
- 定量的成果（数値）はそのまま保持する
- NDA配慮の表現（「大手EC企業」等）は英語でも同様に匿名化を維持する（例: "a major e-commerce company"）
- 外部リンク（Qiita, note, connpass 等）のURLはそのまま維持する。記事タイトルは英訳する
- 書籍タイトルは原題のまま維持し、必要に応じて英語の補足説明を添える
