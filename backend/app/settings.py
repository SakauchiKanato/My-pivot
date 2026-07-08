"""
アプリ設定と feature flags

チームで未決の判断事項(A〜D群)は、ここと frontend/src/config/flags.ts の
2ファイルだけを書き換えれば挙動が切り替わるように設計している。
決定が出たら該当フラグを変更し、DECISIONS.md に日付と結論を追記すること。
"""
import os


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
