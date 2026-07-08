import { useMemo, useState } from "react";
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

interface Props {
  books: Book[];
  onOpenBook: (book: Book) => void;
  onCreateBook: (shelf: Shelf, title: string) => void;
  onCreateSharedBook: (title: string, passcode: string) => Promise<void>;
  onJoinShared: (passcode: string) => Promise<void>;
  overlayOpen: boolean;
}

export function Bookcase({
  books,
  onOpenBook,
  onCreateBook,
  onCreateSharedBook,
  onJoinShared,
  overlayOpen,
}: Props) {
  const [query, setQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sharedModalOpen, setSharedModalOpen] = useState(false);

  const allTags = useMemo(() => {
    const tags: string[] = [];
    books.forEach((b) => bookTags(b).forEach((t) => !tags.includes(t) && tags.push(t)));
    return tags.sort();
  }, [books]);

  const hasFilter = selectedTags.length > 0 || query.trim().length > 0;

  const matches = (book: Book) => {
    const tags = bookTags(book);
    const tagOk = selectedTags.every((t) => tags.includes(t));
    const q = query.trim().toLowerCase();
    const wordOk = !q || bookText(book).includes(q);
    return tagOk && wordOk;
  };

  const hits = hasFilter ? books.filter(matches) : [];

  const spine = (book: Book, dim: boolean) => (
    <button
      key={book.id}
      className={`book-spine${dim ? " dim" : ""}`}
      type="button"
      style={{ height: book.height, background: book.fill }}
      onClick={() => onOpenBook(book)}
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
        const title = prompt("新しい本のタイトル(例: 就活の記録)");
        if (title && title.trim()) onCreateBook(shelf, title.trim());
      }}
    >
      ＋ 新しい本
    </button>
  );

  return (
    <>
      <section className={`search-panel${overlayOpen ? " hidden" : ""}`}>
        <label className="searchbox">
          <span>⌕</span>
          <input
            type="search"
            placeholder="フリーワード検索: タイトル・タグ・本文から探す(3つの棚を横断)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div>
          <div className="chips">
            {allTags.map((tag) => (
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
          <button
            className="plain"
            type="button"
            style={{ marginTop: 8 }}
            onClick={() => {
              setSelectedTags([]);
              setQuery("");
            }}
          >
            リセット
          </button>
        </div>
      </section>

      <section id="bookcaseWrap" className={overlayOpen ? "hidden" : ""}>
        <div id="normalShelfView" className={hasFilter ? "hidden" : ""}>
          <div className="bookcase-container">
            {(["mine", "shared", "senpai"] as Shelf[]).map((shelfKey) => {
              const booksHere = books.filter((b) => b.shelf === shelfKey);
              const rows: JSX.Element[][] = [[], [], []];
              booksHere.forEach((b, i) => rows[i % 3].push(spine(b, hasFilter && !matches(b))));
              if (shelfKey !== "senpai") {
                rows[booksHere.length % 3].push(
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
          <div className="bookcase">
            {[0, 1, 2].map((r) => (
              <div key={r}>
                <div className="shelf">
                  {hits.filter((_, i) => i % 3 === r).map((b) => spine(b, false))}
                </div>
                <div className="shelf-board" />
              </div>
            ))}
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
    </>
  );
}
