"""
召喚の意味検索(AI候補A): ローカル文埋め込み

設計制約(T1にAIは答えを出さない)を守るための性質:
- 読み出し専用。要約・助言・生成は一切しない。似た過去の記録を「探す」だけ
- 提示するのは生データ(原本エントリ)。AIが加工した文章は画面に出ない

実装方針:
- fastembed(ONNX, ローカル実行)。API費ゼロ・オフライン動作
- モデルのロードは起動時にバックグラウンドスレッドで行い、
  ロード完了までは /api/recall が available=false を返す
  → フロントは従来の bigram 一致に自動フォールバック(デモが止まらない)
- fastembed 未インストールの環境でもアプリ本体は普通に動く

テスト用フック: 環境変数 MY_PIVOT_FAKE_EMBED=1 で、モデルDL不要の
決定的な擬似ベクトル(文字bigramハッシュ)に切り替わる。CI/検証用。
"""
import os
import struct
import threading
import zlib
from typing import Iterable, List, Optional

from sqlmodel import Session, select

from app import settings
from app.models import Entry, EntryEmbedding

_lock = threading.Lock()
_model = None            # ロード済みモデル(または _FakeModel)
_model_failed = False    # import/DL 失敗。以後は諦めて bigram に任せる
_loader_started = False


class _FakeModel:
    """MY_PIVOT_FAKE_EMBED=1 のときだけ使う決定的な擬似埋め込み(テスト用)。"""
    DIM = 256

    def embed(self, texts: Iterable[str]):
        for t in texts:
            v = [0.0] * self.DIM
            s = "".join(str(t).split())
            for i in range(len(s) - 1):
                v[zlib.crc32(s[i : i + 2].encode("utf-8")) % self.DIM] += 1.0
            n = sum(x * x for x in v) ** 0.5 or 1.0
            yield [x / n for x in v]


def active_model_name() -> str:
    if os.environ.get("MY_PIVOT_FAKE_EMBED") == "1":
        return "fake-bigram-hash"
    return settings.RECALL_MODEL


def is_ready() -> bool:
    return _model is not None


def _load_model_blocking():
    """モデルをロードする。バックグラウンドスレッドからのみ呼ぶこと。"""
    global _model, _model_failed
    with _lock:
        if _model is not None or _model_failed:
            return
        if os.environ.get("MY_PIVOT_FAKE_EMBED") == "1":
            _model = _FakeModel()
            return
        try:
            from fastembed import TextEmbedding

            _model = TextEmbedding(settings.RECALL_MODEL)
            print(f"[recall] 埋め込みモデル準備完了: {settings.RECALL_MODEL}")
        except Exception as e:  # ImportError / DL失敗など
            _model_failed = True
            print(f"[recall] 意味検索は無効(bigramフォールバック): {e}")


def ensure_loading():
    """非同期でロードを開始する(すでに開始済みなら何もしない)。"""
    global _loader_started
    if _loader_started or _model is not None or _model_failed:
        return
    _loader_started = True
    threading.Thread(target=_load_model_blocking, daemon=True).start()


def embed_texts(texts: List[str]) -> Optional[List[List[float]]]:
    """ロード済みならベクトルを返す。未ロード/失敗なら None(=フォールバック)。"""
    if _model is None:
        ensure_loading()
        return None
    return [list(map(float, v)) for v in _model.embed(texts)]


def _prefixed(texts: List[str], kind: str) -> List[str]:
    """e5系モデルは学習時の形式に合わせ query:/passage: 接頭辞が必要。"""
    if "e5" in active_model_name().lower():
        p = "query: " if kind == "query" else "passage: "
        return [p + t for t in texts]
    return texts


def embed_query_texts(texts: List[str]) -> Optional[List[List[float]]]:
    """検索クエリ側の埋め込み(recall APIから使う)。"""
    return embed_texts(_prefixed(texts, "query"))


def embed_passage_texts(texts: List[str]) -> Optional[List[List[float]]]:
    """検索対象(エントリ)側の埋め込み。"""
    return embed_texts(_prefixed(texts, "passage"))


# ---------- 直列化 ----------
def _pack(vec: List[float]) -> bytes:
    return struct.pack(f"<{len(vec)}f", *vec)


def _unpack(blob: bytes) -> List[float]:
    return list(struct.unpack(f"<{len(blob) // 4}f", blob))


def cosine(a: List[float], b: List[float]) -> float:
    if len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = sum(x * x for x in a) ** 0.5
    nb = sum(x * x for x in b) ** 0.5
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def entry_text(e: Entry) -> str:
    """埋め込み対象のテキスト。bigram版と同じく title+body+tags を使う。"""
    tags = " ".join(t.name for t in e.tags)
    return f"{e.title}\n{e.body}\n{tags}".strip()


# ---------- 保存・バックフィル ----------
def upsert_entry_embedding(session: Session, entry: Entry) -> bool:
    """1件計算して保存。モデル未ロードなら何もしない(後でバックフィルされる)。"""
    vecs = embed_passage_texts([entry_text(entry)])
    if not vecs:
        return False
    vec = vecs[0]
    row = session.get(EntryEmbedding, entry.id)
    if row is None:
        row = EntryEmbedding(entry_id=entry.id)
    row.model = active_model_name()
    row.dim = len(vec)
    row.vector = _pack(vec)
    session.add(row)
    session.commit()
    return True


def backfill_missing(session: Session, entries: List[Entry]) -> int:
    """ベクトル未計算(またはモデルが変わった)エントリをまとめて計算する。"""
    if not is_ready():
        return 0
    name = active_model_name()
    rows = {r.entry_id: r for r in session.exec(select(EntryEmbedding))}
    targets = [e for e in entries if e.id is not None and (e.id not in rows or rows[e.id].model != name)]
    if not targets:
        return 0
    vecs = embed_passage_texts([entry_text(e) for e in targets])
    if vecs is None:
        return 0
    for e, vec in zip(targets, vecs):
        row = rows.get(e.id) or EntryEmbedding(entry_id=e.id)
        row.model = name
        row.dim = len(vec)
        row.vector = _pack(vec)
        session.add(row)
    session.commit()
    return len(targets)


def load_vectors(session: Session, entry_ids: List[int]) -> dict:
    """entry_id -> vector。現行モデルの行だけ返す。"""
    name = active_model_name()
    out = {}
    for r in session.exec(select(EntryEmbedding)):
        if r.entry_id in set(entry_ids) and r.model == name and r.vector:
            out[r.entry_id] = _unpack(r.vector)
    return out


def warmup_and_backfill():
    """起動時にバックグラウンドで呼ぶ: モデルロード → 全エントリのベクトル計算。"""
    from app.database import engine  # 循環import回避のため遅延import

    _load_model_blocking()
    if not is_ready():
        return
    try:
        with Session(engine) as session:
            entries = list(session.exec(select(Entry)))
            n = backfill_missing(session, entries)
            if n:
                print(f"[recall] 既存記録 {n} 件のベクトルを計算しました")
    except Exception as e:
        print(f"[recall] バックフィル失敗(次回リクエスト時に再試行): {e}")
