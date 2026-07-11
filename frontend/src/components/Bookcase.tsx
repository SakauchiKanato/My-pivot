import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { Book, Shelf } from "../lib/api";
import { SharedAccessModal } from "./SharedAccessModal";

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
  onDeleteBooks: (ids: number[]) => Promise<void>;
  overlayOpen: boolean;
}

export function Bookcase({
  books,
  tagCategories,
  onOpenBook,
  onCreateBook,
  onCreateSharedBook,
  onJoinShared,
  onDeleteBooks,
  overlayOpen,
}: Props) {
  const canDeleteBook = (book: Book) => book.shelf !== "mine";
  const [query, setQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [openCats, setOpenCats] = useState<string[]>([]);
  const [sharedModalOpen, setSharedModalOpen] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [pendingJumpBookId, setPendingJumpBookId] = useState<number | null>(null);
  const [hitPage, setHitPage] = useState(0);
  const [declutterMode, setDeclutterMode] = useState(false);
  const [selectedBookIds, setSelectedBookIds] = useState<Set<number>>(new Set());
  const [confirmDeleteModalOpen, setConfirmDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const mineShelfRef = useRef<KarakuriShelfHandle>(null);
  const sharedShelfRef = useRef<KarakuriShelfHandle>(null);
  const senpaiShelfRef = useRef<KarakuriShelfHandle>(null);
  const hitScrollContainerRef = useRef<HTMLDivElement>(null);

  // 隠しコマンド(追加分): 検索欄に "##xxx" と打ってスペースを押すと発動する
  const [secretEffect, setSecretEffect] = useState<SecretEffect | null>(null);
  const [secretPhrase, setSecretPhrase] = useState<string>("");

  // 隠しコマンド(追加分): 検索欄に "##xxx" と打ってスペースを押すと発動する
  const [secretEffect, setSecretEffect] = useState<SecretEffect | null>(null);
  const [secretPhrase, setSecretPhrase] = useState<string>("");

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

  const hitBookcaseCount = Math.max(1, Math.ceil(hits.length / 24));
  const showCarouselButtons = hitBookcaseCount > 1;

  const handleHitScroll = () => {
    if (!hitScrollContainerRef.current) return;
    const scrollLeft = hitScrollContainerRef.current.scrollLeft;
    const itemWidth = 345 + 60; // bookcase width + gap
    const newPage = Math.round(scrollLeft / itemWidth);
    if (newPage !== hitPage) {
      setHitPage(newPage);
    }
  };

  const scrollHits = (targetPage: number) => {
    if (targetPage < 0 || targetPage >= hitBookcaseCount) return;
    if (hitScrollContainerRef.current) {
      const itemWidth = 345 + 60;
      hitScrollContainerRef.current.scrollTo({
        left: targetPage * itemWidth,
        behavior: "smooth",
      });
      setHitPage(targetPage);
    }
  };

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

  const spine = (book: Book, dim: boolean, onClick: () => void = () => onOpenBook(book)) => {
    const isSelected = declutterMode && selectedBookIds.has(book.id);
    return (
      <button
        key={book.id}
        className={`book-spine${dim ? " dim" : ""}`}
        data-book-id={book.id}
        type="button"
        style={{ 
          height: book.height, 
          background: book.fill,
          outline: isSelected ? "3px solid #ff4d4f" : "none",
          transform: isSelected ? "translateY(-10px)" : undefined,
          opacity: declutterMode && !isSelected ? 0.6 : 1,
          transition: "transform 0.2s, opacity 0.2s, outline 0.2s"
        }}
        onClick={() => {
          if (declutterMode) {
            if (!canDeleteBook(book)) return;
            setSelectedBookIds((prev) => {
              const next = new Set(prev);
              if (next.has(book.id)) next.delete(book.id);
              else next.add(book.id);
              return next;
            });
          } else {
            onClick();
          }
        }}
      >
        {book.title}
        <span className={`ribbon ${book.shelf}`} />
      </button>
    );
  };

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
        const title = prompt("新しい本のタイトル(例: 就活の記録)");
        if (title && title.trim()) onCreateBook(shelf, title.trim());
      }}
    >
      ＋ 新しい本
    </button>
  );

  const deletableSelectedIds = Array.from(selectedBookIds).filter((id) => {
    const book = books.find((candidate) => candidate.id === id);
    return book ? canDeleteBook(book) : false;
  });

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
              onKeyDown={(e) => {
                // 隠しコマンド: "##xxx" と打ってスペースを押すと発動する。
                // 通常の検索ワードにスペースを使いたい場合もあるので、
                // 一致したときだけ発動させ、それ以外は普通に空白として入力させる。
                if (e.key === " ") {
                  const typed = query.trim().toLowerCase();
                  const hit = SECRET_COMMANDS.find((c) => c.pattern === typed);
                  if (hit) {
                    e.preventDefault();
                    if (hit.effect === "silence") {
                      const saved = window.localStorage.getItem("shoko-secret-phrase");
                      if (saved) {
                        setSecretPhrase(saved);
                      } else {
                        const input = window.prompt("画面に浮かべる、あなただけの言葉を決めてください。") ?? "";
                        const phrase = input.trim();
                        if (!phrase) return; // 何も入力されなければ発動しない
                        window.localStorage.setItem("shoko-secret-phrase", phrase);
                        setSecretPhrase(phrase);
                      }
                    }
                    setSecretEffect(hit.effect);
                    setQuery("");
                  }
                }
              }}
            />
          </label>
          <button
            className="plain"
            type="button"
            onClick={() => {
              setDeclutterMode(!declutterMode);
              if (declutterMode) setSelectedBookIds(new Set());
            }}
          >
            {declutterMode ? "やめる" : "🧹 断捨離モード"}
          </button>
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

      {declutterMode && deletableSelectedIds.length > 0 && (
        <div style={{
          position: "fixed",
          bottom: "32px",
          left: "50%",
          transform: "translateX(-50%)",
          background: "var(--paper)",
          boxShadow: "var(--shadow)",
          padding: "16px 24px",
          borderRadius: "32px",
          display: "flex",
          alignItems: "center",
          gap: "24px",
          zIndex: 1000,
          border: "1px solid var(--line)"
        }}>
          <span style={{ fontWeight: "bold", color: "var(--ink)" }}>{deletableSelectedIds.length} 冊を削除対象として選択中</span>
          <button
            className="btn"
            style={{ background: "#ff4d4f", color: "white", padding: "8px 16px" }}
            onClick={() => setConfirmDeleteModalOpen(true)}
          >
            一括削除する
          </button>
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
            
            <h2>本を焼却炉へ...？（一括削除）</h2>
            <div style={{ display: "flex", gap: "12px", flexDirection: "column" }}>
              <p style={{ fontSize: "14px", color: "var(--ink)", margin: 0 }}>
                選択した {selectedBookIds.size} 冊の本を本当に焼却しますか？
              </p>
              <p style={{ fontSize: "12px", color: "#9ca3af", margin: 0 }}>
                ※一度灰になった本は、もう二度と元には戻せません。
              </p>
              <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
                <button 
                  className="plain" 
                  type="button" 
                  style={{ color: "#ef4444" }}
                  disabled={isDeleting}
                  onClick={async () => {
                    setIsDeleting(true);
                    await onDeleteBooks(deletableSelectedIds);
                    setIsDeleting(false);
                    setSelectedBookIds(new Set());
                    setDeclutterMode(false);
                    setConfirmDeleteModalOpen(false);
                  }}
                >
                  {isDeleting ? "削除中..." : "一括削除する"}
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

      <section id="bookcaseWrap" className={overlayOpen ? "hidden" : ""}>
        <div id="normalShelfView" className={hasFilter ? "hidden" : ""}>
          <div className="bookcase-container">
            {(["mine", "shared", "senpai"] as Shelf[]).map((shelfKey) => {
              const booksHere = books.filter((b) => b.shelf === shelfKey);
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
            })}
          </div>
        </div>

        <div
          id="hitShelfContainer"
          className={hasFilter ? "active" : ""}
          style={{ display: hasFilter ? "block" : "none" }}
        >
          <div className="kk-head" style={{ marginTop: "20px", marginBottom: "16px" }}>
            {showCarouselButtons ? (
              <>
                <button
                  type="button"
                  className={`kk-tri ${hitPage === 0 ? "kk-tri--off" : ""}`}
                  onClick={() => scrollHits(hitPage - 1)}
                >
                  ◀
                </button>
                <h2 className="kk-title" style={{ fontSize: "16px", margin: "0 16px" }}>見つかった本(出自は帯の色)</h2>
                <button
                  type="button"
                  className={`kk-tri ${hitPage === hitBookcaseCount - 1 ? "kk-tri--off" : ""}`}
                  onClick={() => scrollHits(hitPage + 1)}
                >
                  ▶
                </button>
                <span className="kk-pageno" style={{ marginLeft: "12px" }}>{hitPage + 1} / {hitBookcaseCount}</span>
              </>
            ) : (
              <h2 className="kk-title" style={{ fontSize: "16px" }}>見つかった本(出自は帯の色)</h2>
            )}
          </div>

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
          <div style={{ position: "relative" }}>
            <div 
              ref={hitScrollContainerRef}
              onScroll={handleHitScroll}
              style={{ display: "flex", gap: "60px", overflowX: "auto", paddingBottom: "20px", scrollBehavior: "smooth", scrollSnapType: "x mandatory" }}
            >
              {Array.from({ length: hitBookcaseCount }).map((_, bookcaseIndex) => {
                const bookcaseHits = hits.slice(bookcaseIndex * 24, (bookcaseIndex + 1) * 24);
                return (
                  <div key={bookcaseIndex} className="bookcase" style={{ flexShrink: 0, width: "345px", scrollSnapAlign: "start" }}>
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
          </div>
        </div>
      </section>

      {sharedModalOpen && (
        <SharedAccessModal
          onClose={() => setSharedModalOpen(false)}
          onCreate={onCreateSharedBook}
          onJoin={onJoinShared}
        />
      )}

      {secretEffect && (
        <SecretEffectOverlay
          effect={secretEffect}
          phrase={secretPhrase}
          onDone={() => setSecretEffect(null)}
        />
      )}
    </>
  );
}

// ====================================================================
// 隠しコマンド(追加分)
// 検索欄に "##season" "##candle" "##ink" "##paper" "##silence" のいずれか
// を打ってスペースキーを押すと発動する。
// ====================================================================

type SecretEffect = "season" | "sakura" | "candle" | "ink" | "paper" | "silence";

const SECRET_COMMANDS: { pattern: string; effect: SecretEffect }[] = [
  { pattern: "##season", effect: "season" },
  { pattern: "##sakura", effect: "sakura" },
  { pattern: "##candle", effect: "candle" },
  { pattern: "##ink", effect: "ink" },
  { pattern: "##paper", effect: "paper" },
  { pattern: "##silence", effect: "silence" },
];

type Season = "spring" | "summer" | "autumn" | "winter";

function getSeason(date: Date = new Date()): Season {
  const m = date.getMonth() + 1; // 1-12
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  if (m >= 9 && m <= 11) return "autumn";
  return "winter";
}

const SEASON_PARTICLE: Record<Season, { glyph: string; count: number; duration: [number, number] }> = {
  spring: { glyph: "🌸", count: 24, duration: [6, 10] },
  summer: { glyph: "✦", count: 18, duration: [4, 7] },
  autumn: { glyph: "🍁", count: 20, duration: [6, 10] },
  winter: { glyph: "❄", count: 26, duration: [5, 9] },
};

function SecretEffectOverlay({
  effect,
  phrase,
  onDone,
}: {
  effect: SecretEffect;
  phrase: string;
  onDone: () => void;
}) {
  // silence 以外は数秒で自動的に消える。silence はクリック/Escで閉じる。
  useEffect(() => {
    if (effect === "silence") return;
    const t = window.setTimeout(onDone, 6000);
    return () => window.clearTimeout(t);
  }, [effect, onDone]);

  useEffect(() => {
    if (effect !== "silence") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDone();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [effect, onDone]);

  return (
    <div
      className={`secret-overlay secret-${effect}`}
      onClick={() => effect === "silence" && onDone()}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        pointerEvents: effect === "silence" ? "auto" : "none",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes secretFall {
          0%   { transform: translateY(-10vh) rotate(0deg); opacity: 0; }
          10%  { opacity: 1; }
          100% { transform: translateY(110vh) rotate(360deg); opacity: 0.9; }
        }
        @keyframes secretFlicker {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 0.8; }
        }
        @keyframes secretInkGrow {
          0%   { transform: scale(0); opacity: 0.9; }
          100% { transform: scale(1); opacity: 0.35; }
        }
        @keyframes secretFadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
      `}</style>

      {(effect === "season" || effect === "sakura") &&
        (() => {
          // ##sakura は季節判定を無視して、常に桜(spring)のパーティクルを使う
          const season: Season = effect === "sakura" ? "spring" : getSeason();
          const { glyph, count, duration } = SEASON_PARTICLE[season];
          return Array.from({ length: count }).map((_, i) => {
            const left = Math.random() * 100;
            const dur = duration[0] + Math.random() * (duration[1] - duration[0]);
            const delay = Math.random() * 3;
            const size = 14 + Math.random() * 14;
            return (
              <span
                key={i}
                style={{
                  position: "absolute",
                  top: 0,
                  left: `${left}vw`,
                  fontSize: size,
                  animation: `secretFall ${dur}s linear ${delay}s infinite`,
                  filter: season === "summer" ? "drop-shadow(0 0 6px #ffe98a)" : undefined,
                  color: season === "summer" ? "#ffe98a" : undefined,
                }}
              >
                {glyph}
              </span>
            );
          });
        })()}

      {effect === "candle" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 50% 45%, rgba(255,180,90,0.28), rgba(20,12,4,0.55) 70%)",
            animation: "secretFlicker 2.4s ease-in-out infinite",
          }}
        />
      )}

      {effect === "ink" && (
        <div
          style={{
            position: "absolute",
            top: "-20vh",
            right: "-20vw",
            width: "80vh",
            height: "80vh",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(20,20,30,0.85), rgba(20,20,30,0) 70%)",
            animation: "secretInkGrow 2.6s ease-out forwards",
          }}
        />
      )}

      {effect === "paper" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(160deg, rgba(210,180,130,0.35), rgba(120,90,50,0.25)), " +
              "radial-gradient(circle at 20% 30%, rgba(90,60,20,0.15), transparent 40%), " +
              "radial-gradient(circle at 80% 70%, rgba(90,60,20,0.15), transparent 45%)",
            mixBlendMode: "multiply",
            animation: "secretFadeIn 1.4s ease-out",
          }}
        />
      )}

      {effect === "silence" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#f6f2ea",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 40,
            textAlign: "center",
            animation: "secretFadeIn 1.2s ease-out",
          }}
        >
          <p
            style={{
              fontSize: "clamp(18px, 3vw, 32px)",
              letterSpacing: 1.2,
              color: "#2b2620",
              maxWidth: 640,
              lineHeight: 1.8,
            }}
          >
            {phrase}
          </p>
        </div>
      )}
    </div>
  );
}