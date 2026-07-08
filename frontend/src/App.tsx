import { useCallback, useEffect, useState } from "react";
import type { Book, Entry, CalibrationStats, Shelf } from "./lib/api";
import type { ServerFlags } from "./config/flags";
import {
  fetchLibrary,
  fetchDue,
  fetchCalibration,
  createBook,
  createEntry,
  resolveEntry,
  postponeEntry,
  appendEntry,
  withdrawEntry,
  publishEntry,
  joinSharedBook,
} from "./lib/api";
import { getAuthUser, logout, type AuthUser } from "./lib/auth";
import { addMonthsISO, todayISO } from "./lib/dates";
import { LoginPage } from "./components/LoginPage";
import { TopBar } from "./components/TopBar";
import { Bookcase } from "./components/Bookcase";
import { BookOverlay } from "./components/BookOverlay";
import { CalibrationModal } from "./components/CalibrationModal";
import type { WriteDraft } from "./components/spread/WriteSection";

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(getAuthUser());
  const [books, setBooks] = useState<Book[]>([]);
  const [serverFlags, setServerFlags] = useState<ServerFlags | null>(null);
  const [due, setDue] = useState<Entry[]>([]);
  const [stats, setStats] = useState<CalibrationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openBookId, setOpenBookId] = useState<number | null>(null);
  const [startMode, setStartMode] = useState<"toc" | "timeline" | null>(null);
  const [focusEntryId, setFocusEntryId] = useState<number | null>(null);
  const [meterOpen, setMeterOpen] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 3200);
  };

  const reload = useCallback(async () => {
    try {
      setError(null);
      const [lib, dueList, cal] = await Promise.all([
        fetchLibrary(),
        fetchDue(),
        fetchCalibration(),
      ]);
      setBooks(lib.books);
      setServerFlags(lib.flags);
      setDue(dueList);
      setStats(cal);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "401") {
        logout();
        setUser(null);
      } else {
        setError("バックエンドに接続できません。localhost:8000 が起動しているか確認してください。");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) reload();
    else setLoading(false);
  }, [user, reload]);

  if (!user) {
    return (
      <LoginPage
        onSuccess={() => {
          setLoading(true);
          setUser(getAuthUser());
        }}
      />
    );
  }
  if (loading) return <div className="loading-screen">書庫を開いています…</div>;

  const openBook = books.find((b) => b.id === openBookId) ?? null;
  const allEntries = books.flatMap((b) => b.entries);
  const overlayOpen = openBook !== null;

  const handleCreateBook = async (shelf: Shelf, title: string) => {
    try {
      await createBook(shelf, title);
      await reload();
      showToast(`『${title.slice(0, 12)}』を棚に置きました`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "作成に失敗しました");
    }
  };

  const handleCreateSharedBook = async (title: string, passcode: string) => {
    await createBook("shared", title, passcode);
    await reload();
    showToast(`『${title.slice(0, 12)}』を共同の書架に置きました。合言葉「${passcode}」を仲間に伝えてください。`);
  };

  const handleJoinShared = async (passcode: string) => {
    const book = await joinSharedBook(passcode);
    await reload();
    showToast(`『${book.title}』に参加しました。`);
  };

  return (
    <main className="app">
      <TopBar
        user={user}
        stats={stats}
        due={due}
        books={books}
        onOpenMeter={() => setMeterOpen(true)}
        onOpenDue={(entry) => {
          setFocusEntryId(entry.id);
          setStartMode("timeline");
          setOpenBookId(entry.bookId);
        }}
        onLogout={() => {
          logout();
          setUser(null);
          setBooks([]);
        }}
      />
      {error && <div className="empty" style={{ maxWidth: 1180, margin: "0 auto 20px" }}>{error}</div>}

      <Bookcase
        books={books}
        overlayOpen={overlayOpen}
        onOpenBook={(b) => {
          setFocusEntryId(null);
          setStartMode(null);
          setOpenBookId(b.id);
        }}
        onCreateBook={handleCreateBook}
        onCreateSharedBook={handleCreateSharedBook}
        onJoinShared={handleJoinShared}
      />

      {openBook && (
        <BookOverlay
          key={openBook.id}
          book={openBook}
          books={books}
          allEntries={allEntries}
          startMode={startMode}
          focusEntryId={focusEntryId}
          serverFlags={serverFlags}
          onClose={() => {
            setOpenBookId(null);
            setFocusEntryId(null);
          }}
          onSaveEntry={async (data) => {
            await createEntry(openBook.id, data);
            await reload();
            const resolve = data.resolveDate ?? addMonthsISO(todayISO(), 6);
            showToast(
              data.resolveDate
                ? `${resolve}に、結果をたずねます。`
                : `6ヶ月後(${resolve})に、結果をたずねます。`
            );
          }}
          onResolve={async (entryId, data) => {
            await resolveEntry(entryId, data);
            await reload();
            showToast("結果を綴じました。計器に反映されています。");
          }}
          onPostpone={async (entryId) => {
            const updated = await postponeEntry(entryId);
            await reload();
            showToast(`わかりました。1ヶ月後(${updated.resolveDate})に、もう一度たずねます。`);
          }}
          onAppend={async (entryId, text) => {
            await appendEntry(entryId, text);
            await reload();
            showToast("追記を残しました。決定時の記録はそのままです。");
          }}
          onWithdraw={async (entry): Promise<WriteDraft> => {
            const res = await withdrawEntry(entry.id);
            await reload();
            showToast("フォームに戻しました。書き直して、もう一度綴じてください。");
            const w = res.withdrawn;
            return {
              title: w.title,
              body: w.body,
              tags: w.tags.map((t) => `#${t}`).join(" "),
              confidence: w.confidence,
            };
          }}
          onPublish={async (entryId, data) => {
            const res = await publishEntry(entryId, data);
            await reload();
            showToast(
              res.passcode
                ? `出版しました。原本はあなたの書架に残っています。合言葉「${res.passcode}」を仲間に伝えてください。`
                : "出版しました。原本はあなたの書架に残っています。"
            );
          }}
        />
      )}

      {meterOpen && stats && (
        <CalibrationModal
          stats={stats}
          onClose={() => setMeterOpen(false)}
          onDemoReset={() => {
            showToast("デモ初期化は backend で `python seed.py --reset` を実行してください。");
          }}
        />
      )}

      <div id="toast" className={toast ? "show" : ""} role="status">
        {toast}
      </div>
    </main>
  );
}
