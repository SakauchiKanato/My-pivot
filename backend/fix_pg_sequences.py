"""
Postgres のID自動採番(シーケンス)を修復するスクリプト。

症状: 新規作成時に "duplicate key value violates unique constraint xxx_pkey"
原因: 既存データをID込みでPostgresに投入すると、シーケンスが進まず
      次のINSERTが既存IDと衝突する。
対処: 各テーブルのシーケンスを MAX(id)+1 に合わせる。

使い方(backendで、.envにDATABASE_URLがある状態で):
    python fix_pg_sequences.py
何度実行しても安全(冪等)。
"""
from sqlalchemy import text

from app import settings  # noqa: F401  (.env を読み込むため先にimport)
from app.database import engine, DATABASE_URL

# id が自動採番のテーブル("user"はPostgresの予約語なので引用符が要る)
TABLES = ["user", "book", "entry", "tag", "entryappend", "biascheck"]


def main():
    if not DATABASE_URL.startswith("postgresql"):
        print(f"対象はPostgresのみです。現在のDATABASE_URL: {DATABASE_URL.split('://')[0]}://...")
        return
    with engine.begin() as conn:
        for t in TABLES:
            quoted = f'"{t}"'
            seq = conn.execute(
                text("SELECT pg_get_serial_sequence(:tbl, 'id')"), {"tbl": quoted}
            ).scalar()
            if not seq:
                print(f"  {t}: シーケンスなし(スキップ)")
                continue
            max_id = conn.execute(text(f"SELECT COALESCE(MAX(id), 0) FROM {quoted}")).scalar()
            conn.execute(
                text("SELECT setval(:seq, :val, false)"), {"seq": seq, "val": max_id + 1}
            )
            print(f"  {t}: MAX(id)={max_id} → 次のIDを {max_id + 1} に設定")
    print("完了。新規作成が通るはずです。")


if __name__ == "__main__":
    main()
