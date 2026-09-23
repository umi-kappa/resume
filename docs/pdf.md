# 職務経歴書のPDF生成

[Issue #1](https://github.com/umi-kappa/resume/issues/1)に基づき、`README.md`から応募用の日本語PDFを生成する。職務経歴書の本文はREADMEだけで管理し、生成時に要約・書き換え・追記はしない。`README.en.md`は使用しない。

## 初回セットアップと生成

Node.js 22.18.0、npm 10を使用する。Nodeのバージョンは`.nvmrc`に記録している。nvm利用者は先に`nvm install`、`nvm use`を実行する。

リポジトリルートで実行する。

```sh
npm ci
npm run pdf
```

初回の`npm ci`ではnpmパッケージとPuppeteer対応のChromeをダウンロードするため、ネットワーク接続が必要。以後は`npm run pdf`だけで再生成できる。生成時は外部通信を遮断し、npmパッケージ内の日本語フォントを埋め込む。

- `output/pdf/resume.pdf`：提出用PDF
- `output/pdf/resume.html`：レイアウト調査用HTML（フォント込み）

出力は毎回上書きする。成果物と`node_modules/`はGit管理対象外。PDFを編集して原稿として保存しない。GitHub Actionsでの自動生成は今回の実装に含めない。

## 依存関係と再現性

| 依存 | 用途 |
|---|---|
| markdown-it | Markdownの構造解析とHTML生成 |
| cheerio | 基本情報の抽出、画像の除去、意味構造に基づくCSSクラス付与 |
| Puppeteer / 対応Chrome | HTML/CSSの印刷、リンク付きPDF生成 |
| @fontsource/noto-sans-jp | Noto Sans JPの400・700ウェイト（SIL Open Font License） |

直接依存は`package.json`で完全固定し、間接依存は`package-lock.json`で固定する。フォントのライセンスは`node_modules/@fontsource/noto-sans-jp/LICENSE`に含まれる。システムに日本語フォントを追加する必要はない。

同じ原稿・config・CSS・lockfile・Node・OS/アーキテクチャで同じ内容とページ構成を再生成する。システムChromeへの切り替えや`PUPPETEER_EXECUTABLE_PATH`等の上書きは避ける。OSやChromeの変更時は全ページを再確認する。PDFの作成日時などのメタデータは生成ごとに変わり得るため、ファイルのバイト列一致は保証対象にしない。

## 掲載ルール

`pdf/config.json`の以下の値を変更して掲載範囲を管理する。

- `sections`：READMEのレベル2見出しと完全一致する名前を掲載順に指定
- `basicInfoSection`：基本情報の表を持つレベル2見出し
- `fields`：基本情報の表の第1列と完全一致するフィールドを掲載順に指定

初期設定はヘッダー（名前・GitHub・Zenn・Qiita）、自己PR・志向性、技術スタック、職歴・プロジェクト経験、技術研鑽・個人開発の順。タイトルもREADMEのレベル1見出しを使用する。

英語版リンク、今後やりたいこと、技術発信セクション、LinkedIn、X、書籍画像は掲載しない。選択したセクション内の本文に「技術発信」という語が登場する場合は、その本文を維持する。画像とMarkdownの水平線は生成時に除去する。最終更新日は掲載対象セクション外のため出力しない。

掲載対象の見出しやフィールドが見つからない場合、見出し・基本情報のフィールドが重複している場合はエラーで停止する。見出しを改名した場合はconfigも合わせて更新する。掲載セクション内に追加した本文は自動で反映されるが、新しいレベル2見出しはconfigへ追加しない限り掲載されない。

本文のリンクは絶対HTTP(S) URLを使用する。画像以外の未対応HTMLや相対リンクが掲載範囲に追加された場合は、エラーを確認して対応方針を決める。原稿にPDF制御用のマーカーを追加しない。

## デザイン・改ページの保守

`pdf/print.css`で印刷レイアウトを管理する。[デジタル庁のダッシュボードデザインの実践ガイドブック](https://www.digital.go.jp/resources/dashboard-guidebook)の「構造を伝える」「レイアウトグリッド」の考え方を、職務経歴書の1段組に適用した。左端を揃え、白地と濃い本文色、青1色のアクセント、見出しの大きさ・太さで階層を示す。色を除いても見出しとリンクを識別できる。

行高と要素間の余白には、デジタル庁デザインシステムも参照する。

- [タイポグラフィ](https://design.digital.go.jp/dads/foundations/typography/)では、本文の行高は最低1.5倍を推奨し、1.7・1.75を本文向けの値として定義している。このPDFは1.75を採用する。
- [余白](https://design.digital.go.jp/dads/foundations/spacing/)では、基準単位の倍率で余白スケールを設計し、関連する情報を近づけ、異なるまとまりを離す考え方を示している。8 CSS pxを一般的な基準例としており、このPDFでは等価な6ptを基準に4段階を定義する。

| CSS変数 | 値 | このPDFでの用途 |
|---|---|---|
| `--space-related` | 6pt | 独立ラベルやメタ情報の下、箇条書き項目間、表セルの上下 |
| `--space-content` | 12pt | 段落間、大見出し・会社名・プロジェクト名と本文の間、表セルの左右 |
| `--space-project` | 18pt | プロジェクト見出しの上、タイトルの下、リストの字下げ |
| `--space-section` | 24pt | セクション・会社に相当する見出しの上 |

4段階の用途への割り当ては、この職務経歴書向けの設計判断であり、公式が指定したPDF用の値ではない。CSSの隣接マージンは相殺される場合があるため、指定値を単純加算した間隔になるとは限らない。本文10ptとページ外周のmm指定は印刷向けの独自設定として区別する。Web本文の16 CSS px以上という基準をそのまま適用したものではなく、デザインシステム全体への準拠を意味しない。

- A4縦、余白は上17mm・左右18mm・下18mm、本文10pt・行間1.75
- ページ番号はChromeのフッターで生成し、本文との重なりを避ける
- 見出し・見出し直後のメタ情報・独立した太字ラベルは後続内容とつなぐ
- 技術スタックなどの末尾の情報は前の内容とつなぐ
- 箇条書きの末端項目と表の行は途中での分割を避ける。ただし1ページに収まらない長さならChromeが分割する。入れ子の親項目は分割を許可し、子リストの先頭とつなぐ
- 本文は`orphans` / `widows`でページ端の少数行だけの分離を抑える
- セクション全体や会社全体は分割禁止にしない。長い職歴も自然に複数ページへ流れる

ページ数、文字数、会社名、`nth-child`等を条件にした改ページや、手動の`break-before: page`を追加しない。ページ数を維持するために本文を削らない。内容追加後に不自然な分離があれば、意味構造と共通CSSの改善で対応する。

## 変更後の確認

```sh
npm test
npm run pdf
git diff --check
git diff
git status --short
```

`npm test`は実際のREADMEを使い、掲載順・除外・基本情報・リンク・設定不整合・長文や表や入れ子の箇条書きの保持を検証する。レイアウトの目視確認は別途必要。

生成したPDFの**全ページ**を開き、文字化け・欠落・重なり・はみ出し・見出しの孤立・表の分割・ページ番号・過大な空白を確認する。リンクの注釈とリンク先も確認する。モノクロ表示でも階層とリンクが判別できることを確認する。

Popplerが利用できる場合は、リポジトリ外の一時ディレクトリへ画像化できる（PDF生成自体には不要）。

```sh
mkdir -p /tmp/resume-pdf-review
pdfinfo output/pdf/resume.pdf
pdftoppm -scale-to 1500 -png output/pdf/resume.pdf /tmp/resume-pdf-review/page
```

改ページ処理を変更した場合は、`scripts/pdf.mjs`の`generatePdf(source, outputDirectory)`へ一時的に長文や入れ子の箇条書きを追加した文字列を渡し、1ページを超える要素でも欠落せず分割できることを確認する。検証用原稿でREADMEを上書きしない。

## トラブルシューティング

- Chromeが見つからない：`PUPPETEER_SKIP_DOWNLOAD`等の設定を確認し、`npx puppeteer browsers install chrome`で対応版を取得する。
- Chromeを起動できない：エラーと実行環境を確認する。Codexのサンドボックス内では起動が拒否される場合があり、その場合は生成コマンドの実行権限が必要。`--no-sandbox`の恒久追加では回避しない。
- Linuxで共有ライブラリが不足する：Puppeteerの[公式トラブルシューティング](https://pptr.dev/troubleshooting)を確認し、OS側の必要ライブラリを追加する。
- `Missing section` / `Missing basic information`：READMEとconfigの表記を照合する。
- フォントや依存関係を更新した：lockfileを更新し、テスト・再生成・全ページ目視確認をやり直す。

初回実装の動作確認環境はmacOS / Node.js 22.18.0。他OSおよび実機での紙への印刷は別途確認が必要。
