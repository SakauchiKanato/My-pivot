import { useMemo, useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import type { Book, Shelf } from "../lib/api";
import { SharedAccessModal } from "./SharedAccessModal";
import { CreateBookModal } from "./CreateBookModal";
import { KarakuriShelf, type KarakuriShelfHandle, pageOfIndex, SHELF_CAPACITY } from "./shelf/KarakuriShelf";
import { flags } from "../config/flags";

const SHELF_LABEL: Record<Shelf, string> = {
  mine: "わたしの書架",
  shared: "共同の書架",
  senpai: "先達の書架",
};
const CASE_NOTES: Record<Shelf, JSX.Element> = {
  mine: (
    <>
      <em>非公開。</em>ここに綴じた記録は、あなたにしか読めません。
    </>
  ),
  shared: (
    <>
      <em>共同。</em>選んだ仲間とだけ、迷いを共有します。
    </>
  ),
  senpai: (
    <>
      <em>先達の記録。</em>読み専用。決定当時の生データが綴じられています。
    </>
  ),
};

function bookTags(book: Book): string[] {
  const tags: string[] = [];
  book.entries.forEach((e) => e.tags.forEach((t) => !tags.includes(t) && tags.push(t)));
  return tags;
}
function bookText(book: Book): string {
  let txt = book.title;
  book.entries.forEach((e) => {
    txt += " " + e.title + " " + e.tags.join(" ") + " " + (e.body || "");
  });
  return txt.toLowerCase();
}

// カテゴリの表示順(tag_mapper.TAG_RULES と対応)。「その他」は最後
const CATEGORY_ORDER = ["感情", "意思決定", "研究", "学習", "人間関係", "成長", "その他"];

interface Props {
  books: Book[];
  // タグ名→カテゴリ(バックエンドのLLM分類結果)。チップの折りたたみに使う
  tagCategories: Record<string, string>;
  onOpenBook: (book: Book) => void;
  onCreateBook: (shelf: Shelf, title: string) => Promise<number | null | void>;
  onCreateSharedBook: (title: string, passcode: string) => Promise<number | null | void>;
  onJoinShared: (passcode: string) => Promise<number | null | void>;
  overlayOpen: boolean;
}

export function Bookcase({
  books,
  tagCategories,
  onOpenBook,
  onCreateBook,
  onCreateSharedBook,
  onJoinShared,
  overlayOpen,
}: Props) {
  const [query, setQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [openCats, setOpenCats] = useState<string[]>([]);
  const [sharedModalOpen, setSharedModalOpen] = useState(false);
  const [mineModalOpen, setMineModalOpen] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [pendingJumpBookId, setPendingJumpBookId] = useState<number | null>(null);
  const mineShelfRef = useRef<KarakuriShelfHandle>(null);
  const sharedShelfRef = useRef<KarakuriShelfHandle>(null);
  const senpaiShelfRef = useRef<KarakuriShelfHandle>(null);

  const shelfRefs: Record<Shelf, React.RefObject<KarakuriShelfHandle>> = {
    mine: mineShelfRef,
    shared: sharedShelfRef,
    senpai: senpaiShelfRef,
  };

  // 追加フィルター
  const [filterShelves, setFilterShelves] = useState<Shelf[]>([]);
  const [filterOutcomes, setFilterOutcomes] = useState<string[]>([]);
  const [filterJudgments, setFilterJudgments] = useState<string[]>([]);
  const [filterConfidences, setFilterConfidences] = useState<string[]>([]);

  // パフォーマンス最適化：本のテキストとタグを事前に計算してキャッシュ
  const bookCache = useMemo(() => {
    const cache = new Map<number, { tags: string[], text: string }>();
    books.forEach(b => {
      cache.set(b.id, { tags: bookTags(b), text: bookText(b) });
    });
    return cache;
  }, [books]);

  const booksByShelf = useMemo(() => {
    return {
      mine: books.filter((book) => book.shelf === "mine"),
      shared: books.filter((book) => book.shelf === "shared"),
      senpai: books.filter((book) => book.shelf === "senpai"),
    };
  }, [books]);

  const allTags = useMemo(() => {
    const tags: string[] = [];
    books.forEach((b) => {
      const bTags = bookCache.get(b.id)?.tags || [];
      bTags.forEach((t) => !tags.includes(t) && tags.push(t));
    });
    return tags.sort();
  }, [books, bookCache]);

  // タグをカテゴリ単位でまとめる。タグ名(ユーザーの言葉)は書き換えない
  const groupedTags = useMemo(() => {
    const groups = new Map<string, string[]>();
    allTags.forEach((tag) => {
      const cat = tagCategories[tag] ?? "その他";
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(tag);
    });
    return [...groups.entries()]
      .map(([category, tags]) => ({ category, tags }))
      .sort((a, b) => {
        const ia = CATEGORY_ORDER.indexOf(a.category);
        const ib = CATEGORY_ORDER.indexOf(b.category);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });
  }, [allTags, tagCategories]);

  const hasFilter = 
    selectedTags.length > 0 || 
    query.trim().length > 0 ||
    filterShelves.length > 0 ||
    filterOutcomes.length > 0 ||
    filterJudgments.length > 0 ||
    filterConfidences.length > 0;

  const matches = (book: Book) => {
    const cached = bookCache.get(book.id);
    const tags = cached?.tags || [];
    const tagOk = selectedTags.length === 0 || selectedTags.every((t) => tags.includes(t));
    const q = query.trim().toLowerCase();
    const wordOk = !q || (cached?.text || "").includes(q);
    
    const shelfOk = filterShelves.length === 0 || filterShelves.includes(book.shelf);

    let entryOk = true;
    if (filterOutcomes.length > 0 || filterJudgments.length > 0 || filterConfidences.length > 0) {
      // 指定された条件のいずれかを持つエントリが含まれていればOK（本全体が表示される）
      entryOk = book.entries.some(e => {
        const outOk = filterOutcomes.length === 0 || filterOutcomes.includes(e.outcome || "pending");
        const judOk = filterJudgments.length === 0 || filterJudgments.includes(e.judgment || "none");
        let confOk = filterConfidences.length === 0;
        if (!confOk) {
          const conf = e.confidence || 3;
          if (filterConfidences.includes("high") && conf >= 4) confOk = true;
          if (filterConfidences.includes("mid") && conf === 3) confOk = true;
          if (filterConfidences.includes("low") && conf <= 2) confOk = true;
        }
        return outOk && judOk && confOk;
      });
    }

    return tagOk && wordOk && shelfOk && entryOk;
  };

  const hits = hasFilter ? books.filter(matches) : [];

  const flashBook = (bookId: number) => {
    const el = document.querySelector(`[data-book-id="${bookId}"]`);
    if (!el) return;
    el.classList.remove("kk-flash");
    void (el as HTMLElement).offsetWidth;
    el.classList.add("kk-flash");
  };
  
  useEffect(() => {
    if (pendingJumpBookId && flags.shelfPagination) {
      const book = books.find((b) => b.id === pendingJumpBookId);
      if (book) {
        const shelfBooks = books.filter(b => b.shelf === book.shelf);
        const shelfIndex = shelfBooks.findIndex((candidate) => candidate.id === book.id);
        if (shelfIndex >= 0) {
          const targetPage = pageOfIndex(shelfIndex, SHELF_CAPACITY);
          shelfRefs[book.shelf].current?.jumpToPage(targetPage, () => flashBook(book.id));
        }
        setPendingJumpBookId(null);
      }
    }
  }, [books, pendingJumpBookId]);

  const jumpToBook = (book: Book) => {
    if (!flags.shelfPagination) {
      onOpenBook(book);
      return;
    }

    const shelfBooks = booksByShelf[book.shelf];
    const shelfIndex = shelfBooks.findIndex((candidate) => candidate.id === book.id);
    if (shelfIndex < 0) {
      onOpenBook(book);
      return;
    }

    const targetPage = pageOfIndex(shelfIndex, SHELF_CAPACITY);
    shelfRefs[book.shelf].current?.jumpToPage(targetPage, () => flashBook(book.id));
  };

  const spine = (book: Book, dim: boolean, onClick: () => void = () => onOpenBook(book)) => (
    <button
      key={book.id}
      className={`book-spine${dim ? " dim" : ""}`}
      data-book-id={book.id}
      type="button"
      style={{ height: book.height, background: book.fill }}
      onClick={onClick}
    >
      {book.title}
      <span className={`ribbon ${book.shelf}`} />
    </button>
  );

  const newBookButton = (shelf: Shelf) => (
    <button
      className="book-spine newbook"
      type="button"
      style={{ height: 150 }}
      onClick={() => {
        if (shelf === "shared") {
          setSharedModalOpen(true);
          return;
        }
        if (shelf === "mine") {
          setMineModalOpen(true);
          return;
        }
      }}
    >
      ＋ 新しい本
    </button>
  );

  return (
    <>
      <section className={`search-panel${overlayOpen ? " hidden" : ""}`}>
        <div className="search-top">
          <label className="searchbox">
            <span>⌕</span>
            <input
              type="search"
              placeholder="フリーワード検索: タイトル・タグ・本文から探す(3つの棚を横断)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button
            className="plain"
            type="button"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          >
            {showAdvancedFilters ? "▲ 閉じる" : "▼ 詳細条件"}
          </button>
          <button
            className="plain"
            type="button"
            onClick={() => {
              setSelectedTags([]);
              setQuery("");
              setFilterShelves([]);
              setFilterOutcomes([]);
              setFilterJudgments([]);
              setFilterConfidences([]);
              setShowAdvancedFilters(false);
            }}
          >
            リセット
          </button>
        </div>

        {showAdvancedFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div className="filter-scroll">
              <div className="filter-group">
                <span className="filter-label">書庫</span>
                <div className="filter-chips">
                  {(["mine", "shared", "senpai"] as Shelf[]).map(s => (
                    <button
                      key={s}
                      type="button"
                      className={`chip ${filterShelves.includes(s) ? "active" : ""}`}
                      onClick={() => setFilterShelves(cur => cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s])}
                    >
                      {SHELF_LABEL[s].replace("の書架", "")}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="filter-group">
                <span className="filter-label">決断の結果</span>
                <div className="filter-chips">
                  <button
                    type="button"
                    className={`chip ${filterOutcomes.includes("ok") ? "active" : ""}`}
                    onClick={() => setFilterOutcomes(cur => cur.includes("ok") ? cur.filter(x => x !== "ok") : [...cur, "ok"])}
                  >うまくいった</button>
                  <button
                    type="button"
                    className={`chip ${filterOutcomes.includes("ng") ? "active" : ""}`}
                    onClick={() => setFilterOutcomes(cur => cur.includes("ng") ? cur.filter(x => x !== "ng") : [...cur, "ng"])}
                  >後悔が残る</button>
                  <button
                    type="button"
                    className={`chip ${filterOutcomes.includes("pending") ? "active" : ""}`}
                    onClick={() => setFilterOutcomes(cur => cur.includes("pending") ? cur.filter(x => x !== "pending") : [...cur, "pending"])}
                  >結果待ち</button>
                </div>
              </div>

              <div className="filter-group">
                <span className="filter-label">当時の自信</span>
                <div className="filter-chips">
                  <button
                    type="button"
                    className={`chip ${filterConfidences.includes("high") ? "active" : ""}`}
                    onClick={() => setFilterConfidences(cur => cur.includes("high") ? cur.filter(x => x !== "high") : [...cur, "high"])}
                  >自信あり(★4-5)</button>
                  <button
                    type="button"
                    className={`chip ${filterConfidences.includes("low") ? "active" : ""}`}
                    onClick={() => setFilterConfidences(cur => cur.includes("low") ? cur.filter(x => x !== "low") : [...cur, "low"])}
                  >自信なし(★1-2)</button>
                </div>
              </div>

              <div className="filter-group">
                <span className="filter-label">判断</span>
                <div className="filter-chips">
                  <button
                    type="button"
                    className={`chip ${filterJudgments.includes("sound") ? "active" : ""}`}
                    onClick={() => setFilterJudgments(cur => cur.includes("sound") ? cur.filter(x => x !== "sound") : [...cur, "sound"])}
                  >妥当</button>
                  <button
                    type="button"
                    className={`chip ${filterJudgments.includes("flawed") ? "active" : ""}`}
                    onClick={() => setFilterJudgments(cur => cur.includes("flawed") ? cur.filter(x => x !== "flawed") : [...cur, "flawed"])}
                  >悔いあり</button>
                </div>
              </div>
            </div>

            <div className="tag-filters">
              <span className="filter-label">タグで絞り込む</span>
              <div className="chips">
                {groupedTags.map(({ category, tags }) => {
                  const selectedN = tags.filter((t) => selectedTags.includes(t)).length;
                  const isOpen = openCats.includes(category) || selectedN > 0;
                  return (
                    <div className="chip-group" key={category}>
                      <button
                        type="button"
                        className={`chip cat${selectedN > 0 ? " active" : ""}`}
                        onClick={() =>
                          setOpenCats((cur) =>
                            cur.includes(category)
                              ? cur.filter((c) => c !== category)
                              : [...cur, category]
                          )
                        }
                      >
                        {isOpen ? "▾" : "▸"} {category}
                        <span className="cat-n">{selectedN > 0 ? `${selectedN}/${tags.length}` : tags.length}</span>
                      </button>
                      {isOpen &&
                        tags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            className={`chip${selectedTags.includes(tag) ? " active" : ""}`}
                            onClick={() =>
                              setSelectedTags((cur) =>
                                cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag]
                              )
                            }
                          >
                            #{tag}
                          </button>
                        ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </section>

      <section id="bookcaseWrap" className={overlayOpen ? "hidden" : ""}>
        <div id="normalShelfView" className={hasFilter ? "hidden" : ""}>
          <div className="bookcase-container">
            {(["mine", "shared", "senpai"] as Shelf[]).map((shelfKey) => {
              const booksHere = booksByShelf[shelfKey];
              const ROW_CAPACITY = 8;
              if (!flags.shelfPagination) {
                const rows: JSX.Element[][] = [[], [], []];
                let rowIndex = 0;
                booksHere.forEach((b) => {
                  if (rows[rowIndex].length >= ROW_CAPACITY && rowIndex < 2) rowIndex++;
                  rows[rowIndex].push(spine(b, hasFilter && !matches(b)));
                });
                if (shelfKey !== "senpai") {
                  rows[Math.min(Math.floor(booksHere.length / ROW_CAPACITY), 2)].push(
                    <span key="new">{newBookButton(shelfKey)}</span>
                  );
                }
                return (
                  <div className="bookcase-col" key={shelfKey}>
                    <div className="case-caption">
                      <b>{SHELF_LABEL[shelfKey]}</b>
                      <p className={`case-note ${shelfKey}`}>{CASE_NOTES[shelfKey]}</p>
                    </div>
                    <div className="bookcase">
                      {rows.map((row, r) => (
                        <div key={r}>
                          <div className="shelf">{row}</div>
                          <div className="shelf-board" />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
              return (
                <KarakuriShelf
                  key={shelfKey}
                  ref={shelfRefs[shelfKey]}
                  books={booksHere}
                  enabled={flags.shelfPagination}
                  hasAddSlot={shelfKey !== "senpai"}
                  title={SHELF_LABEL[shelfKey]}
                  note={CASE_NOTES[shelfKey]}
                  className="bookcase-col"
                  renderPage={(pageBooks, _pageIndex, isLastPage) => (
                    (() => {
                      const rows: JSX.Element[][] = [[], [], []];
                      let rowIndex = 0;
                      pageBooks.forEach((book) => {
                        if (rows[rowIndex].length >= ROW_CAPACITY && rowIndex < 2) rowIndex += 1;
                        const dim = hasFilter && !matches(book);
                        rows[rowIndex].push(spine(book, dim));
                      });
                      if (isLastPage && shelfKey !== "senpai") {
                        rows[Math.min(Math.floor(pageBooks.length / ROW_CAPACITY), 2)].push(
                          <span key="new">{newBookButton(shelfKey)}</span>
                        );
                      }
                      return (
                        <>
                          {rows.map((row, r) => (
                            <div key={r}>
                              <div className="shelf">{row}</div>
                              <div className="shelf-board" />
                            </div>
                          ))}
                        </>
                      );
                    })()
                  )}
                />
              );
            })}
          </div>
        </div>

        <div
          id="hitShelfContainer"
          className={hasFilter ? "active" : ""}
          style={{ display: hasFilter ? "block" : "none" }}
        >
          <p className="shelf-title">見つかった本(出自は帯の色)</p>
          <div className="legend">
            <span className="l-mine">
              <i />
              わたし
            </span>
            <span className="l-shared">
              <i />
              共同
            </span>
            <span className="l-senpai">
              <i />
              先達
            </span>
          </div>
          {Array.from({ length: Math.max(1, Math.ceil(hits.length / 24)) }).map((_, bookcaseIndex) => {
            const bookcaseHits = hits.slice(bookcaseIndex * 24, (bookcaseIndex + 1) * 24);
            return (
              <div key={bookcaseIndex} className="bookcase" style={{ marginBottom: 40 }}>
                {Array.from({ length: 3 }).map((_, r) => (
                  <div key={r}>
                    <div className="shelf">
                      {bookcaseHits.slice(r * 8, (r + 1) * 8).map((b) => spine(b, false, () => onOpenBook(b)))}
                    </div>
                    <div className="shelf-board" />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </section>

      {sharedModalOpen && (
        <SharedAccessModal
          onClose={() => setSharedModalOpen(false)}
          onCreate={async (t, p) => {
            const id = await onCreateSharedBook(t, p);
            if (id) setPendingJumpBookId(id);
          }}
          onJoin={async (p) => {
            const id = await onJoinShared(p);
            if (id) setPendingJumpBookId(id);
          }}
        />
      )}

      {mineModalOpen && (
        <CreateBookModal
          shelf="mine"
          onClose={() => setMineModalOpen(false)}
          onCreate={async (t) => {
            const id = await onCreateBook("mine", t);
            if (id) setPendingJumpBookId(id);
          }}
        />
      )}
    </>
  );
}
