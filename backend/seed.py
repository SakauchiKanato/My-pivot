"""
デモ用シードデータ投入

実行:
    cd backend
    python seed.py

作成されるアカウント:
    email:    demo@example.com
    password: demopass

※ ピッチ前にチームの実データへ差し替える場合、このファイルの
   BOOKS / ENTRIES を編集して `python seed.py --reset` を実行する。
"""
import sys
from datetime import datetime

from sqlmodel import Session, select, delete

from app.database import engine, create_db_and_tables
from app.models import (
    User, Book, Entry, EntryAppend, Tag, EntryTagLink, Shelf, Outcome, Judgment,
)
from app.services.tag_mapper import map_tag_to_category
from app.auth.jwt_provider import hash_password

# key はスクリプト内参照用。DB の id は自動採番。
BOOKS = [
    {"key": "b1",  "shelf": "mine",   "title": "進路の迷い",       "fill": "#1c3540", "h": 146},
    {"key": "b2",  "shelf": "mine",   "title": "研究室のこと",     "fill": "#4b3f78", "h": 153},
    {"key": "b3",  "shelf": "mine",   "title": "技育祭の判断",     "fill": "#5a1730", "h": 140},
    {"key": "b4",  "shelf": "mine",   "title": "ハッカソン初参加", "fill": "#2f6f58", "h": 151},
    {"key": "b5",  "shelf": "mine",   "title": "休む選択",         "fill": "#6a4a2a", "h": 137},
    {"key": "b6",  "shelf": "mine",   "title": "応募しなかった日", "fill": "#672f36", "h": 149},
    {"key": "b7",  "shelf": "shared", "title": "共同開発メモ",     "fill": "#305f8f", "h": 144, "passcode": "kaihatsu"},
    {"key": "b8",  "shelf": "shared", "title": "締切前の焦り",     "fill": "#383838", "h": 148, "passcode": "shimekiri"},
    {"key": "b9",  "shelf": "shared", "title": "発表の前夜",       "fill": "#422a54", "h": 142, "passcode": "happyou"},
    {"key": "b10", "shelf": "senpai", "title": "院進をやめた記録", "fill": "#25413c", "h": 155},
    {"key": "b11", "shelf": "senpai", "title": "研究室を変えた話", "fill": "#1f4f68", "h": 143},
    {"key": "b12", "shelf": "senpai", "title": "休学の一年",       "fill": "#54432b", "h": 136},
]

ENTRIES = [
    {"book": "b1", "date": "2024-07-02", "title": "院進か就職か", "tags": ["進路", "不安"], "confidence": 2,
     "body": "研究は好きだが、経済的な不安が消えない。周りが動き出していて焦る。まだどちらとも言えない。",
     "outcome": "pending", "judgment": None, "resolveDate": "2026-07-01"},
    {"book": "b1", "date": "2025-10-11", "title": "インターン先を選ぶ", "tags": ["進路", "決定"], "confidence": 3,
     "body": "知名度より、現場が近い方を選ぶ。合っているかは分からない。",
     "outcome": "ok", "judgment": "sound", "resolvedOn": "2026-02-10",
     "reasonOutcome": "現場を見て、進路の解像度が一段上がった。",
     "reasonJudgment": "情報を集め切ってから決めたプロセスは妥当だった。"},
    {"book": "b2", "date": "2024-04-05", "title": "第一希望の研究室に出す", "tags": ["研究", "不安"], "confidence": 2,
     "body": "怖い。落ちたら立ち直れない気がする。でも直感はここだと言っている。",
     "outcome": "ok", "judgment": "sound", "resolvedOn": "2024-10-01",
     "reasonOutcome": "環境もテーマも合っていた。直感を信じてよかった。",
     "reasonJudgment": "怖さと相性は別物だと切り分けられていた。"},
    {"book": "b2", "date": "2025-12-01", "title": "研究テーマを変える相談", "tags": ["研究", "挑戦"], "confidence": 4,
     "body": "今のテーマでは自分が持たない。先生に切り出す。",
     "outcome": "ok", "judgment": "sound", "resolvedOn": "2026-03-20",
     "reasonOutcome": "相談したら想像より早く道が開けた。",
     "reasonJudgment": "抱え込まずに早く動いた判断は正しかった。"},
    {"book": "b3", "date": "2024-07-20", "title": "技育祭に行くか", "tags": ["挑戦", "後悔", "不安"], "confidence": 1,
     "body": "行っても意味があるのか分からず、もう3ヶ月迷っている。",
     "outcome": "ng", "judgment": "flawed", "resolvedOn": "2024-11-05",
     "reasonOutcome": "結局行かず、あとから登壇内容を知って後悔した。",
     "reasonJudgment": "迷い続けること自体がコストだと気づけていなかった。"},
    {"book": "b4", "date": "2025-04-18", "title": "ハッカソンに出るか", "tags": ["挑戦", "不安", "仲間"], "confidence": 2,
     "body": "実力不足で迷惑をかけそうで怖い。でも出ない後悔は技育祭で知っている。",
     "outcome": "ok", "judgment": "sound", "resolvedOn": "2025-05-30",
     "reasonOutcome": "実装より、同じ熱量の人に会えたことが大きかった。",
     "reasonJudgment": "過去の後悔を判断材料にできた。"},
    {"book": "b4", "date": "2025-05-10", "title": "チーム編成を妥協する", "tags": ["仲間", "後悔"], "confidence": 3,
     "body": "誘いにくくて、声をかけずに手近な編成で済ませた。",
     "outcome": "ng", "judgment": "flawed", "resolvedOn": "2025-07-15",
     "reasonOutcome": "役割が偏って、後半に負荷が集中した。",
     "reasonJudgment": "気まずさを避けたのは判断ではなく回避だった。"},
    {"book": "b5", "date": "2025-02-09", "title": "今夜は寝る", "tags": ["生活", "不安"], "confidence": 1,
     "body": "止まったら負けだと思っている。でも限界かもしれない。",
     "outcome": "ok", "judgment": "sound", "resolvedOn": "2025-02-10",
     "reasonOutcome": "一晩寝たら判断の質が戻った。",
     "reasonJudgment": "「止まる」も選択肢だと認められた。"},
    {"book": "b5", "date": "2026-03-02", "title": "バイトを減らす", "tags": ["生活", "決定"], "confidence": 3,
     "body": "研究時間を確保したい。収入は減るが、今はそちらが優先のはず。",
     "outcome": "ng", "judgment": "sound", "resolvedOn": "2026-06-15",
     "reasonOutcome": "収入が減って想定より生活が苦しい。結果だけ見れば後悔。",
     "reasonJudgment": "当時の情報では研究時間の確保が最優先で、判断そのものは妥当だった。"},
    {"book": "b6", "date": "2025-03-14", "title": "応募をやめた", "tags": ["後悔", "挑戦"], "confidence": 2,
     "body": "まだ早い気がする。来年でいいはず。",
     "outcome": "ng", "judgment": "flawed", "resolvedOn": "2025-06-01",
     "reasonOutcome": "後で募集要項を見返したら、十分いけた。",
     "reasonJudgment": "「まだ早い」は根拠のない先送りだった。"},
    {"book": "b6", "date": "2026-06-20", "title": "リベンジ応募", "tags": ["挑戦", "不安"], "confidence": 3,
     "body": "去年は「まだ早い」で逃げた。今年は出す。",
     "outcome": "pending", "judgment": None, "resolveDate": "2026-08-01"},
    {"book": "b7", "date": "2025-09-05", "title": "役割分担を先に決める", "tags": ["仲間", "決定"], "confidence": 4,
     "body": "曖昧さを残すと衝突が増える。最初に役割を切る。",
     "outcome": "ok", "judgment": "sound", "resolvedOn": "2025-11-20",
     "reasonOutcome": "役割を明確にしたら一気に進み始めた。",
     "reasonJudgment": "過去の共同作業の失敗から学べていた。"},
    {"book": "b7", "date": "2026-02-14", "title": "枯れたライブラリを選ぶ", "tags": ["研究", "決定"], "confidence": 4,
     "body": "新しい方が速いらしいが、情報の多さを優先する。",
     "outcome": "ok", "judgment": "sound", "resolvedOn": "2026-05-01",
     "reasonOutcome": "詰まったとき、事例の多さに何度も救われた。",
     "reasonJudgment": "チームの練度に合わせた選定は妥当だった。"},
    {"book": "b8", "date": "2025-06-25", "title": "追加タスクを引き受ける", "tags": ["生活", "後悔"], "confidence": 4,
     "body": "勢いで引き受けた。いける気がしている。",
     "outcome": "ng", "judgment": "flawed", "resolvedOn": "2025-07-30",
     "reasonOutcome": "締切前に体力が尽きて、品質を落とした。",
     "reasonJudgment": "見込み★4でも、体力の見積もりが抜けていた。"},
    {"book": "b9", "date": "2025-11-21", "title": "完璧じゃないまま発表する", "tags": ["研究", "不安", "挑戦"], "confidence": 2,
     "body": "穴だらけの気がする。でも今出さないと前に進まない。",
     "outcome": "ok", "judgment": "sound", "resolvedOn": "2025-11-22",
     "reasonOutcome": "質問で、むしろ研究の輪郭が見えた。",
     "reasonJudgment": "完成度より速度を取ったのは正しかった。"},
    {"book": "b9", "date": "2026-05-30", "title": "デモは実データで行く", "tags": ["挑戦", "決定"], "confidence": 5,
     "body": "作り物のデータでは響かない。自分たちの記録で見せる。",
     "outcome": "ok", "judgment": "sound", "resolvedOn": "2026-06-10",
     "reasonOutcome": "聞き手の反応が明らかに違った。",
     "reasonJudgment": "リスクはあったが、狙いに沿った判断だった。"},
    {"book": "b10", "date": "2023-12-10", "title": "院進をやめる", "tags": ["進路", "不安"], "confidence": 3,
     "body": "怖さを全部書き出してから決めた。逃げではなく選択にしたい。",
     "outcome": "ok", "judgment": "sound", "resolvedOn": "2024-06-01",
     "reasonOutcome": "納得感が残った。後悔はしていない。",
     "reasonJudgment": "怖さを言語化してから選んだのが効いた。"},
    {"book": "b10", "date": "2023-08-02", "title": "教授に相談せず決める", "tags": ["進路", "不安"], "confidence": 1,
     "body": "怒られる気がして、相談を飛ばして自分だけで決めようとしている。",
     "outcome": "ng", "judgment": "flawed", "resolvedOn": "2023-10-15",
     "reasonOutcome": "あとで話したら、知らなかった選択肢が二つもあった。",
     "reasonJudgment": "「怖いから聞かない」は判断材料を自分で減らす行為だった。"},
    {"book": "b11", "date": "2022-10-15", "title": "研究室を移る", "tags": ["研究", "挑戦"], "confidence": 3,
     "body": "環境を変えるのは怖いが、このまま消耗する方が怖い。",
     "outcome": "ng", "judgment": "sound", "resolvedOn": "2023-09-01",
     "reasonOutcome": "結果的に卒業は半年遅れた。",
     "reasonJudgment": "それでも、あの環境に残る選択肢はなかった。判断は間違っていない。"},
    {"book": "b12", "date": "2021-04-01", "title": "休学届を出す", "tags": ["生活", "進路"], "confidence": 5,
     "body": "一度止まる。戻ってくるための休学にする。",
     "outcome": "ok", "judgment": "sound", "resolvedOn": "2022-04-01",
     "reasonOutcome": "一年かけて、進みたい方向が言葉になった。",
     "reasonJudgment": "目的を先に決めた休学だったのが良かった。"},
]


def run(reset: bool = False):
    create_db_and_tables()
    with Session(engine) as session:
        if reset:
            for model in (EntryTagLink, EntryAppend, Entry, Tag, Book):
                session.exec(delete(model))
            session.commit()
            print("既存の本・記録を削除しました。")

        if session.exec(select(Book)).first():
            print("既にデータがあります。--reset で入れ直せます。")
            return

        demo = session.exec(select(User).where(User.email == "demo@example.com")).first()
        if not demo:
            demo = User(
                username="demo",
                email="demo@example.com",
                hashed_password=hash_password("demopass"),
            )
            session.add(demo)
            session.commit()
            session.refresh(demo)
            print("デモユーザー作成: demo@example.com / demopass")

        book_ids = {}
        for b in BOOKS:
            # senpai の本は owner なし(全員に読み専用)
            owner = None if b["shelf"] == "senpai" else demo.id
            book = Book(
                shelf=Shelf(b["shelf"]), title=b["title"],
                fill=b["fill"], height=b["h"], owner_id=owner,
                passcode=b.get("passcode"),
            )
            session.add(book)
            session.flush()
            book_ids[b["key"]] = book.id

        tag_cache = {}
        for e in ENTRIES:
            # senpai のエントリは author なし(計器の対象外にするため)
            shelf = next(b["shelf"] for b in BOOKS if b["key"] == e["book"])
            author = None if shelf == "senpai" else demo.id
            entry = Entry(
                book_id=book_ids[e["book"]],
                author_id=author,
                date=e["date"],
                title=e["title"],
                body=e["body"],
                confidence=e["confidence"],
                outcome=Outcome(e["outcome"]),
                judgment=Judgment(e["judgment"]) if e.get("judgment") else None,
                reason_outcome=e.get("reasonOutcome", ""),
                reason_judgment=e.get("reasonJudgment", ""),
                resolve_date=e.get("resolveDate"),
                resolved_on=e.get("resolvedOn"),
                saved_at=datetime(2020, 1, 1),  # FIX_WINDOW を確実に過ぎた扱い
            )
            session.add(entry)
            for name in e["tags"]:
                if name not in tag_cache:
                    tag_cache[name] = session.exec(
                        select(Tag).where(Tag.name == name)
                    ).first() or Tag(name=name, category=map_tag_to_category(name))
                entry.tags.append(tag_cache[name])
        session.commit()
        print(f"投入完了: 本 {len(BOOKS)} 冊、記録 {len(ENTRIES)} 件")


if __name__ == "__main__":
    run(reset="--reset" in sys.argv)
