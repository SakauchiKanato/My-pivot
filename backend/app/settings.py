"""
アプリ設定と feature flags

チームで未決の判断事項(A〜D群)は、ここと frontend/src/config/flags.ts の
2ファイルだけを書き換えれば挙動が切り替わるように設計している。
決定が出たら該当フラグを変更し、DECISIONS.md に日付と結論を追記すること。
"""
import os

# backend/.env があれば読み込む(GEMINI_API_KEY などの秘匿情報用。.envはgitignore済み)
try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass


def _bool(key: str, default: bool) -> bool:
    v = os.environ.get(key)
    if v is None:
        return default
    return v.lower() in ("1", "true", "yes")


# --- 認証 ---
# "jwt"    : メール+パスワード(現行)
# "google" : Google OAuth(将来。auth/google_provider.py を実装して切替)
AUTH_PROVIDER = os.environ.get("AUTH_PROVIDER", "jwt")
SECRET_KEY = os.environ.get("SECRET_KEY", "my-pivot-dev-secret-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7日間

# --- 記録の不変性 ---
FIX_WINDOW_SECONDS = 120          # 綴じた後、修正(削除→書き直し)が許される秒数
PENDING_DEFAULT_MONTHS = 6        # 「日付は未定」のときの結果予定日

# --- 共同の書架 ---
SHARED_PASSCODE_MIN_LEN = 4       # 共同の本を作るときに設定する合言葉の最小文字数

# ============================================================
# 未決事項フラグ(B群: 参照と公開)
# ============================================================

# B-2: 執筆フォームに公開トグルを置かない(公開は年表からの事後行為)
#      True の間、公開APIは「結果が出た記録」以外を拒否しない設計上の意味はないが、
#      フロント側フラグと対で管理する。原則が覆ったら False に。
PUBLISH_POST_HOC_ONLY = _bool("PUBLISH_POST_HOC_ONLY", True)

# 公開機能そのもののON/OFF(D-1 凍結判断で切れるように)
PUBLISH_ENABLED = _bool("PUBLISH_ENABLED", True)

# 公開できるのは結果が出た(outcome確定)記録のみか
PUBLISH_REQUIRE_RESOLVED = _bool("PUBLISH_REQUIRE_RESOLVED", True)

# B-3: 公開時の編集ルール
#   "delete_only" : 原本コピーに対し行単位の削除のみ許可(加筆不可)
#   "free"        : 自由編集
PUBLISH_EDIT_MODE = os.environ.get("PUBLISH_EDIT_MODE", "delete_only")

# B-4: 出版先に先達棚を含めるか
PUBLISH_TO_SENPAI = _bool("PUBLISH_TO_SENPAI", False)

# B-1: 個人→共同の片方向参照(引用リンク)。未実装スタブ。
REFERENCE_LINKS_ENABLED = _bool("REFERENCE_LINKS_ENABLED", False)

# ============================================================
# AI候補A: 召喚の意味検索(embedding)
# ============================================================
# 設計制約: T1(決定時)にAIは答えを出さない。これは検索であって生成ではない。
# 読み出し専用なので confidence 汚染ゼロ。

# 意味検索のON/OFF。fastembed 未インストールでも自動で無効化される
RECALL_SEMANTIC_ENABLED = _bool("RECALL_SEMANTIC_ENABLED", True)

# ローカル埋め込みモデル(fastembed/ONNX)。初回にHFから自動DL
#   - "intfloat/multilingual-e5-large"(既定): ~2.2GB・日本語精度が高い
#   - MiniLM: ~500MB・軽いが精度そこそこ(非力なマシン用)
RECALL_MODEL = os.environ.get("RECALL_MODEL", "intfloat/multilingual-e5-large")

# この類似度未満は「似た迷い」として出さない(0〜1)。
# モデルによりスコア分布が違う: MiniLM系は0.4前後、e5系は0.8前後が目安
_default_sim = "0.8" if "e5" in RECALL_MODEL.lower() else "0.4"
RECALL_MIN_SIMILARITY = float(os.environ.get("RECALL_MIN_SIMILARITY", _default_sim))

# ============================================================
# AI候補B: アウトカムバイアス検出(T2: 結果を綴じるとき)
# ============================================================
# 設計制約: AIは断定しない。バイアスの疑いがあるときに「問い」を1つ返すだけ。
# 綴じるのを妨げない(ユーザーは問いを無視してそのまま綴じられる)。
# 決定時の記録(entry.body)が不変だから「当時知り得た情報」との照合が成立する。

BIAS_CHECK_ENABLED = _bool("BIAS_CHECK_ENABLED", True)

# Gemini API。キー未設定なら機能は自動で無効(綴じる動作には影響しない)
# キーは backend/.env に書くこと。コードに直書きするとGitHubにpushできない(Push Protection)
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
BIAS_CHECK_TIMEOUT_SECONDS = float(os.environ.get("BIAS_CHECK_TIMEOUT_SECONDS", "12"))

# ============================================================
# タグ・カテゴリの自動マッピング(LLMフォールバック)
# ============================================================
# ルールベース辞書(tag_mapper.TAG_RULES)にないタグだけをGeminiに分類させる。
# 分類はTag新規作成時に1回だけ(以後はDBのカテゴリを再利用)。
# キー未設定・障害時は従来どおり「その他」になる。
TAG_LLM_ENABLED = _bool("TAG_LLM_ENABLED", True)
TAG_LLM_TIMEOUT_SECONDS = float(os.environ.get("TAG_LLM_TIMEOUT_SECONDS", "6"))
