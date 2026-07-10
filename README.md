# My Pivot

> 迷った数だけ、私は進んだ。— 迷いは、いつか一冊の本になる。

意思決定を「本に綴じる」ジャーナルアプリ。

---

## なぜ作ったか

人は、結果を知った瞬間に記憶を書き換えてしまう。
「最初から、こうなると分かっていた気がする」——うまくいけば確信は膨らみ、失敗すれば「本当は迷っていた」ことにされる。だから、記憶を頼りにしている限り、自分の判断力は永遠に測れない。

timesは流れて、編集できて、誰も後から結果を聞かない。
My Pivotは綴じて、書き換えられなくして、時が来たら結果をたずねに来る。

決めた日のあなたが「この選択がうまくいくと、どのくらい思えたか」。
それを改ざんできない形で残し、時を経て結果と突き合わせる。
迷いの一つひとつが、綴じられて、いつか自分だけの一冊の本になる。



## コンセプト:一つの決定が辿る時間軸

| 時点 | できること |
|------|-----------|
| **T1 決めるとき** | 五里霧中モードで迷いを執筆(本文・感情タグ・確信度★1〜5)。書いている最中、意味的に似た過去の記録を「召喚」して参照できる |
| **綴じた後** | 保存後2分の修正猶予を過ぎると記録は**追記専用**に。決定時の自分は書き換えられない |
| **T2 結果が来たとき** | 結果予定日にアプリ内通知。結果(うまくいった / 後悔が残る / まだ分からない)と「当時の判断は?」を綴じる。AIが結果からの後付け評価(アウトカムバイアス)を検知したら、**問いを1つだけ**返す |
| **T3 俯瞰するとき** | ★別成功率のキャリブレーション曲線・感情年表。n<3のデータ点は中空円で描画し、統計的信頼性を偽装しない |

### 三つの本棚

- **わたしの本棚** — 完全非公開。誰にも見せない前提だから正直に書ける
- **共同の本棚** — 合言葉で参加するチーム共有の決断録
- **先達の本棚** — 結果まで綴じられた記録を読み取り専用で

公開は執筆フォームからはできない(自己呈示バイアスの排除)。年表からの**事後行為**としてのみ可能で、原本は動かさずコピーを作成する(`delete_only` モードでは行削除のみ許可・加筆はサーバー側で拒否)。

---

## セットアップ

### 1. バックエンド(FastAPI / Python 3.10+)

```bash
cd backend

pip install -r requirements.txt

# デモ用データを投入(初回のみ。--reset で作り直し)
PYTHONPATH=. python seed.py

# サーバー起動
uvicorn app.main:app --reload
```

起動後 http://localhost:8000/docs でAPIドキュメント(Swagger UI)を確認できる。

### 2. フロントエンド(Vite + React / Node 18+)

別のターミナルで:

```bash
cd frontend
npm install
npm run dev
```

http://localhost:5173 でアプリが開く。バックエンドと両方起動しておくこと。


### 3. AI機能(任意・無くてもアプリは完全動作)

**召喚の意味検索**(ローカル埋め込み・API費ゼロ):

```bash
pip install fastembed   # 初回起動時にモデルを自動DL
```

未インストール時はバイグラム一致検索に自動フォールバックする。

**アウトカムバイアス検出 / タグ分類フォールバック**(Gemini):

```bash
# backend/.env に記載(gitignore済み。コードに直書きしない)
GEMINI_API_KEY=your-key-here
```

キー未設定・API障害時は機能が自動で無効化され、綴じる動作は止まらない。

---

## ディレクトリ構造

```
my-pivot/
├── backend/
│   ├── app/
│   │   ├── main.py              # 起動ポイント・CORS
│   │   ├── models.py            # Book / Entry / EntryAppend / Tag / User / BiasCheck
│   │   ├── settings.py          # 設定と feature flags(バックエンド側)
│   │   ├── database.py
│   │   ├── auth/                # JWT + Google OAuth スタブ(AuthProvider)
│   │   ├── routers/
│   │   │   ├── auth.py          # 登録 / ログイン / me
│   │   │   ├── library.py       # 本棚・執筆・結果・追記・延期
│   │   │   ├── publish.py       # 公開(コピー作成・delete_only 検証)
│   │   │   ├── insights.py      # 通知(due)・キャリブレーション統計
│   │   │   ├── recall.py        # 召喚(意味検索)
│   │   │   └── bias.py          # アウトカムバイアス検出
│   │   └── services/
│   │       ├── embeddings.py    # ローカル埋め込み
│   │       ├── bias_check.py    # バイアス照合(Gemini)
│   │       ├── tag_mapper.py    # タグ→カテゴリ(ルールベース)
│   │       └── llm_mapper.py    # 辞書外タグのLLM分類
│   └── seed.py                  # デモデータ(12冊・20エントリ)
│
└── frontend/
    └── src/
        ├── App.tsx
        ├── config/flags.ts      # feature flags(フロント側)
        ├── components/
        │   ├── Bookcase.tsx         # 三棚本棚
        │   ├── BookOverlay.tsx      # 見開き(v4: 書く専用レイアウト)
        │   ├── CalibrationModal.tsx # SVGキャリブレーション曲線
        │   ├── EmotionalTimeline.tsx
        │   ├── TopBar.tsx           # 通知ベル
        │   ├── SharedAccessModal.tsx
        │   └── spread/              # WriteSection / TimelineSection / Badges
        └── lib/                 # api / auth / recall / dates
```

---

## 設計上の決めごと

- **AIの節度**:T1(決定時)にAIは答えを出さない(召喚は検索であって生成ではない)。T2の指摘は疑問形の問い1つに限定し、綴じるのを妨げない


