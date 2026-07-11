/**
 * 本を開くオーバーレイ(v3 のアニメーションを移植)
 *
 * v4での変更点:
 * - モードタブ(目次/書く/探す/年表)を左ページ上部に固定表示。
 *   ページ送り(スクロール)せずにどのモードからでも移動できるようにする。
 * - mode === "write" のときは見開きを「書く」専用レイアウトに切り替え、
 *   左ページに本文+recall(WriteSectionLeft)、
 *   右ページにタイトル・タグ・確信度・日付・保存(WriteSectionRight)を表示する。
 *   これにより本文を書きながらスクロールせずに全項目が見渡せる。
 * - 上記以外のモード(目次/探す/年表)は従来どおり、
 *   左ページ=本の基本情報+本内検索、右ページ=モードごとのセクション。
 * A-1 の受け皿: FLAGS.spreadLayout === "tabs" のとき現行構造。
 * "past_present"(左=過去/右=現在)を採用する場合、renderLeftPage /
 * renderRightPage の中身を組み替える。各セクションは独立コンポーネント
 * なので、配置変更はこのファイル内で完結する。
 */
import { useEffect, useMemo, useState } from "react";
import type { Book, Entry } from "../lib/api";
import type { ServerFlags } from "../config/flags";
import { FLAGS } from "../config/flags";
import { Badges } from "./spread/Badges";
import { useWriteForm, WriteSectionLeft, WriteSectionRight, type WriteDraft } from "./spread/WriteSection";
import { TimelineSection } from "./spread/TimelineSection";

type Mode = "toc" | "write" | "search" | "timeline";
const SHELF_LABEL: Record<string, string> = {
  mine: "わたしの書架",
  shared: "共同の書架",
  senpai: "先達の書架",
};

interface Props {
  book: Book;
  books: Book[];
  allEntries: Entry[];
  startMode: Mode | null;
  focusEntryId: number | null;
  serverFlags: ServerFlags | null;
  onClose: () => void;
  onSaveEntry: Parameters<typeof useWriteForm>[0]["onSave"];
  onResolve: Parameters<typeof TimelineSection>[0]["onResolve"];
  onPostpone: (entryId: number) => Promise<void>;
  onAppend: (entryId: number, text: string) => Promise<void>;
  onWithdraw: (entry: Entry) => Promise<WriteDraft>;
  onPublish: Parameters<typeof TimelineSection>[0]["onPublish"];
  onUpdateColor: (bookId: number, fill: string) => Promise<void>;
  onDeleteBook: (bookId: number) => Promise<void>;
}

export function BookOverlay(props: Props) {
  const { book, onClose } = props;
  const readOnly = book.shelf === "senpai";
  const deletable = book.shelf !== "mine" || book.entries.length === 0;
  const entries = useMemo(
    () => [...book.entries].sort((a, b) => (a.date < b.date ? -1 : 1)),
    [book.entries]
  );
  const latest = entries.length ? entries[entries.length - 1] : null;

  const [mode, setMode] = useState<Mode>(props.startMode ?? "toc");
  const [innerQuery, setInnerQuery] = useState("");
  const [draft, setDraft] = useState<WriteDraft | null>(null);
  
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editColor, setEditColor] = useState(book.fill);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDeleteModalOpen, setConfirmDeleteModalOpen] = useState(false);

  const writeForm = useWriteForm({
    allEntries: props.allEntries,
    books: props.books,
    initialDraft: draft,
    onSave: async (data) => {
      await props.onSaveEntry(data);
      setDraft(null);
    },
  });


  // アニメーション段階: cover表示 → 開く → フリップ → 本文表示
  const [phase, setPhase] = useState<"init" | "cover" | "opening" | "flipping" | "ready">("init");
  const [closing, setClosing] = useState(false);
  const [flippedCount, setFlippedCount] = useState(0);

  useEffect(() => {
    const timers: number[] = [];
    timers.push(window.setTimeout(() => setPhase("cover"), 30));
    timers.push(window.setTimeout(() => setPhase("opening"), 680));
    timers.push(
      window.setTimeout(() => {
        setPhase("flipping");
        [0, 1, 2, 3].forEach((i) =>
          timers.push(window.setTimeout(() => setFlippedCount(i + 1), i * 100))
        );
        timers.push(window.setTimeout(() => setPhase("ready"), 900));
      }, 1330)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const close = () => {
    if (closing) return;
    setClosing(true);
    [3, 2, 1, 0].forEach((i, idx) =>
      window.setTimeout(() => setFlippedCount(i), idx * 100)
    );
    window.setTimeout(() => setPhase("opening"), 750);
    window.setTimeout(() => setPhase("cover"), 1130);
    window.setTimeout(() => onClose(), 1500);
  };

  const bookTagText =
    entries
      .flatMap((e) => e.tags)
      .filter((t, i, arr) => arr.indexOf(t) === i)
      .map((t) => `#${t}`)
      .join(" ") || "(まだ記録がありません)";

  const q = innerQuery.trim().toLowerCase();
  const innerMatches = entries.filter((e) => {
    const hay = (e.title + " " + (e.body || "") + " " + e.tags.join(" ")).toLowerCase();
    return !q || hay.includes(q);
  });

  const resultCards = innerMatches.length ? (
    innerMatches.map((e) => (
      <article className="result-card" key={e.id}>
        <div className="date">{e.date}</div>
        <b>{e.title}</b>
        <p className="hint" style={{ margin: 0 }}>
          {(e.body || "").slice(0, 72)}
        </p>
        <Badges entry={e} />
      </article>
    ))
  ) : (
    <div className="empty">該当する記録はまだありません。</div>
  );

  const tocButtons = (
    <div className="toc">
      {!readOnly && (
        <button type="button" onClick={() => setMode("write")}>
          <span>01</span>
          <b>
            この本に書く<small>迷いを殴り書きして、決定時の見込みごと綴じる</small>
          </b>
          <em>書込</em>
        </button>
      )}
      <button type="button" onClick={() => setMode("search")}>
        <span>{readOnly ? "01" : "02"}</span>
        <b>
          過去の記録を探す<small>タグと本文から、似た迷いを引き出す</small>
        </b>
        <em>検索</em>
      </button>
      <button type="button" onClick={() => setMode("timeline")}>
        <span>{readOnly ? "02" : "03"}</span>
        <b>
          年表を見る<small>決定時の見込みと、その後を時系列でたどる</small>
        </b>
        <em>年表</em>
      </button>
    </div>
  );

  const sharedBooks = props.books.filter((b) => b.shelf === "shared");

  const timelineSection = (
    <TimelineSection
      book={book}
      entries={entries}
      readOnly={readOnly}
      focusEntryId={props.focusEntryId}
      openFlagFor={props.focusEntryId}
      sharedBooks={sharedBooks}
      serverFlags={props.serverFlags}
      publishEnabled={FLAGS.publishEnabled && (props.serverFlags?.publishEnabled ?? true)}
      onResolve={props.onResolve}
      onPostpone={props.onPostpone}
      onAppend={props.onAppend}
      onFix={async (e) => {
        const d = await props.onWithdraw(e);
        setDraft(d);
        setMode("write");
      }}
      onPublish={props.onPublish}
    />
  );

  /* A-1 分岐点: "past_present" 採用時はここを組み替える */
  const isWriteSpread = mode === "write" && !readOnly;

  // 目次/書く/探す/年表: どのモードからでも移動できるよう左ページ上部に固定表示
  const modeTabs = (
    <div className="mode-tabs">
      <button
        type="button"
        className={mode === "toc" ? "active" : ""}
        onClick={() => setMode("toc")}
      >
        目次
      </button>
      {!readOnly && (
        <button
          type="button"
          className={mode === "write" ? "active" : ""}
          onClick={() => setMode("write")}
        >
          書く
        </button>
      )}
      <button
        type="button"
        className={mode === "search" ? "active" : ""}
        onClick={() => setMode("search")}
      >
        探す
      </button>
      <button
        type="button"
        className={mode === "timeline" ? "active" : ""}
        onClick={() => setMode("timeline")}
      >
        年表
      </button>
    </div>
  );

  const leftPage = (
    <div className="page left">
      {modeTabs}
      {isWriteSpread ? (
        <div style={{ position: "relative", height: "100%" }}>
          <WriteSectionLeft form={writeForm} />
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className={`shelf-badge ${book.shelf}`}>
              {SHELF_LABEL[book.shelf]}
              {readOnly ? " / 読み専用" : book.shelf === "mine" ? " / 非公開" : " / 仲間と共有"}
            </span>
            {!readOnly && (
              <button className="plain" style={{ fontSize: "12px" }} onClick={() => setSettingsOpen(true)}>
                ⚙️ 設定
              </button>
            )}
          </div>
          <h2>{book.title}</h2>
          <p className="hint">
            1ページ目。目次、本内検索、{readOnly ? "年表" : "書き込み"}の入口をまとめたホームです。
          </p>
          <label className="book-search">
            <span>⌕</span>
            <input
              type="search"
              placeholder="この本の中をフリーワード検索"
              value={innerQuery}
              onChange={(e) => {
                setInnerQuery(e.target.value);
                if (mode !== "search") setMode("search");
              }}
            />
          </label>
          {tocButtons}
          <div className="results">{resultCards}</div>
        </>
      )}
    </div>
  );

  const rightPage = (
    <div className="page right">
      {isWriteSpread ? (
        <div style={{ position: "relative", height: "100%" }}>
          <WriteSectionRight form={writeForm} />
        </div>
      ) : (
        <>
          <section className={`section${mode === "toc" ? " active" : ""}`}>
            <h2>本の現在地</h2>
            <p className="hint">いちばん新しい記録です。タブか左の目次からページを切り替えます。</p>
            {latest ? (
              <div className="result-card">
                <div className="date">{latest.date}</div>
                <b>{latest.title}</b>
                <p className="hint" style={{ margin: 0 }}>
                  {latest.body || ""}
                </p>
                <Badges entry={latest} />
              </div>
            ) : (
              <div className="empty">まだ記録がありません。最初の迷いを綴じてみましょう。</div>
            )}
          </section>
          <section className={`section${mode === "search" ? " active" : ""}`}>
            <h2>この本から探す</h2>
            <p className="hint">左ページの検索欄に入力すると、この本の記録から探せます。</p>
            <div className="chips">
              {["不安", "後悔", "挑戦", "決定"].map((w) => (
                <button
                  key={w}
                  className="chip"
                  type="button"
                  onClick={() => {
                    setInnerQuery(w);
                    setMode("search");
                  }}
                >
                  #{w}
                </button>
              ))}
            </div>
            <div className="results" style={{ marginTop: 12 }}>
              {resultCards}
            </div>
          </section>
          <section className={`section${mode === "timeline" ? " active" : ""}`}>
            {timelineSection}
          </section>
        </>
      )}
    </div>
  );

  return (
    <section
      id="fullscreenOverlay"
      className={phase !== "init" && !closing ? "active" : closing ? "" : "active"}
      style={{ display: "block", background: closing ? undefined : undefined }}
      aria-hidden="false"
      onClick={(e) => {
        if ((e.target as HTMLElement).id === "fullscreenOverlay") close();
      }}
    >
      <div id="stage">
        <div
          className={`book-cover${
            phase !== "init" ? " show" : ""
          }${phase === "opening" || phase === "flipping" || phase === "ready" ? " opening" : ""}`}
          style={{ background: book.fill }}
        >
          <div className="cover-frame">
            <div className="cover-title">{book.title}</div>
            <div className="cover-tags">{bookTagText}</div>
          </div>
        </div>
        <div
          className={`pages-spread${
            phase === "opening" || phase === "flipping" || phase === "ready" ? " show" : ""
          }${phase === "ready" ? " content-ready" : ""}`}
        >

          {leftPage}
          {rightPage}
          {/* ペラペラめくれる装飾ページ(実データの断片入り) */}
          {Array.from({ length: 8 }).map((_, i) => {
            const z = i < 4 ? 14 - i : 1;
            const e1 = entries.length ? entries[i % entries.length] : null;
            const e2 = entries.length > 1 ? entries[(i + 1) % entries.length] : null;
            return (
              <div
                key={i}
                className={`flip-page${i < flippedCount ? " flipped" : ""}`}
                style={{ zIndex: z }}
                aria-hidden="true"
              >
                {e1 && (
                  <div className="flip-frag">
                    <span className="f-date">{e1.date}</span>　
                    {(e1.body || e1.title).slice(0, 34)}…
                  </div>
                )}
                {e2 && e2 !== e1 && (
                  <div className="flip-frag" style={{ marginTop: 64 }}>
                    {(e2.body || e2.title).slice(0, 30)}…
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {phase === "ready" && !closing && (
        <button className="plain close-btn" type="button" style={{ display: "inline-flex" }} onClick={close}>
          ↩ 本棚に戻す
        </button>
      )}
      
      {settingsOpen && (
        <div id="sharedAccessModal" className="open" onClick={(e) => {
          if ((e.target as HTMLElement).id === "sharedAccessModal") setSettingsOpen(false);
        }}>
          <div className="cal-box shared-access-box">
            <button className="plain cal-close" type="button" onClick={() => setSettingsOpen(false)}>
              ✕ 閉じる
            </button>
            <h2>本の設定</h2>
            <div className="label">表紙の色</div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "24px" }}>
              {["#1f4f68", "#54432b", "#422a54", "#25413c", "#5a1730", "#38423b", "#4a3b32", "#2d3748"].map(c => (
                <button
                  key={c}
                  type="button"
                  style={{
                    width: 32, height: 32, borderRadius: "50%", background: c,
                    border: editColor === c ? "2px solid #fff" : "none",
                    outline: editColor === c ? "2px solid #3b82f6" : "none"
                  }}
                  onClick={() => setEditColor(c)}
                />
              ))}
            </div>
            <div style={{ display: "flex", gap: "12px", marginBottom: "32px" }}>
              <button className="plain dark" type="button" onClick={async () => {
                await props.onUpdateColor(book.id, editColor);
                setSettingsOpen(false);
              }}>
                色を保存する
              </button>
            </div>
            
            <hr style={{ borderColor: "rgba(255,255,255,0.1)", marginBottom: "24px" }} />

            {deletable ? (
              <>
                <h2>本を焼却炉へ...？（本を削除する）</h2>
                <div style={{ display: "flex", gap: "12px", flexDirection: "column" }}>
                  <p style={{ fontSize: "12px", color: "#9ca3af", margin: 0 }}>
                    ※一度灰になった本は、もう二度と元には戻せません。
                  </p>
                  <button 
                    className="plain" 
                    type="button" 
                    style={{ color: "#ef4444", alignSelf: "flex-start" }}
                    onClick={() => setConfirmDeleteModalOpen(true)}
                  >
                    {isDeleting ? "削除中..." : "この本を削除する"}
                  </button>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", gap: "12px", flexDirection: "column" }}>
                <h2>本の削除はできません</h2>
                <p style={{ fontSize: "12px", color: "#9ca3af", margin: 0 }}>
                  わたしの書架は削除不可です。内容を残したまま使い続ける前提になっています。
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {confirmDeleteModalOpen && (
        <div id="sharedAccessModal" className="open" onClick={(e) => {
          if ((e.target as HTMLElement).id === "sharedAccessModal") setConfirmDeleteModalOpen(false);
        }}>
          <div className="cal-box shared-access-box">
            <button className="plain cal-close" type="button" onClick={() => setConfirmDeleteModalOpen(false)}>
              ✕ 閉じる
            </button>
            
            <h2>本を焼却炉へ...？（削除の確認）</h2>
            <div style={{ display: "flex", gap: "12px", flexDirection: "column" }}>
              <p style={{ fontSize: "14px", color: "var(--ink)", margin: 0 }}>
                本当にこの本を焼却しますか？
              </p>
              <p style={{ fontSize: "12px", color: "#9ca3af", margin: 0 }}>
                ※一度灰になった本は、もう二度と元には戻せません。<br/>
                ※記録されているデータも全て失われます。
              </p>
              <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
                <button 
                  className="plain" 
                  type="button" 
                  style={{ color: "#ef4444" }}
                  disabled={isDeleting}
                  onClick={async () => {
                    setIsDeleting(true);
                    await props.onDeleteBook(book.id);
                  }}
                >
                  {isDeleting ? "削除中..." : "削除する"}
                </button>
                <button 
                  className="plain dark" 
                  type="button" 
                  onClick={() => setConfirmDeleteModalOpen(false)}
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
