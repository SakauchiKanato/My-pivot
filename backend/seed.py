"""
デモ用の初期データを投入するスクリプト

実行方法：
    cd backend
    python seed.py

※ ここのデータは仮のサンプル。
   本番デモでは「チームメンバー自身の実体験」に差し替えると、
   審査基準（山室先輩「好き・情熱が伝わるか」）への訴求が最大化される。
"""
from datetime import datetime

from sqlmodel import Session

from app.database import engine, create_db_and_tables
from app.models import Pivot, Tag, Layer, Flag
from app.services.tag_mapper import map_tag_to_category


# (title, content, tags, flag, confidence, year, month)
SAMPLE_DATA = [
    ("情報系の専攻を選んだ",
     "文系か理系か迷ったが、可能性を広げたくて情報系にした。数学が怖かったが、プログラミングの楽しさが決め手。",
     ["#専攻", "#不安", "#直感"], Flag.SUCCESS, 3, 2023, 4),
    ("研究室見学をサボった",
     "めんどくさくて見学に行かなかった。結果、人気研究室に入れず後悔。",
     ["#後悔", "#怠惰"], Flag.REGRET, 2, 2024, 1),
    ("第三希望の研究室が正解だった",
     "第一・第二が取れなかったが、第三希望の先生と意気投合。最初の希望が正解とは限らないと学んだ。",
     ["#研究", "#出会い"], Flag.SUCCESS, 2, 2024, 4),
    ("就活か院進か3ヶ月迷った",
     "どちらにも踏み切れず夏が終わった。もっと早く動くべきだった。",
     ["#進路", "#迷い", "#就活"], Flag.REGRET, 1, 2024, 7),
    ("ハッカソン初参加・My Pivot誕生",
     "あの7月の後悔がエンジニアの道を開いた。赤の後に必ず緑が続く。それを可視化するのがMy Pivot。",
     ["#挑戦", "#達成"], Flag.SUCCESS, 4, 2025, 4),
]


def seed():
    create_db_and_tables()
    with Session(engine) as session:
        for title, content, tag_names, flag, conf, year, month in SAMPLE_DATA:
            pivot = Pivot(
                title=title,
                content=content,
                layer=Layer.PIVOT,
                flag=flag,
                confidence=conf,
                created_at=datetime(year, month, 1),
            )
            for name in tag_names:
                category = map_tag_to_category(name)
                pivot.tags.append(Tag(name=name, category=category))
            session.add(pivot)
        session.commit()
    print(f"{len(SAMPLE_DATA)} 件のデモデータを投入しました。")


if __name__ == "__main__":
    seed()
