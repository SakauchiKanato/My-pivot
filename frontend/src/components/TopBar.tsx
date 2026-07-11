import { useEffect, useRef, useState } from "react";
import type { Book, Entry, CalibrationStats } from "../lib/api";
import type { AuthUser } from "../lib/auth";

interface Props {
  user: AuthUser;
  stats: CalibrationStats | null;
  due: Entry[];
  books: Book[];
  onOpenMeter: () => void;
  onOpenDue: (entry: Entry) => void;
  onLogout: () => void;
  onOpenTimeline: () => void;
}

export function TopBar({ user, stats, due, books, onOpenMeter, onOpenDue, onLogout, onOpenTimeline }: Props) {
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  // ミニ計器3枠目: n>=5 のタグから全体との乖離が最大のもの
  let tagText = "—";
  let tagLabel = "タグ別(記録待ち)";
  if (stats && stats.okRate !== null) {
    const eligible = stats.tags.filter((t) => t.n >= 5);
    let best: { tag: string; rate: number; dev: number } | null = null;
    for (const t of eligible) {
      const dev = Math.abs(t.rate - stats.okRate);
      if (!best || dev > best.dev) best = { tag: t.tag, rate: t.rate, dev };
    }
    if (best) {
      tagText = `${best.rate}%`;
      tagLabel = `#${best.tag}の成功率`;
    }
  }

  const bookTitle = (bookId: number) => books.find((b) => b.id === bookId)?.title ?? "";

  return (
    <header className="topbar">
      <div>
        <h1>書庫</h1>
        <p className="subtitle">迷いを本に綴じ、時が来たら結果をたずね、判断の癖を計器で見る。</p>
        <p className="user-chip" style={{ marginTop: 8 }}>
          {user.username} さんの書庫
          <button className="plain" type="button" onClick={onOpenTimeline} style={{ marginLeft: 16 }}>
            ⏳ タイムライン
          </button>
          <button className="plain" type="button" onClick={onLogout} style={{ marginLeft: 16 }}>
            ログアウト
          </button>
        </p>
      </div>
      <div className="bell-wrap" ref={bellRef}>
        <button
          className="icon-btn bell"
          type="button"
          aria-label="結果をたずねる通知"
          onClick={(e) => {
            e.stopPropagation();
            setBellOpen((v) => !v);
          }}
        >
          🔔
          {due.length > 0 && <span className="badge-dot">{due.length}</span>}
        </button>
        <div className={`bell-panel${bellOpen ? " open" : ""}`} aria-label="通知一覧">
          <div className="bell-title">結果、そろそろ分かる頃では?</div>
          <div>
            {due.length === 0 ? (
              <div className="bell-empty">
                いまは、たずねることがありません。結果がわかりそうな日を綴じておくと、その頃にここでおたずねします。
              </div>
            ) : (
              due.map((e) => (
                <button
                  key={e.id}
                  className="bell-item"
                  type="button"
                  onClick={() => {
                    setBellOpen(false);
                    onOpenDue(e);
                  }}
                >
                  <b>『{e.title}』— その後、どうなりましたか?</b>
                  <span>
                    {bookTitle(e.bookId)} / 予定日 {e.resolveDate ?? ""} / 決定時の見込み ★
                    {e.confidence}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
      <button className="mini-meter" type="button" aria-label="全体のキャリブレーション計器を開く" onClick={onOpenMeter}>
        <span className="mini-stat">
          <b>{stats?.total ?? 0}</b>
          <span>記録した決定</span>
        </span>
        <span className="mini-stat">
          <b>{stats ? stats.avgConf.toFixed(1) : "0"}</b>
          <span>平均の見込み</span>
        </span>
        <span className="mini-stat">
          <b>{tagText}</b>
          <span>{tagLabel}</span>
        </span>
        <span className="meter-cta">クリックで計器を開く →</span>
      </button>
    </header>
  );
}
