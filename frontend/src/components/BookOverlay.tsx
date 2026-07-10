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
 */
import { useEffect, useMemo, useState } from "react";
import type { Book, Entry } from "../lib/api";
import type { ServerFlags } from "../config/flags";
import { FLAGS } from "../config/flags";
<<<<<<< HEAD
import { Badges } from "../components/spread/Badges.tsx";
=======
import { Badges } from "./spread/Badges";
>>>>>>> 6cc02f1164c905a7df9f7e8fef79aa49db5d1e89
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
}

export function BookOverlay(props: Props) {
  const { book, onClose } = props;
  const readOnly = book.shelf === "senpai";
  const entries = useMemo(
    () => [...book.entries].sort((a, b) => (a.date < b.date ? -1 : 1)),
    [book.entries]
  );
  const latest = entries.length ? entries[entries.length - 1] : null;

  const [mode, setMode] = useState<Mode>(props.startMode ?? "toc");
  const [innerQuery, setInnerQuery] = useState("");
  const [draft, setDraft] = useState<WriteDraft | null>(null);

  const writeForm = useWriteForm({
    allEntries: props.allEntries,
    books: props.books,
    initialDraft: draft,
    onSave: async (data) => {
      await props.onSaveEntry(data);
      setDraft(null);
    },
  });

<<<<<<< HEAD
=======

>>>>>>> 6cc02f1164c905a7df9f7e8fef79aa49db5d1e89
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

<<<<<<< HEAD
=======
  /* A-1 分岐点: "past_present" 採用時はここを組み替える */
>>>>>>> 6cc02f1164c905a7df9f7e8fef79aa49db5d1e89
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
        <WriteSectionLeft form={writeForm} />
      ) : (
        <>
          <span className={`shelf-badge ${book.shelf}`}>
            {SHELF_LABEL[book.shelf]}
            {readOnly ? " / 読み専用" : book.shelf === "mine" ? " / 非公開" : " / 仲間と共有"}
          </span>
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
        <WriteSectionRight form={writeForm} />
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
<<<<<<< HEAD
=======

>>>>>>> 6cc02f1164c905a7df9f7e8fef79aa49db5d1e89
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
    </section>
  );
}